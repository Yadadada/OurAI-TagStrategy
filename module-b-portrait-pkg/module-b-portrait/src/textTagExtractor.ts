/**
 * 文本标签抽取器
 *
 * 调用 Dashscope（OpenAI 兼容协议）从用户文本回答中提取结构化标签。
 * 输出格式为"固定主标签 + 半开放子标签"，带 weight 和 quote。
 *
 * 使用方式：
 *   const result = await extractTextTags('q19', '已读不回最受不了');
 *   // → { fieldId: 'q19', tags: [{main:'communication_breakdown', sub:'已读不回', weight:0.95, quote:'已读不回'}] }
 */

import {
  getTagTreeForField,
  getMainIdsForField,
  Q22_INTERACTION_MODES,
  type ExtractedTag,
  type Q22TagResult,
  type TextTagResult,
  type InteractionMode,
  type TagCategory,
} from './tagTree.js';

function getTagModelId(): string {
  return process.env.DATING_TAG_MODEL_ID
    || process.env.QWEN_TAG_MODEL_ID
    || 'qwen-plus';
}

// ---------------------------------------------------------------------------
// Prompt 构造
// ---------------------------------------------------------------------------

function buildTagTreeBlock(categories: TagCategory[]): string {
  return categories.map((cat) =>
    `- **${cat.id}**（${cat.label}）：${cat.description}\n  预设子标签：${cat.presetSubs.join('、')}`
  ).join('\n');
}

function buildQ22Prompt(text: string): string {
  const treeBlock = buildTagTreeBlock(getTagTreeForField('intro_prompt'));
  return [
    '你是一个标签抽取助手。根据用户对"第一次见面最希望一起做什么"的回答，提取结构化标签。',
    '',
    '## 场景主标签（必须从以下 5 个中选择）',
    treeBlock,
    '',
    '## 互动方式（可选，最多 1 个）',
    `- **strong**（强互动）：${Q22_INTERACTION_MODES.strong.description}，典型关键词：${Q22_INTERACTION_MODES.strong.keywords.join('、')}`,
    `- **weak**（弱互动）：${Q22_INTERACTION_MODES.weak.description}，典型关键词：${Q22_INTERACTION_MODES.weak.keywords.join('、')}`,
    '- 如果文本中没有明确的互动意图，interaction_mode 填 null',
    '',
    '## 输出规则',
    '1. scene_tags：1-3 个场景标签，每个必须包含 main（主标签 ID）、sub（子标签，优先用预设的，也可以新建）、weight（0-1，突出程度）、quote（原文依据，必须是用户原话的片段）',
    '2. interaction_mode："strong" 或 "weak" 或 null',
    '3. 如果用户文本为空、无意义（"没有""无""不知道"等），返回空数组',
    '4. 输出严格 JSON，不要解释',
    '',
    '## 输出格式',
    '{"scene_tags":[{"main":"主标签ID","sub":"子标签","weight":0.9,"quote":"原文片段"}],"interaction_mode":"strong"|"weak"|null}',
    '',
    `## 用户回答\n${text}`,
  ].join('\n');
}

function buildQ23Q24Prompt(fieldId: 'q19' | 'q20', text: string): string {
  const treeBlock = buildTagTreeBlock(getTagTreeForField(fieldId));
  const fieldLabel = fieldId === 'q19'
    ? '你最受不了一段关系里出现什么状态'
    : '对对方的补充要求';

  return [
    `你是一个标签抽取助手。根据用户对"${fieldLabel}"的回答，提取结构化标签。`,
    '',
    '## 主标签（必须从以下列表中选择）',
    treeBlock,
    '',
    '## 输出规则',
    '1. tags：1-3 个标签，每个必须包含 main（主标签 ID）、sub（子标签，优先用预设的，也可以新建）、weight（0-1，突出程度）、quote（原文依据，必须是用户原话的片段）',
    '2. 如果用户文本为空、无意义（"没有""无""不知道""都行"等），返回空数组',
    '3. weight 说明：如果文本只表达了一个意思，该标签 weight 为 0.9-1.0；多个意思时按突出程度分配',
    '4. 输出严格 JSON，不要解释',
    '',
    '## 输出格式',
    '{"tags":[{"main":"主标签ID","sub":"子标签","weight":0.9,"quote":"原文片段"}]}',
    '',
    `## 用户回答\n${text}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// LLM 调用
// ---------------------------------------------------------------------------

async function callTagLlm(prompt: string): Promise<string | null> {
  const apiKey = process.env.QWEN_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[text-tag-extractor] QWEN_API_KEY not configured');
    return null;
  }
  const baseUrl = (process.env.QWEN_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getTagModelId(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[text-tag-extractor] LLM error', res.status, errText.slice(0, 200));
      return null;
    }
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error('[text-tag-extractor] LLM call failed', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// JSON 解析 + 校验
// ---------------------------------------------------------------------------

function parseTagJson(raw: string, validMainIds: string[]): ExtractedTag[] {
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end < 0) return [];
    const parsed = JSON.parse(trimmed.slice(start, end + 1));

    const rawTags: unknown[] = Array.isArray(parsed.tags) ? parsed.tags
      : Array.isArray(parsed.scene_tags) ? parsed.scene_tags
      : [];

    const result: ExtractedTag[] = [];
    for (const item of rawTags) {
      if (!item || typeof item !== 'object') continue;
      const t = item as Record<string, unknown>;
      const main = typeof t.main === 'string' ? t.main : '';
      const sub = typeof t.sub === 'string' ? t.sub : '';
      const weight = typeof t.weight === 'number' ? Math.max(0, Math.min(1, t.weight)) : 0.5;
      const quote = typeof t.quote === 'string' ? t.quote : '';

      if (!main || !validMainIds.includes(main)) continue;
      if (!sub) continue;

      result.push({ main, sub: sub.slice(0, 20), weight, quote: quote.slice(0, 60) });
    }
    return result.slice(0, 3);
  } catch {
    return [];
  }
}

function parseInteractionMode(raw: string): InteractionMode {
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end < 0) return null;
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    const mode = parsed.interaction_mode;
    if (mode === 'strong' || mode === 'weak') return mode;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 规则降级：无 API key 时用关键词匹配做简易标签
// ---------------------------------------------------------------------------

function fallbackQ22(text: string): Q22TagResult {
  const tags: ExtractedTag[] = [];
  const tree = getTagTreeForField('intro_prompt');

  for (const cat of tree) {
    for (const sub of cat.presetSubs) {
      if (text.includes(sub)) {
        tags.push({ main: cat.id, sub, weight: 0.8, quote: text.slice(0, 40) });
        break;
      }
    }
    if (tags.length >= 2) break;
  }

  let interactionMode: InteractionMode = null;
  if (Q22_INTERACTION_MODES.strong.keywords.some((kw) => text.includes(kw))) {
    interactionMode = 'strong';
  } else if (Q22_INTERACTION_MODES.weak.keywords.some((kw) => text.includes(kw))) {
    interactionMode = 'weak';
  }

  return {
    fieldId: 'intro_prompt',
    rawText: text,
    sceneTags: tags.slice(0, 3),
    interactionMode,
    extractedAt: new Date().toISOString(),
    modelId: 'fallback-keyword',
  };
}

function fallbackQ23Q24(fieldId: 'q19' | 'q20', text: string): TextTagResult {
  const tags: ExtractedTag[] = [];
  const tree = getTagTreeForField(fieldId);

  for (const cat of tree) {
    for (const sub of cat.presetSubs) {
      if (text.includes(sub)) {
        tags.push({ main: cat.id, sub, weight: 0.8, quote: text.slice(0, 40) });
        break;
      }
    }
    if (tags.length >= 2) break;
  }

  return {
    fieldId,
    rawText: text,
    tags: tags.slice(0, 3),
    extractedAt: new Date().toISOString(),
    modelId: 'fallback-keyword',
  };
}

// ---------------------------------------------------------------------------
// 公开 API
// ---------------------------------------------------------------------------

const EMPTY_TEXT_PATTERNS = /^(没有|无|不知道|没想好|都行|随便|无所谓|没啥|\.+|。+)\s*$/;

export async function extractQ22Tags(text: string): Promise<Q22TagResult> {
  const trimmed = (text ?? '').trim();
  if (!trimmed || EMPTY_TEXT_PATTERNS.test(trimmed)) {
    return {
      fieldId: 'intro_prompt',
      rawText: trimmed,
      sceneTags: [],
      interactionMode: null,
      extractedAt: new Date().toISOString(),
      modelId: 'skip-empty',
    };
  }

  const apiKey = process.env.QWEN_API_KEY?.trim();
  if (!apiKey) return fallbackQ22(trimmed);

  const prompt = buildQ22Prompt(trimmed);
  const raw = await callTagLlm(prompt);
  if (!raw) return fallbackQ22(trimmed);

  const sceneTags = parseTagJson(raw, getMainIdsForField('intro_prompt'));
  const interactionMode = parseInteractionMode(raw);

  if (sceneTags.length === 0) return fallbackQ22(trimmed);

  return {
    fieldId: 'intro_prompt',
    rawText: trimmed,
    sceneTags,
    interactionMode,
    extractedAt: new Date().toISOString(),
    modelId: getTagModelId(),
  };
}

export async function extractQ23Q24Tags(fieldId: 'q19' | 'q20', text: string): Promise<TextTagResult> {
  const trimmed = (text ?? '').trim();
  if (!trimmed || EMPTY_TEXT_PATTERNS.test(trimmed)) {
    return {
      fieldId,
      rawText: trimmed,
      tags: [],
      extractedAt: new Date().toISOString(),
      modelId: 'skip-empty',
    };
  }

  const apiKey = process.env.QWEN_API_KEY?.trim();
  if (!apiKey) return fallbackQ23Q24(fieldId, trimmed);

  const prompt = buildQ23Q24Prompt(fieldId, trimmed);
  const raw = await callTagLlm(prompt);
  if (!raw) return fallbackQ23Q24(fieldId, trimmed);

  const tags = parseTagJson(raw, getMainIdsForField(fieldId));
  if (tags.length === 0) return fallbackQ23Q24(fieldId, trimmed);

  return {
    fieldId,
    rawText: trimmed,
    tags,
    extractedAt: new Date().toISOString(),
    modelId: getTagModelId(),
  };
}

/**
 * 一次性提取三个文本字段的标签。
 * 三个字段并行调用，任一失败不影响其他。
 */
export async function extractAllTextTags(texts: {
  intro_prompt?: string;
  q19?: string;
  q20?: string;
}): Promise<{
  q22: Q22TagResult;
  q23: TextTagResult;
  q24: TextTagResult;
}> {
  const [q22, q23, q24] = await Promise.all([
    extractQ22Tags(texts.intro_prompt ?? ''),
    extractQ23Q24Tags('q19', texts.q19 ?? ''),
    extractQ23Q24Tags('q20', texts.q20 ?? ''),
  ]);
  return { q22, q23, q24 };
}
