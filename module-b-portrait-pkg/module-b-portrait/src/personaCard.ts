/**
 * ECNU Dating · ECBTI 人格卡片
 *
 * ECBTI = ECNU Behavioral Type Indicator —— 华东师大校园恋爱版人格测评
 * 25 个原创类型 + 1 个兜底 + 4 个隐藏触发型，全部为本项目原创。
 *
 * 流程：
 *   1. 18 道 Likert + profile + 文本字段 → 15 维 L/M/H 用户向量
 *   2. 与 25 个标准类型 pattern 做 L1 距离匹配，挑最优 + 次优
 *   3. 若最佳匹配度 < 60% → 强制 HHHH 兜底（"系统强制兜底"）
 *   4. 若 q19/q20/intro_prompt 命中隐藏人格关键词 → 100% 覆盖（"隐藏人格已激活"）
 *   5. 调 LLM 生成只属于该用户的 nickname / catchphrase / summary / highlights
 *   6. 失败降级 → preset 文案
 *
 * 详见 prd/ecnu-mbti-card/
 */

import express from 'express';
import crypto from 'crypto';
import logger from './stubs/logger';
import { authenticateGatewayOrBearer, authenticateGatewayOrBearerIfPresent } from './stubs/auth';
import { getAgentClient } from './stubs/agent-client';
import { datingModel, DatingError } from './stubs/model';
import { pool, safeJsonParse } from './stubs/database';
import {
  STANDARD_TYPE_LIBRARY,
  FALLBACK_HHHH,
  HIDDEN_TYPES,
  findTypeByCode,
  type SbtiTypeDef,
  type LMH,
} from './personaCardTypes';
import { extractAllTextTags, type Q22TagResult, type TextTagResult } from './textTagExtractor';

const PERSONA_MODEL_ID = process.env.DATING_PERSONA_CARD_MODEL_ID
  || process.env.DATING_RELATIONSHIP_SUMMARY_MODEL_ID
  || 'qwen-plus';

type PersonaSource = {
  sourceScope: 'user' | 'session';
  sourceId: string;
  versionKey: string;
  answers: Record<string, unknown>;
  profile: Record<string, unknown>;
};

function isMissingRelationError(error: unknown): boolean {
  return Boolean((error as { code?: string })?.code === '42P01');
}

function stableSortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stableSortValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

function buildSourceHash(input: {
  versionKey: string;
  answers: Record<string, unknown>;
  profile: Record<string, unknown>;
}): string {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(stableSortValue(input)))
    .digest('hex');
}

function buildCacheKey(source: PersonaSource, sourceHash: string): string {
  return `${source.sourceScope}:${source.sourceId}:${sourceHash}`;
}

async function loadCachedPersonaCard(cacheKey: string): Promise<PersonaCardPayload | null> {
  try {
    const row = await pool.get(
      `SELECT payload
       FROM dating_persona_card_cache
       WHERE cache_key = $1
       LIMIT 1`,
      [cacheKey],
    );

    if (!row?.payload) return null;
    return safeJsonParse(row.payload, null) as PersonaCardPayload | null;
  } catch (error) {
    if (isMissingRelationError(error)) return null;
    throw error;
  }
}

async function saveCachedPersonaCard(input: {
  cacheKey: string;
  source: PersonaSource;
  sourceHash: string;
  payload: PersonaCardPayload;
}): Promise<void> {
  try {
    await pool.run(
      `INSERT INTO dating_persona_card_cache (
         cache_key,
         source_scope,
         source_id,
         source_hash,
         payload,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5::jsonb, NOW(), NOW())
       ON CONFLICT (cache_key)
       DO UPDATE SET
         payload = EXCLUDED.payload,
         updated_at = NOW()`,
      [
        input.cacheKey,
        input.source.sourceScope,
        input.source.sourceId,
        input.sourceHash,
        JSON.stringify(input.payload),
      ],
    );
  } catch (error) {
    if (isMissingRelationError(error)) return;
    throw error;
  }
}

function isReviewPreviewAllowed(req: express.Request): boolean {
  const reviewToken = typeof req.headers['x-campus-review-token'] === 'string'
    ? req.headers['x-campus-review-token'].trim()
    : '';

  return Boolean(
    process.env.CAMPUS_REVIEW_TOKEN
    && reviewToken
    && reviewToken === process.env.CAMPUS_REVIEW_TOKEN,
  );
}

// ---------------------------------------------------------------------------
// 15 维定义
// ---------------------------------------------------------------------------

const DIM_ORDER = [
  'SELF_EXPR',     // 1
  'STRUCTURE',     // 2
  'EMO_STAB',      // 3
  'SECURITY',      // 4
  'EXPLORE',       // 5
  'VALUES',        // 6
  'REPAIR',        // 7
  'COMMIT',        // 8
  'EMPATHY',       // 9
  'PACE',          // 10 profile.relationship_goal
  'DISTANCE',      // 11 profile.long_distance_preference
  'VICE',          // 12 profile.smoking_preference
  'INTRO_DENSITY', // 13 intro_prompt 文本
  'REDLINE',       // 14 q19 文本
  'ICEBREAK',      // 15 q20 文本
] as const;

const DIM_LABELS: Record<typeof DIM_ORDER[number], string> = {
  SELF_EXPR: '自我表达直接度',       // q01 主动迈步 + q09 表达需要
  STRUCTURE: '守约结构感',           // q03 守约 + q15 沟通频率期望
  EMO_STAB: '情绪稳定',             // q05 压力稳定 + ¬q13 情绪冲动
  SECURITY: '亲密距离感',            // ¬q07 不安全依恋 + ¬q08 回避倾向 → 合成
  EXPLORE: '探索开放度',             // q06 尝试新方式（单题，纯行为偏好）
  VALUES: '价值观与远见',            // q10 善良可靠 + q18 慢热偏好 + q11 欣赏上进
  REPAIR: '修复能力',               // q12 分歧沟通 + q14 主动道歉
  COMMIT: '投入意愿',               // q16 留出时间 + q17 弹性投入
  EMPATHY: '沟通温度',              // q02 尊重表达 + q04 情绪敏感度（≠ 共情）
  PACE: '关系节奏偏好',             // profile 单选（偏好，非人格）
  DISTANCE: '异地接受度',            // profile 单选（偏好）
  VICE: '生活方式弹性',             // profile 单选（偏好）
  INTRO_DENSITY: '见面场景具体度',   // intro_prompt 文本 + 否定检测
  REDLINE: '关系雷区强度',           // q19 文本 + 否定检测
  ICEBREAK: '破冰主动度',           // q20 文本 + 否定检测
};

// 维度解读文案：基于用户实际得分 L/M/H 给出固定解读
const DIM_INTERPRETATIONS: Record<typeof DIM_ORDER[number], Record<LMH, string>> = {
  SELF_EXPR: {
    L: '你在关系起步阶段比较含蓄，不会轻易主动表达需求，倾向于等对方先走一步。',
    M: '你的表达方式比较平衡——该主动时不退缩，但也不会太急切。',
    H: '你是那种想到就说、想做就做的人。在感情里，你更愿意主动表达自己的想法和需要。',
  },
  STRUCTURE: {
    L: '你对约会和联系的频率比较随性，不太在意固定安排。',
    M: '你对守约和联系节奏有一定期待，但也能接受变化。',
    H: '你很看重承诺和节奏感，说好的事就要做到，也期待对方有稳定的回应频率。',
  },
  EMO_STAB: {
    L: '你的情绪波动比较明显，压力大或关系紧张时容易受影响。',
    M: '你的情绪大多数时候比较稳定，偶尔会受外界影响。',
    H: '你是情绪上的"稳定器"，即使遇到冲突或压力也能保持冷静，不容易被情绪牵着走。',
  },
  SECURITY: {
    L: '你在亲密关系中可能会有些不安全感，容易担心对方的回应和态度。',
    M: '你对亲密关系的距离感拿捏得比较好，不会太黏也不会太远。',
    H: '你在关系中很有安全感，不容易因为对方的小举动而焦虑，能给彼此留出舒适空间。',
  },
  EXPLORE: {
    L: '你更喜欢熟悉的相处方式，不太热衷于尝试新鲜事物。',
    M: '你对新体验持开放态度，但不会刻意追求。',
    H: '你是个喜欢探索新事物的人，愿意和对方一起尝试没做过的事情。',
  },
  VALUES: {
    L: '你对价值观和长远规划看得比较轻松，更注重当下的感受。',
    M: '你在价值观上有自己的看法，但不会太强调目标感。',
    H: '你非常看重善良、靠谱和上进心，希望对方也有清晰的价值观和人生方向。',
  },
  REPAIR: {
    L: '面对冲突时你可能倾向于回避或冷处理，不太擅长主动修复关系。',
    M: '你在冲突后能慢慢缓和，但不一定会第一时间主动修复。',
    H: '你有很强的关系修复能力，遇到分歧能主动沟通、坦诚道歉，不让问题堆积。',
  },
  COMMIT: {
    L: '你目前对感情投入持观望态度，不太愿意过早地花大量时间和精力。',
    M: '你愿意为关系投入，但也需要保持自己的节奏和空间。',
    H: '你是一个高投入型的恋人，愿意为对方留出时间、调整自己的计划来经营关系。',
  },
  EMPATHY: {
    L: '你在沟通中更偏理性，不太容易感知到对方的情绪变化。',
    M: '你有一定的共情能力，大多数时候能理解对方的感受。',
    H: '你的沟通温度很高，很善于倾听和理解对方，能敏锐地感知到情绪变化。',
  },
  PACE: {
    L: '你更倾向于先从朋友做起，慢慢培养感觉再考虑发展。',
    M: '你喜欢慢热的节奏，在了解彼此后再逐步加深关系。',
    H: '你对恋爱比较认真，更想找一段稳定、有目标的关系。',
  },
  DISTANCE: {
    L: '你很看重同城相处，比较难接受异地的模式。',
    M: '你对异地持开放态度，视具体情况而定。',
    H: '你能接受异地恋，认为距离不是阻碍感情的核心因素。',
  },
  VICE: {
    L: '你对生活习惯要求比较严格，比如完全不能接受吸烟。',
    M: '你有底线但也有弹性，能包容一些和自己不同的生活习惯。',
    H: '你对生活方式很包容，不会因为小习惯差异而介意。',
  },
  INTRO_DENSITY: {
    L: '你描述见面场景时比较笼统，可能还没想好具体怎么安排。',
    M: '你对见面有一定的想象，但不会计划得太详细。',
    H: '你对第一次见面有很具体的画面感，说明你对这段关系有认真的期待。',
  },
  REDLINE: {
    L: '你对关系中的雷区包容度比较高，没有特别明确的底线。',
    M: '你有一些在意的底线，但表达比较温和。',
    H: '你的底线非常明确，知道自己在关系中绝对不能接受什么。',
  },
  ICEBREAK: {
    L: '你倾向于顺其自然地开始接触，不太会主动规划破冰方式。',
    M: '你有破冰的意愿，方式上会比较自然和随性。',
    H: '你是一个破冰达人，会主动提出具体的见面计划和活动。',
  },
};

// 7 点量表 → L/M/H：1-3 → L, 4 → M, 5-7 → H
function likertToLmh(raw: unknown): LMH {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 'M';
  if (n <= 3) return 'L';
  if (n >= 5) return 'H';
  return 'M';
}

// 把两题 Likert 平均后再转 L/M/H（反向题用 1-反向）
function avgLikert(answers: Record<string, unknown>, items: Array<{ q: string; reverse?: boolean }>): LMH {
  let sum = 0;
  let cnt = 0;
  for (const item of items) {
    const raw = answers[item.q];
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    const v = item.reverse ? 8 - Math.max(1, Math.min(7, Math.round(n))) : Math.max(1, Math.min(7, Math.round(n)));
    sum += v;
    cnt += 1;
  }
  if (cnt === 0) return 'M';
  return likertToLmh(sum / cnt);
}

// Likert items + one single-choice question mapped to a 1-7 numeric value
function avgLikertWithChoice(
  answers: Record<string, unknown>,
  likertItems: Array<{ q: string; reverse?: boolean }>,
  choiceValue: unknown,
  choiceMap: Record<string, number>,
): LMH {
  let sum = 0;
  let cnt = 0;
  for (const item of likertItems) {
    const raw = answers[item.q];
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) continue;
    const v = item.reverse ? 8 - Math.max(1, Math.min(7, Math.round(n))) : Math.max(1, Math.min(7, Math.round(n)));
    sum += v;
    cnt += 1;
  }
  if (typeof choiceValue === 'string' && choiceMap[choiceValue] != null) {
    sum += choiceMap[choiceValue];
    cnt += 1;
  }
  if (cnt === 0) return 'M';
  return likertToLmh(sum / cnt);
}

// Map a single-choice answer to a Likert-equivalent number (for consolidated scores)
function choiceToLikert(value: unknown, mapping: Record<string, number>): number | null {
  if (typeof value !== 'string') return null;
  return mapping[value] ?? null;
}

function profileSingleToLmh(value: unknown, mapping: Record<string, LMH>, fallback: LMH = 'M'): LMH {
  if (typeof value !== 'string') return fallback;
  return mapping[value] ?? fallback;
}

// 否定前缀列表 — 如果关键词前面紧跟否定词，反转信号
const NEGATION_PREFIXES = ['不', '没', '不想', '不要', '不会', '没有', '别'];

function hasNegatedKeyword(text: string, keyword: string): boolean {
  const idx = text.indexOf(keyword);
  if (idx < 0) return false;
  // Check up to 5 characters before keyword for negation, but stop at sentence boundaries
  const windowStart = Math.max(0, idx - 5);
  const prefix = text.slice(windowStart, idx);
  // Don't cross sentence boundaries (，。；！？)
  const lastBoundary = Math.max(
    prefix.lastIndexOf('，'), prefix.lastIndexOf('。'),
    prefix.lastIndexOf('；'), prefix.lastIndexOf('！'),
    prefix.lastIndexOf('？'), prefix.lastIndexOf(','),
  );
  const effectivePrefix = lastBoundary >= 0 ? prefix.slice(lastBoundary + 1) : prefix;
  return NEGATION_PREFIXES.some((neg) => effectivePrefix.includes(neg));
}

function fuzzyKeywordMatch(text: string, keyword: string): boolean {
  // Exact match
  if (text.includes(keyword)) return true;
  // For keywords >= 3 chars, allow 1 char difference (simple fuzzy)
  if (keyword.length >= 3) {
    for (let i = 0; i < text.length - keyword.length + 1; i++) {
      const slice = text.slice(i, i + keyword.length);
      let diff = 0;
      for (let j = 0; j < keyword.length; j++) {
        if (slice[j] !== keyword[j]) diff++;
        if (diff > 1) break;
      }
      if (diff <= 1) return true;
    }
  }
  return false;
}

// 文本字段评分：长度 + 关键词强度 + 否定检测
function textDensityToLmh(value: unknown, options: {
  longThreshold?: number;
  shortThreshold?: number;
  highKeywords?: string[];
  lowKeywords?: string[];
}): LMH {
  if (typeof value !== 'string') return 'M';
  const text = value.trim();
  if (!text) return 'L';
  const len = [...text].length;
  const longT = options.longThreshold ?? 28;
  const shortT = options.shortThreshold ?? 10;
  let lmh: LMH;
  if (len >= longT) lmh = 'H';
  else if (len <= shortT) lmh = 'L';
  else lmh = 'M';

  // 关键词匹配：跳过被否定的关键词
  const highHit = options.highKeywords?.some((kw) => text.includes(kw) && !hasNegatedKeyword(text, kw));
  const lowHit = options.lowKeywords?.some((kw) => text.includes(kw) && !hasNegatedKeyword(text, kw));
  if (highHit) lmh = 'H';
  if (lowHit) lmh = 'L';
  return lmh;
}

// 计算 6 个合并维度的真实百分比（基于 Likert 均值）
export interface ConsolidatedScore { label: string; percent: number }
export function buildConsolidatedScores(answers: Record<string, unknown>, profile: Record<string, unknown>): ConsolidatedScore[] {
  const likert = (q: string, reverse?: boolean): number | null => {
    const raw = answers[q];
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return null;
    const v = reverse ? 8 - Math.max(1, Math.min(7, Math.round(n))) : Math.max(1, Math.min(7, Math.round(n)));
    return v;
  };
  const avg = (items: Array<{ q: string; r?: boolean }>, extraValue?: number | null): number => {
    let sum = 0; let cnt = 0;
    for (const item of items) { const v = likert(item.q, item.r); if (v != null) { sum += v; cnt += 1; } }
    if (extraValue != null) { sum += extraValue; cnt += 1; }
    if (cnt === 0) return 57;
    return Math.round(((sum / cnt - 1) / 6) * 100);
  };
  return [
    { label: '情感表达力', percent: avg([{ q: 'q01' }, { q: 'q09' }, { q: 'q02' }, { q: 'q04' }]) },
    { label: '安全感与信任', percent: avg([{ q: 'q04', r: true }, { q: 'q08', r: true }, { q: 'q05' }, { q: 'q13', r: true }, { q: 'q15' }]) },
    { label: '沟通与修复力', percent: avg([{ q: 'q12' }, { q: 'q14' }, { q: 'q02' }]) },
    { label: '生活投入度', percent: avg([{ q: 'q03' }, { q: 'q15' }, { q: 'q16' }, { q: 'q17' }]) },
    { label: '价值观稳定度', percent: avg([{ q: 'q10' }, { q: 'q18' }, { q: 'q11' }]) },
    { label: '探索与主动性', percent: avg([{ q: 'q01' }, { q: 'q06' }]) },
  ];
}

interface UserVector {
  vector: LMH[];                          // 15 长度
  byDim: Record<string, LMH>;             // dim → LMH
}

export function buildUserVector(answers: Record<string, unknown>, profile: Record<string, unknown>): UserVector {
  const byDim: Record<string, LMH> = {
    SELF_EXPR: avgLikert(answers, [{ q: 'q01' }, { q: 'q09' }]),
    STRUCTURE: avgLikert(answers, [{ q: 'q03' }, { q: 'q15' }]),
    EMO_STAB: avgLikert(answers, [{ q: 'q05' }, { q: 'q13', reverse: true }]),
    SECURITY: avgLikert(answers, [{ q: 'q04', reverse: true }, { q: 'q08', reverse: true }]),
    EXPLORE: avgLikert(answers, [{ q: 'q06' }]),  // 单题：纯行为开放度
    VALUES: avgLikert(answers, [{ q: 'q10' }, { q: 'q18' }, { q: 'q11' }]),
    REPAIR: avgLikert(answers, [{ q: 'q12' }, { q: 'q14' }]),
    COMMIT: avgLikert(answers, [{ q: 'q16' }, { q: 'q17' }]),
    EMPATHY: avgLikert(answers, [{ q: 'q02' }, { q: 'q04' }]),
    PACE: profileSingleToLmh(profile.relationship_goal, {
      serious: 'H', slow_burn: 'M', friend_first: 'L',
    }),
    DISTANCE: profileSingleToLmh(profile.long_distance_preference, {
      accept: 'H', depends: 'M', reject: 'L',
    }),
    VICE: profileSingleToLmh(profile.smoking_preference, {
      accept: 'H', prefer_no: 'M', reject: 'L',
    }),
    INTRO_DENSITY: textDensityToLmh(profile.intro_prompt, {}),
    REDLINE: textDensityToLmh(answers.q19, {
      highKeywords: ['不能', '受不了', '绝不', '操', '垃圾', '欺骗', '冷暴力', '消失'],
      lowKeywords: ['都行', '无所谓', '随便'],
    }),
    ICEBREAK: textDensityToLmh(answers.q20, {
      longThreshold: 30,
      highKeywords: ['约', '一起', '出去', '电影', '咖啡', '逛', '出发'],
      lowKeywords: ['看心情', '随缘', '再说'],
    }),
  };

  const vector: LMH[] = DIM_ORDER.map((dim) => byDim[dim] ?? 'M');
  return { vector, byDim };
}

// ---------------------------------------------------------------------------
// L1 距离 + 类型匹配
// ---------------------------------------------------------------------------

const LMH_TO_NUM: Record<LMH, number> = { L: 1, M: 2, H: 3 };

function patternToVector(pattern: string): LMH[] {
  const out: LMH[] = [];
  for (const ch of pattern) {
    if (ch === 'L' || ch === 'M' || ch === 'H') out.push(ch);
  }
  while (out.length < DIM_ORDER.length) out.push('M');
  return out.slice(0, DIM_ORDER.length);
}

interface MatchResult {
  type: SbtiTypeDef;
  distance: number;     // 0..30
  exact: number;        // 0..15  完全命中
  matchPercent: number; // 0..100
}

function matchUserAgainst(userVec: LMH[], type: SbtiTypeDef): MatchResult {
  const typeVec = patternToVector(type.pattern);
  let distance = 0;
  let exact = 0;
  for (let i = 0; i < userVec.length; i++) {
    const u = LMH_TO_NUM[userVec[i]];
    const t = LMH_TO_NUM[typeVec[i]];
    const diff = Math.abs(u - t);
    distance += diff;
    if (diff === 0) exact += 1;
  }
  const matchPercent = Math.max(0, Math.round((1 - distance / 30) * 100));
  return { type, distance, exact, matchPercent };
}

function rankAllStandardTypes(userVec: LMH[]): MatchResult[] {
  return STANDARD_TYPE_LIBRARY
    .map((t) => matchUserAgainst(userVec, t))
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.exact !== b.exact) return b.exact - a.exact;
      return b.matchPercent - a.matchPercent;
    });
}

// ---------------------------------------------------------------------------
// 隐藏人格触发器
// ---------------------------------------------------------------------------

interface TriggerHit {
  type: SbtiTypeDef;
  matchedKeyword: string;
  matchedField: string;
}

function detectHiddenTrigger(answers: Record<string, unknown>, profile: Record<string, unknown>): TriggerHit | null {
  const fieldText = (key: string): string => {
    if (key === 'intro_prompt') return typeof profile.intro_prompt === 'string' ? profile.intro_prompt : '';
    return typeof answers[key] === 'string' ? (answers[key] as string) : '';
  };

  // Collect all field texts once
  const allTexts = new Map<string, string>();
  for (const field of ['intro_prompt', 'q19', 'q20'] as const) {
    const text = fieldText(field);
    if (text) allTexts.set(field, text);
  }

  for (const type of HIDDEN_TYPES) {
    if (!type.trigger) continue;
    let totalHits = 0;
    let firstHitKeyword = '';
    let firstHitField = '';

    for (const field of type.trigger.scanFields) {
      const text = allTexts.get(field);
      if (!text) continue;
      for (const kw of type.trigger.keywords) {
        if (fuzzyKeywordMatch(text, kw) && !hasNegatedKeyword(text, kw)) {
          totalHits++;
          if (!firstHitKeyword) {
            firstHitKeyword = kw;
            firstHitField = field;
          }
        }
      }
    }

    // Require 2+ keyword hits across all fields to trigger (soft trigger)
    // Exception: single strong hit in q19 (dealbreaker field) still counts
    if (totalHits >= 2 || (totalHits >= 1 && firstHitField === 'q19')) {
      return { type, matchedKeyword: firstHitKeyword, matchedField: firstHitField };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// LLM prompt 构造（ECBTI 文案风格规则）
// ---------------------------------------------------------------------------

interface LlmOutput {
  nickname: string;
  catchphrase: string;
  reading: { summary: string; highlights: string[]; references?: string[] };
  hidden: { tagline: string };
}

function buildPrompt(input: {
  primary: SbtiTypeDef;
  secondary: SbtiTypeDef;
  specialKind: PersonaSpecialKind;
  scoring: { matchPercent: number; exact: number; userVec: LMH[] };
  profile: Record<string, unknown>;
  answers: Record<string, unknown>;
}): string {
  const { primary, secondary, specialKind, scoring, profile, answers } = input;

  const dimLines = DIM_ORDER.map((dim, i) => `- ${DIM_LABELS[dim]}：${scoring.userVec[i]}`).join('\n');

  const intro = typeof profile.intro_prompt === 'string' && profile.intro_prompt.trim() ? profile.intro_prompt : '（未填）';
  const q19 = typeof answers.q19 === 'string' && (answers.q19 as string).trim() ? answers.q19 : '（未填）';
  const q20 = typeof answers.q20 === 'string' && (answers.q20 as string).trim() ? answers.q20 : '（未填）';

  const campus = typeof profile.campus === 'string' ? profile.campus : '未知校区';
  const grade = typeof profile.grade_label === 'string' ? profile.grade_label : '未知年级';
  const academy = typeof profile.academy === 'string' ? profile.academy : '未知专业';

  const relationshipGoal = typeof answers.relationship_goal === 'string' ? (answers.relationship_goal as string) : (typeof profile.relationship_goal === 'string' ? profile.relationship_goal : '未填');

  // Map raw values to Chinese labels for the prompt
  const needsLabels: Record<string, string> = {
    emotional_companion: '精神陪伴', grow_together: '共同成长', practical_care: '生活照顾',
    physical_closeness: '肢体亲密', personal_space: '独立空间', emotional_value: '情绪价值',
    shared_experience: '共同体验', verbal_expression: '言语表达',
  };
  const roleLabels: Record<string, string> = {
    caregiver: '主动照顾', receiver: '被照顾', equal: '互相平等', flexible: '看情况',
  };
  const goalLabels: Record<string, string> = {
    serious: '认真关系', slow_burn: '慢慢了解', friend_first: '先做朋友',
  };
  const routineLabels: Record<string, string> = {
    early_bird: '早起型', normal: '正常作息', night_owl: '夜猫子', irregular: '不固定',
  };
  const personalityLabels: Record<string, string> = {
    introverted: '内向安静', extroverted: '外向活泼', slow_warm: '慢热', talkative: '话多',
    humorous: '幽默搞笑', empathetic: '共情力强', rational: '理性冷静', romantic: '浪漫',
    independent: '独立', clingy: '粘人', adventurous: '爱冒险', homebody: '宅',
    organized: '有计划', spontaneous: '随性', ambitious: '上进心强', easygoing: '佛系',
    ambivert: '内外兼具', sensitive: '敏感细腻', curious: '好奇心强',
    loyal: '重感情/忠诚', perfectionist: '完美主义', carefree: '大大咧咧',
    creative: '有创意', stubborn: '有点倔', anxious: '容易焦虑', optimistic: '乐观积极',
  };

  const hobbyLabels: Record<string, string> = {
    sports: '运动健身', music: '音乐', movies: '电影/追剧', reading: '阅读',
    gaming: '游戏', travel: '旅行/探店', cooking: '做饭/美食', photography: '摄影',
    art: '画画/手工', outdoor: '户外/露营', pets: '撸猫撸狗', dance: '舞蹈',
    board_games: '桌游/剧本杀', volunteering: '公益/志愿', coding: '编程/技术',
    science: '科研/实验', digital: '数码/硬件', anime: '动漫/二次元',
    fashion: '穿搭/时尚', writing: '写作/创作', other: '其他',
  };
  const hobbiesDisplay = Array.isArray(profile.hobbies)
    ? (profile.hobbies as string[]).map(v => hobbyLabels[v] ?? v).join('、') : '未填';
  const personalityDisplay = Array.isArray(profile.personality_tags)
    ? (profile.personality_tags as string[]).map(v => personalityLabels[v] ?? v).join('、') : '未填';
  const routineDisplay = routineLabels[typeof profile.routine === 'string' ? profile.routine : ''] ?? '未填';
  const needsDisplay = Array.isArray(answers.relationship_needs)
    ? (answers.relationship_needs as string[]).map(v => needsLabels[v] ?? v).join('、') : '未填';
  const roleDisplay = roleLabels[typeof answers.relationship_role === 'string' ? (answers.relationship_role as string) : ''] ?? '未填';
  const goalDisplay = goalLabels[relationshipGoal] ?? relationshipGoal;

  const specialLine = specialKind === 'hidden'
    ? '⚠️ 注意：这是「隐藏人格已激活」状态。请用「已被某某异常因子接管」的语气写，不要再走常规审判路线。'
    : specialKind === 'fallback'
      ? '⚠️ 注意：标准人格库对该用户全面溃败，这是「系统强制兜底」结果。请用一种"标准库罢工了，给你随便发一个"的自嘲语气。'
      : '';

  return [
    '你是一个幽默、损但善意的华东师大校园心理观察者，正在写 ECBTI（ECNU Behavioral Type Indicator）人格卡片文案。',
    'ECBTI 是为校园恋爱场景定制的人格测评，每个类型用 3-5 字英文代号 + 接地气的中文昵称表达。文案要求：俏皮、有梗、贴恋爱场景、有"嘴上 vs 手上"或"白天 vs 深夜"对比、有具体而荒谬的比喻。',
    '',
    '【强制风格规则】（必须 100% 遵守，否则返工）：',
    '1. summary 必须出现至少一组"嘴上 / 手上" 或 "表面 / 实际"或 "白天 / 深夜" 的对比句式',
    '2. summary 必须深入分析用户的回答模式：引用至少2处用户的具体选择（兴趣爱好、性格标签、关系需求等）或原文（见面想做的事、最受不了什么），解释这些选择之间的内在联系',
    '3. 必须出现至少一个夸张但具体的比喻（不要"像一杯水"这种模糊比喻；要"像一台只接受硬币的二十年前的自动售货机"那种）',
    '4. 允许互联网梗（吗喽 / 摆烂 / 已读不回 / 卧槽 / 上头 / 下头），但每段不超过 2 个',
    '5. 禁止：心理学诊断词（抑郁/焦虑症/人格障碍）、"你应该"开头、复读 MBTI 那套老话、空洞鸡汤',
    '6. 语气可以损但不要羞辱用户，每段结尾留一点温柔的转折',
    '',
    '【输出 JSON 格式】（严格遵守，不要 markdown code fence，不要解释文字）：',
    '{"nickname":"2-5字原创昵称","catchphrase":"10-20字标语","summary":"250-350字深度解读","highlights":["30-50字亮点1","30-50字亮点2","30-50字亮点3"],"references":["引用的问卷原文1","引用的问卷原文2","引用的问卷原文3"],"hidden_tagline":"10-18字隐藏人格一句话"}',
    '',
    '⚠️ 重要规则：',
    '1. 所有字段都在顶层，不要嵌套！summary、highlights、references 都是顶层字段',
    '2. summary 250-350字，必须引用 2+ 处用户的具体选择或原话（用中文，不要用英文字段名）',
    '3. highlights 3 条，每条 30-50 字，有具体依据',
    '4. references 3 条，引用用户原文（如"选择了精神陪伴和共同成长"、"写了在校园散步"）',
    '5. hidden_tagline 10-18字',
    '6. nickname 必须原创，不能用默认昵称',
    '7. 所有输出必须用中文，不要出现英文字段名（不要写 sports/physical_closeness 等）',
    '',
    '## 创作规则（极其重要）',
    '昵称必须是你原创的 2-5 字新名字，不能直接使用默认昵称！根据用户的性格标签、兴趣爱好、关系需求、问卷回答来创作，要有趣且能反映用户的真实特点。',
    '',
    '### 好的昵称示例（参考风格，不要照抄）：',
    '- 默认"观察家" → 创作"已读不回鉴定师"（结合用户慢热+理性冷静的性格）',
    '- 默认"诗写恋人" → 创作"深夜备忘录"（结合用户喜欢写作+夜猫子作息）',
    '- 默认"散步型恋人" → 创作"奶茶续命搭子"（结合用户喜欢美食+精神陪伴需求）',
    '- 默认"安全岛" → 创作"情绪急救包"（结合用户共情力强+看重情绪价值）',
    '- 默认"梭哈者" → 创作"一键已读秒回"（结合用户外向+言语表达需求）',
    '',
    `## 主类型\n${primary.code}（默认昵称：${primary.nickname}）\n⚠️ 你必须创作一个全新的昵称，不能使用"${primary.nickname}"！\n默认标语仅供参考：${primary.catchphrase}`,
    `## 次类型（隐藏人格）\n${secondary.code}（${secondary.nickname}）`,
    `## 当前匹配状态\n匹配度 ${scoring.matchPercent}%`,
    specialLine,
    '',
    '## 用户在各维度上的位置（L=低 / M=中 / H=高）',
    dimLines,
    '',
    '## 用户亲手写的三段文本（唯一性的来源 — 必须引用其中至少一个具体意象）',
    `### 第一次见面想做的事\n${intro}`,
    `### 最受不了关系里出现什么\n${q19}`,
    `### 想怎么破冰\n${q20}`,
    '',
    `## 基础信息\n校区：${campus} | 年级：${grade} | 学院：${academy}\n兴趣爱好：${hobbiesDisplay}\n性格标签：${personalityDisplay}\n作息习惯：${routineDisplay}\n关系需求：${needsDisplay}\n关系角色：${roleDisplay}\n关系节奏：${goalDisplay}`,
    '',
    '请只输出严格 JSON，不要解释。',
  ].join('\n');
}

function tryParseLlmJson(raw: string): LlmOutput | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));

    // Handle both flat and nested formats
    const nickname = typeof parsed.nickname === 'string' ? parsed.nickname : null;
    const catchphrase = typeof parsed.catchphrase === 'string' ? parsed.catchphrase : null;

    // Summary: try flat first, then nested reading.summary, then reading as string
    const summary = typeof parsed.summary === 'string' ? parsed.summary
      : typeof parsed.reading?.summary === 'string' ? parsed.reading.summary
      : typeof parsed.reading === 'string' ? parsed.reading
      : null;

    // Highlights: try flat first, then nested
    const rawHighlights = Array.isArray(parsed.highlights) ? parsed.highlights
      : Array.isArray(parsed.reading?.highlights) ? parsed.reading.highlights
      : [];
    const highlights = rawHighlights.filter((s: unknown) => typeof s === 'string');

    // References: try flat first, then nested
    const rawRefs = Array.isArray(parsed.references) ? parsed.references
      : Array.isArray(parsed.reading?.references) ? parsed.reading.references
      : [];
    const references = rawRefs.filter((s: unknown) => typeof s === 'string').slice(0, 6).map((s: string) => s.slice(0, 120));

    // Hidden tagline: try flat first, then nested
    const tagline = typeof parsed.hidden_tagline === 'string' ? parsed.hidden_tagline
      : typeof parsed.hidden?.tagline === 'string' ? parsed.hidden.tagline
      : null;

    const missing: string[] = [];
    if (!nickname) missing.push('nickname');
    if (!catchphrase) missing.push('catchphrase');
    if (!summary) missing.push('summary');
    if (!tagline) missing.push('hidden_tagline');
    if (missing.length > 0) {
      logger.warn(`[persona-card] LLM output missing fields: ${missing.join(', ')}`, { rawLength: raw.length, preview: raw.slice(0, 300) });
      return null;
    }

    return {
      nickname: nickname!.slice(0, 8),
      catchphrase: catchphrase!.slice(0, 40),
      reading: {
        summary: summary!.slice(0, 1000),
        highlights: highlights.slice(0, 6).map((s: string) => s.slice(0, 80)),
        references,
      },
      hidden: { tagline: tagline!.slice(0, 40) },
    };
  } catch (err) {
    logger.warn('[persona-card] JSON parse failed', { rawLength: raw.length, preview: raw.slice(0, 300), error: String(err) });
    return null;
  }
}

/**
 * 直接调 Dashscope（OpenAI 兼容协议）生成人格卡片文案。
 * 不走 agent service，避免本地多服务依赖。
 */
async function callDashscope(prompt: string): Promise<string | null> {
  const apiKey = process.env.QWEN_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[persona-card] QWEN_API_KEY not configured');
    return null;
  }
  const baseUrl = (process.env.QWEN_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
  const model = PERSONA_MODEL_ID;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 3200,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[persona-card] dashscope http error', res.status, text.slice(0, 300));
      return null;
    }
    const data: any = await res.json();
    logger.log(`[persona-card] dashscope call: model=${model} status=${res.status} tokens=${data?.usage?.total_tokens ?? 'unknown'}`);
    const raw = data?.choices?.[0]?.message?.content ?? '';
    logger.log(`[persona-card] dashscope raw output: ${raw.length} chars`);
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : null;
  } catch (error) {
    console.error('[persona-card] dashscope call failed', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function callLlm(prompt: string): Promise<LlmOutput | null> {
  // 优先 Dashscope 直连（开发环境只需 QWEN_API_KEY，无需启动 agent service）
  const direct = await callDashscope(prompt);
  if (direct) {
    const parsed = tryParseLlmJson(direct);
    if (parsed) return parsed;
    console.warn('[persona-card] dashscope output failed schema check, falling back');
  }

  // 回退：用 qwen-turbo 重试（更快、JSON 更稳定，温度更低）
  try {
    const fallbackModel = process.env.PERSONA_FALLBACK_MODEL_ID?.trim() || 'qwen-turbo';
    logger.log(`[persona-card] retrying with fallback model: ${fallbackModel}`);
    const apiKey = process.env.QWEN_API_KEY?.trim();
    const baseUrl = (process.env.QWEN_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
    if (!apiKey) return null;
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), 30_000);
    try {
      const res2 = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: fallbackModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 3200,
          response_format: { type: 'json_object' },
        }),
        signal: controller2.signal,
      });
      if (!res2.ok) return null;
      const data2: any = await res2.json();
      logger.log(`[persona-card] fallback call: model=${fallbackModel} tokens=${data2?.usage?.total_tokens ?? '?'}`);
      const content2 = data2?.choices?.[0]?.message?.content;
      return typeof content2 === 'string' ? tryParseLlmJson(content2) : null;
    } finally {
      clearTimeout(timeout2);
    }
  } catch (error) {
    logger.error('[persona-card] fallback also failed', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Payload 组装
// ---------------------------------------------------------------------------

export type PersonaSpecialKind = 'normal' | 'hidden' | 'fallback';

export interface PersonaCardPayload {
  code: string;
  nickname: string;
  catchphrase: string;
  matchPercent: number;
  hitDimensions: number;
  totalDimensions: number;
  specialKind: PersonaSpecialKind;
  badge: string;
  kicker: string | null;
  sub: string | null;
  typeInterpretation: string;
  strengths: string[];
  challenges: string[];
  primary: {
    code: string;
    pattern: string;
    userVector: LMH[];
    dimensions: Array<{ key: string; label: string; userLevel: LMH; typeLevel: LMH; match: boolean; interpretation: string }>;
  };
  hidden: { code: string; nickname: string; tagline: string };
  illustration: {
    kind: 'preset-svg';
    id: string;
    emoji: string;
    illustrationUrl: string | null;
    palette: { from: string; to: string; accent: string };
  };
  reading: { summary: string; highlights: string[]; references: string[] };
  meta: {
    generatedAt: string;
    llmModelId: string;
    degraded: boolean;
    versionKey: string;
    triggerKeyword: string | null;
  };
  consolidatedScores?: ConsolidatedScore[];
  textTags?: {
    q22: Q22TagResult;
    q23: TextTagResult;
    q24: TextTagResult;
  };
}

function buildProfileFromRow(row: any): Record<string, unknown> {
  const basicProfile = safeJsonParse(row?.basic_profile, {});
  return {
    campus: row?.campus ?? null,
    grade_label: row?.grade_label ?? null,
    academy: row?.academy ?? null,
    relationship_goal: row?.relationship_goal ?? null,
    long_distance_preference: row?.long_distance_preference ?? null,
    smoking_preference: row?.smoking_preference ?? null,
    ...(basicProfile && typeof basicProfile === 'object' ? basicProfile : {}),
  };
}

async function loadPersonaSourceForUser(userId: string): Promise<PersonaSource | null> {
  const [profileRow, submissionRow] = await Promise.all([
    pool.get(
      `SELECT *
       FROM dating_profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    ),
    pool.get(
      `SELECT dqs.answers, dqs.submitted_at, dqv.version_key
       FROM dating_questionnaire_submissions dqs
       JOIN dating_questionnaire_versions dqv ON dqv.id = dqs.version_id
       WHERE dqs.user_id = $1
       ORDER BY dqs.submitted_at DESC
       LIMIT 1`,
      [userId],
    ),
  ]);

  if (!profileRow || !submissionRow) {
    return null;
  }

  return {
    sourceScope: 'user',
    sourceId: userId,
    versionKey: submissionRow.version_key ?? 'ecnu-spring-2026-v1',
    answers: safeJsonParse(submissionRow.answers, {}),
    profile: buildProfileFromRow(profileRow),
  };
}

async function buildPersonaSourceFromSession(
  session: NonNullable<Awaited<ReturnType<typeof datingModel.getOnboardingSession>>>,
): Promise<PersonaSource> {
  const questionnaire = await datingModel.getCurrentQuestionnaire();

  return {
    sourceScope: 'session',
    sourceId: session.session_id,
    versionKey: questionnaire.version_key ?? 'ecnu-spring-2026-v1',
    answers: session.questionnaire_answers ?? {},
    profile: session.profile_draft ?? {},
  };
}

export async function generatePersonaCardForUser(userId: string): Promise<PersonaCardPayload> {
  const source = await loadPersonaSourceForUser(userId);
  if (!source) {
    throw new DatingError('该用户尚未完成校园问卷', 404, 'PERSONA_CARD_NOT_READY');
  }

  return generatePersonaCardFromSource(source);
}

export async function generatePersonaCardForSession(sessionId: string): Promise<PersonaCardPayload> {
  const session = await datingModel.getOnboardingSession(sessionId);
  if (!session) {
    throw new DatingError('答题会话已失效，请重新开始', 404, 'ONBOARDING_SESSION_NOT_FOUND');
  }

  return generatePersonaCardFromSource(await buildPersonaSourceFromSession(session));
}

async function generatePersonaCardFromSource(source: PersonaSource): Promise<PersonaCardPayload> {
  const { sourceId, versionKey, answers, profile } = source;
  const hasAnyLikert = ['q01', 'q03', 'q05', 'q07', 'q11', 'q15'].some((q) => answers[q] != null);
  if (!hasAnyLikert) {
    throw new DatingError('请先完成问卷再生成人格卡片', 409, 'QUESTIONNAIRE_NOT_READY');
  }

  const sourceHash = buildSourceHash({ versionKey, answers, profile });
  const cacheKey = buildCacheKey(source, sourceHash);
  const cached = await loadCachedPersonaCard(cacheKey);
  if (cached) {
    return cached;
  }

  const { vector: userVec } = buildUserVector(answers, profile);

  // 文本标签抽取（与后续流程并行无关，先发起异步）
  const textTagsPromise = extractAllTextTags({
    intro_prompt: typeof profile.intro_prompt === 'string' ? profile.intro_prompt : '',
    q19: typeof answers.q19 === 'string' ? (answers.q19 as string) : '',
    q20: typeof answers.q20 === 'string' ? (answers.q20 as string) : '',
  });

  // 1) 检测隐藏人格触发
  const trigger = detectHiddenTrigger(answers, profile);

  // 2) 标准类型 ranking（无论是否触发都跑一次，用作 secondary 信息）
  const ranked = rankAllStandardTypes(userVec);
  const bestStandard = ranked[0];
  const runnerUp = ranked[1] ?? ranked[0];

  let specialKind: PersonaSpecialKind = 'normal';
  let primaryType: SbtiTypeDef;
  let secondaryType: SbtiTypeDef;
  let displayMatchPercent: number;
  let displayExact: number;
  let badge: string;
  let kicker: string | null;
  let sub: string | null;
  let triggerKeyword: string | null = null;

  if (trigger) {
    primaryType = trigger.type;
    secondaryType = bestStandard.type;
    displayMatchPercent = Math.max(bestStandard.matchPercent, 85);
    displayExact = bestStandard.exact;
    badge = trigger.type.trigger!.badge;
    kicker = trigger.type.trigger!.kicker;
    sub = trigger.type.trigger!.sub;
    specialKind = 'hidden';
    triggerKeyword = trigger.matchedKeyword;
  } else if (bestStandard.matchPercent < 60) {
    primaryType = FALLBACK_HHHH;
    secondaryType = bestStandard.type;
    displayMatchPercent = bestStandard.matchPercent;
    displayExact = bestStandard.exact;
    badge = `标准人格库最高匹配仅 ${bestStandard.matchPercent}%`;
    kicker = '系统强制兜底';
    sub = '标准人格库对你的脑回路集体罢工了，于是被强制分配到了 HHHH（傻乐者）。';
    specialKind = 'fallback';
  } else {
    primaryType = bestStandard.type;
    secondaryType = runnerUp.type;
    displayMatchPercent = bestStandard.matchPercent;
    displayExact = bestStandard.exact;
    badge = `匹配度 ${displayMatchPercent}%`;
    kicker = null;
    sub = displayMatchPercent >= 80
      ? '维度命中度较高，当前结果可视为你的第一人格画像。'
      : displayMatchPercent >= 65
        ? '维度命中度中等，你是典型的「多面向」选手。'
        : '维度命中度偏低，说明你在若干维度上都很灵活——复杂的人格更好玩。';
  }

  // 3) LLM 生成
  logger.log(`[persona-card] generating card for user scope=${source.sourceScope} type=${primaryType.code} specialKind=${specialKind}`);
  const prompt = buildPrompt({
    primary: primaryType,
    secondary: secondaryType,
    specialKind,
    scoring: { matchPercent: displayMatchPercent, exact: displayExact, userVec },
    profile,
    answers,
  });
  const llm = await callLlm(prompt);
  const degraded = llm == null;

  const nickname = llm?.nickname ?? primaryType.nickname;
  const catchphrase = llm?.catchphrase ?? primaryType.catchphrase;
  const summary = llm?.reading.summary ?? primaryType.fallbackSummary;
  const highlights = llm?.reading.highlights ?? primaryType.fallbackHighlights;
  const references = llm?.reading.references ?? [];
  const hiddenTagline = llm?.hidden.tagline ?? secondaryType.hiddenTagline;
  logger.log(`[persona-card] LLM result: degraded=${degraded} nickname=${nickname} summaryLen=${summary.length} highlightsCount=${highlights.length} referencesCount=${references.length}`);

  // 维度对照
  const primaryPattern = patternToVector(primaryType.pattern);
  const dimensions = DIM_ORDER.map((dim, i) => ({
    key: dim,
    label: DIM_LABELS[dim],
    userLevel: userVec[i],
    typeLevel: primaryPattern[i],
    match: userVec[i] === primaryPattern[i],
    interpretation: DIM_INTERPRETATIONS[dim][userVec[i]],
  }));

  const consolidatedScores = buildConsolidatedScores(answers, profile);
  const consolidatedHit = consolidatedScores.filter((s) => s.percent >= 50).length;

  // 等待文本标签抽取结果
  const textTags = await textTagsPromise;

  const payload: PersonaCardPayload = {
    code: primaryType.code,
    nickname,
    catchphrase,
    matchPercent: displayMatchPercent,
    hitDimensions: consolidatedHit,
    totalDimensions: 6,
    specialKind,
    badge,
    kicker,
    sub,
    typeInterpretation: primaryType.typeInterpretation,
    strengths: primaryType.strengths,
    challenges: primaryType.challenges,
    primary: {
      code: primaryType.code,
      pattern: primaryType.pattern,
      userVector: userVec,
      dimensions,
    },
    hidden: {
      code: secondaryType.code,
      nickname: secondaryType.nickname,
      tagline: hiddenTagline,
    },
    illustration: {
      kind: 'preset-svg',
      id: primaryType.code,
      emoji: primaryType.emoji,
      illustrationUrl: primaryType.illustrationUrl ?? null,
      palette: primaryType.palette,
    },
    reading: { summary, highlights, references },
    consolidatedScores,
    textTags,
    meta: {
      generatedAt: new Date().toISOString(),
      llmModelId: PERSONA_MODEL_ID,
      degraded,
      versionKey,
      triggerKeyword,
    },
  };

  await saveCachedPersonaCard({
    cacheKey,
    source,
    sourceHash,
    payload,
  });

  return payload;
}

// ---------------------------------------------------------------------------
// Express route
// ---------------------------------------------------------------------------

export const personaCardRouter = express.Router();

async function canViewerAccessPersonaCard(viewerId: string, targetUserId: string): Promise<boolean> {
  if (viewerId === targetUserId) {
    return true;
  }

  const matchRow = await pool.get(
    `SELECT id
     FROM dating_matches
     WHERE (
       (user_a_id = $1 AND user_b_id = $2)
       OR (user_a_id = $2 AND user_b_id = $1)
     )
       AND (
         status = 'revealed'
         OR (
           match_type = 'instant'
           AND entry_state = 'instant_offer'
           AND offer_expires_at IS NOT NULL
           AND offer_expires_at > NOW()
         )
       )
     ORDER BY updated_at DESC
     LIMIT 1`,
    [viewerId, targetUserId],
  );

  return Boolean(matchRow?.id);
}

// 简易限流：每用户/session 30秒内只能调一次
const personaCardRateLimit = new Map<string, number>();

personaCardRouter.post('/questionnaire/persona-card', authenticateGatewayOrBearerIfPresent, async (req, res) => {
  try {
    const sessionId = typeof req.body?.session_id === 'string' ? req.body.session_id : '';
    const rateLimitKey = (req as any).user?.id ?? sessionId ?? 'anon';
    const now = Date.now();
    const lastCall = personaCardRateLimit.get(rateLimitKey) ?? 0;
    if (now - lastCall < 30_000) {
      return res.status(429).json({ error: '请稍后再试', code: 'RATE_LIMIT' });
    }
    personaCardRateLimit.set(rateLimitKey, now);
    if (personaCardRateLimit.size > 500) {
      const cutoff = now - 60_000;
      for (const [k, t] of personaCardRateLimit) { if (t < cutoff) personaCardRateLimit.delete(k); }
    }
    if (!sessionId) {
      return res.status(400).json({ error: '缺少 session_id' });
    }

    const session = await datingModel.getOnboardingSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: '答题会话已失效，请重新开始', code: 'ONBOARDING_SESSION_NOT_FOUND' });
    }

    const viewerId = (req as any).user?.id as string | undefined;
    const reviewAllowed = isReviewPreviewAllowed(req);

    if (viewerId) {
      if (!session.finalized_user_id || session.finalized_user_id !== viewerId) {
        return res.status(403).json({ error: '无权查看该人格卡片', code: 'PERSONA_CARD_FORBIDDEN' });
      }
      const payload = await generatePersonaCardForUser(viewerId);
      return res.json({ card: payload });
    }

    if (!reviewAllowed) {
      return res.status(401).json({ error: '未登录', code: 'PERSONA_CARD_AUTH_REQUIRED' });
    }

    const payload = await generatePersonaCardForSession(sessionId);
    return res.json({ card: payload });
  } catch (error) {
    const knownError = error as DatingError;
    if (knownError?.status) {
      return res.status(knownError.status).json({ error: knownError.message, code: knownError.code });
    }
    console.error('[persona-card] unexpected error', error);
    return res.status(500).json({ error: '生成人格卡片失败' });
  }
});

personaCardRouter.get('/users/:userId/persona-card', authenticateGatewayOrBearer, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ error: '缺少 userId' });
    }

    const viewerId = (req as any).user?.id as string | undefined;
    if (!viewerId) {
      return res.status(401).json({ error: '未登录' });
    }

    const allowed = await canViewerAccessPersonaCard(viewerId, userId);
    if (!allowed) {
      return res.status(403).json({ error: '无权查看该人格卡片', code: 'PERSONA_CARD_FORBIDDEN' });
    }

    const payload = await generatePersonaCardForUser(userId);
    return res.json({ card: payload });
  } catch (error) {
    const knownError = error as DatingError;
    if (knownError?.status) {
      // 404 → 该用户尚未生成卡片，前端按"未填问卷"处理
      return res.status(knownError.status).json({ error: knownError.message, code: knownError.code });
    }
    console.error('[persona-card] fetch by user failed', error);
    return res.status(500).json({ error: '获取人格卡片失败' });
  }
});
