/**
 * 评测数据集扩充脚本
 *
 * 用 LLM + few-shot 把每字段从 ~15 条种子扩到 ~85 条。
 * 按 (main, category) 网格逐点生成，强制多样性。
 *
 * 运行方式：
 *   npx tsx scripts/expand-dataset.ts                       # 三个字段全跑
 *   npx tsx scripts/expand-dataset.ts --field q22           # 只跑 Q22
 *   npx tsx scripts/expand-dataset.ts --field q22 --target 5 --dry  # 试跑 5 条
 *
 * 输出：
 *   eval/q22_expanded.jsonl 等：新生成样本（不含种子）
 *   eval/expansion-log/{field}-{ts}.json：每次 LLM 调用的 raw 记录
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// 加载 .env
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const envPath = resolve(projectRoot, '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch {}

const { Q22_SCENE_TAGS, Q23_TAGS, Q24_TAGS, Q22_INTERACTION_MODES } = await import('../src/tagTree.js');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const fieldFilter = args.includes('--field') ? args[args.indexOf('--field') + 1] : null;
const targetOverride = args.includes('--target') ? Number(args[args.indexOf('--target') + 1]) : null;
const dryRun = args.includes('--dry');

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------
type Category = 'normal' | 'longtail' | 'boundary' | 'perturbation' | 'empty';
type FieldId = 'q22' | 'q23' | 'q24';

interface SeedSample {
  id: string;
  text: string;
  expected_main: string[];
  expected_interaction?: 'strong' | 'weak' | null;
  expected_sub_keywords?: string[];
  should_skip: boolean;
  category: Category;
  note?: string;
}

interface FieldConfig {
  fieldId: FieldId;
  seedFile: string;
  outputFile: string;
  mainTags: { id: string; label: string; description: string; presetSubs: string[] }[];
  hasInteraction: boolean;
  fieldQuestion: string;
}

const FIELD_CONFIGS: Record<FieldId, FieldConfig> = {
  q22: {
    fieldId: 'q22',
    seedFile: 'q22_seeds.jsonl',
    outputFile: 'q22_expanded.jsonl',
    mainTags: Q22_SCENE_TAGS,
    hasInteraction: true,
    fieldQuestion: '第一次见面最希望一起做什么',
  },
  q23: {
    fieldId: 'q23',
    seedFile: 'q23_seeds.jsonl',
    outputFile: 'q23_expanded.jsonl',
    mainTags: Q23_TAGS,
    hasInteraction: false,
    fieldQuestion: '你最受不了一段关系里出现什么状态',
  },
  q24: {
    fieldId: 'q24',
    seedFile: 'q24_seeds.jsonl',
    outputFile: 'q24_expanded.jsonl',
    mainTags: Q24_TAGS,
    hasInteraction: false,
    fieldQuestion: '对对方的补充要求',
  },
};

// ---------------------------------------------------------------------------
// 网格分布（按用户拍板：normal 60% / longtail 20% / boundary 10% / perturbation 10%）
// empty 不靠 LLM 生成，用种子里已有的就够
// ---------------------------------------------------------------------------
const CATEGORY_RATIOS = {
  normal: 0.6,
  longtail: 0.2,
  boundary: 0.1,
  perturbation: 0.1,
};

function planGrid(fieldConfig: FieldConfig, totalNew: number): Array<{ mainId: string; category: Category; count: number }> {
  const grid: Array<{ mainId: string; category: Category; count: number }> = [];
  const mains = fieldConfig.mainTags.map((t) => t.id);

  for (const cat of Object.keys(CATEGORY_RATIOS) as Array<keyof typeof CATEGORY_RATIOS>) {
    const catTotal = Math.round(totalNew * CATEGORY_RATIOS[cat]);
    if (cat === 'boundary') {
      // boundary 跨两个 main，单独按 boundary 整体生成（不绑定 mainId）
      grid.push({ mainId: '__boundary__', category: cat, count: catTotal });
      continue;
    }
    // 其余按 main 平均分摊
    const perMain = Math.max(1, Math.round(catTotal / mains.length));
    for (const m of mains) {
      grid.push({ mainId: m, category: cat, count: perMain });
    }
  }
  return grid;
}

// ---------------------------------------------------------------------------
// 读种子
// ---------------------------------------------------------------------------
function loadSeeds(filename: string): SeedSample[] {
  const path = resolve(projectRoot, 'eval', filename);
  const content = readFileSync(path, 'utf-8');
  const samples: SeedSample[] = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      samples.push(JSON.parse(trimmed));
    } catch {}
  }
  return samples;
}

// ---------------------------------------------------------------------------
// few-shot 选样：优先选同 (main, category)，凑不够再放宽到同 main 或同 category
// ---------------------------------------------------------------------------
function pickFewShot(seeds: SeedSample[], targetMain: string, targetCat: Category, n: number): SeedSample[] {
  const exact = seeds.filter((s) => s.expected_main.includes(targetMain) && s.category === targetCat);
  const sameMain = seeds.filter((s) => s.expected_main.includes(targetMain) && s.category !== targetCat);
  const sameCat = seeds.filter((s) => !s.expected_main.includes(targetMain) && s.category === targetCat);
  const pool = [...exact, ...sameMain, ...sameCat];
  // 简单乱序取前 n
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

function pickBoundaryFewShot(seeds: SeedSample[], n: number): SeedSample[] {
  const boundary = seeds.filter((s) => s.category === 'boundary');
  const others = seeds.filter((s) => s.category !== 'boundary' && !s.should_skip).slice(0, 3);
  return [...boundary, ...others].slice(0, n);
}

// ---------------------------------------------------------------------------
// Prompt 构造
// ---------------------------------------------------------------------------
function buildExpansionPrompt(
  fieldConfig: FieldConfig,
  targetMain: string,
  targetCat: Category,
  fewShot: SeedSample[],
  count: number,
): string {
  const mainTagsBlock = fieldConfig.mainTags.map((t) =>
    `- ${t.id}（${t.label}）：${t.description}\n  典型子标签：${t.presetSubs.slice(0, 6).join('、')}`
  ).join('\n');

  const targetMainBlock = targetMain === '__boundary__'
    ? '横跨两个不同主标签（同时涉及两个范畴）'
    : (() => {
        const t = fieldConfig.mainTags.find((x) => x.id === targetMain);
        return t ? `${t.id}（${t.label}）：${t.description}` : targetMain;
      })();

  const categoryGuide: Record<Category, string> = {
    normal: '日常表达，用词常见，意图清晰。校园场景、口语化、10-30 字。',
    longtail: '使用网络流行语、亚文化词、新造词或跨领域表达（如 citywalk、探店、爹味、INFP、中央空调等同类风格的词）。这是评估 LLM 语义理解能力的关键样本，**必须用真实在用的网络热词，不要编造生僻词**。',
    boundary: '同时横跨两个不同主标签，让标签抽取需要返回两个 main。',
    perturbation: '带否定词、反问、转折、双重否定等扰动结构（如"不想…"、"别…就行"、"虽然…但是…"），但语义指向主标签依然清晰。',
    empty: '空回答或无意义敷衍（不在本任务范围内）',
  };

  const fewShotBlock = fewShot.map((s, i) => {
    const meta: string[] = [];
    meta.push(`expected_main: ${JSON.stringify(s.expected_main)}`);
    if (fieldConfig.hasInteraction && s.expected_interaction !== undefined) {
      meta.push(`expected_interaction: ${JSON.stringify(s.expected_interaction)}`);
    }
    if (s.expected_sub_keywords && s.expected_sub_keywords.length > 0) {
      meta.push(`expected_sub_keywords: ${JSON.stringify(s.expected_sub_keywords)}`);
    }
    meta.push(`category: ${s.category}`);
    return `示例 ${i + 1}：\n  text: "${s.text}"\n  ${meta.join('\n  ')}\n  note: ${s.note ?? ''}`;
  }).join('\n\n');

  const interactionRule = fieldConfig.hasInteraction
    ? `\n4. expected_interaction 必填，按以下规则判定：
   - "strong"：满足任一条件即可
     a) 文本含聊天/分享/谈心/深聊/认识彼此等对话信号词
     b) 两人协作或对抗型运动（羽毛球、网球、乒乓球、双打、对打 等需要双方持续配合）
   - "weak"：明确表达"安静/各做各的/不用说太多话"等弱互动；或"一起自习/一起写代码"这类各做各的学习共处
   - null：以上都不沾——例如单人或多人非协作运动（一起跑步、各自健身、爬山、骑行、打篮球、踢足球）、看电影/展览/桌游 等没有明确互动信号的活动
   注意："一起去打羽毛球"=strong（双人对打），"一起去跑步"=null（并排跑、不需配合），"一起看电影"=null（没明确互动）`
    : '';

  return [
    `你是一个评测数据生成助手。任务：为问卷字段"${fieldConfig.fieldQuestion}"生成 ${count} 条新的种子样本，用于评估文本标签抽取算法的准确率。`,
    '',
    '## 字段的全部主标签（仅供你理解语义边界，本次只生成下面"目标主标签"指定范畴的样本）',
    mainTagsBlock,
    '',
    `## 本次目标主标签`,
    targetMainBlock,
    '',
    `## 本次目标类别（category）：${targetCat}`,
    categoryGuide[targetCat],
    '',
    '## 已有的示例样本（参考风格、用词、长度、标注逻辑）',
    fewShotBlock,
    '',
    '## 生成要求',
    `1. 严格生成 ${count} 条样本，每条都要属于"目标主标签 + 目标 category"`,
    '2. text 字段：用户口吻的简短回答（5-30 字，校园学生常见表达），**不要和示例 text 完全相同或几乎一致**',
    '3. expected_main：' + (targetMain === '__boundary__'
        ? '从主标签列表里选择 2 个不同的 id，必须真的同时涉及'
        : `必须只包含 ["${targetMain}"]`),
    interactionRule,
    `5. expected_sub_keywords：从 text 中可以匹配到的关键词片段（用于评测时的 substring 匹配），**必须是 text 中真实出现的子串**`,
    '6. should_skip：false（empty 类别不在本次任务范围）',
    `7. category：必须是 "${targetCat}"`,
    '8. note：简短一句话说明为什么这样标',
    '',
    '## 输出格式（严格 JSON，不要 markdown 代码块）',
    '{"samples":[{"text":"...","expected_main":[...],' + (fieldConfig.hasInteraction ? '"expected_interaction":...,' : '') + '"expected_sub_keywords":[...],"should_skip":false,"category":"...","note":"..."}]}',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// LLM 调用（生成阶段 temperature 拉到 0.8 求多样性）
// ---------------------------------------------------------------------------
function getModelId(): string {
  return process.env.DATING_TAG_MODEL_ID || process.env.QWEN_TAG_MODEL_ID || 'qwen-plus';
}

async function callLlm(prompt: string): Promise<string | null> {
  const apiKey = process.env.QWEN_API_KEY?.trim();
  if (!apiKey) {
    console.error('[expand] QWEN_API_KEY 未配置，无法生成');
    return null;
  }
  const baseUrl = (process.env.QWEN_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1').replace(/\/+$/, '');
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
        model: getModelId(),
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[expand] LLM error', res.status, errText.slice(0, 300));
      return null;
    }
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error('[expand] LLM call failed', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// JSON 解析
// ---------------------------------------------------------------------------
function parseSamples(raw: string, hasInteraction: boolean): Partial<SeedSample>[] {
  try {
    const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end < 0) return [];
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (!Array.isArray(parsed.samples)) return [];

    const result: Partial<SeedSample>[] = [];
    for (const item of parsed.samples) {
      if (!item || typeof item !== 'object') continue;
      const text = typeof item.text === 'string' ? item.text.trim() : '';
      if (!text) continue;
      const expected_main = Array.isArray(item.expected_main) ? item.expected_main.filter((x: any) => typeof x === 'string') : [];
      const expected_sub_keywords = Array.isArray(item.expected_sub_keywords) ? item.expected_sub_keywords.filter((x: any) => typeof x === 'string') : [];
      const category = typeof item.category === 'string' ? item.category as Category : 'normal';
      const note = typeof item.note === 'string' ? item.note : '';

      const sample: Partial<SeedSample> = {
        text,
        expected_main,
        expected_sub_keywords,
        should_skip: false,
        category,
        note,
      };
      if (hasInteraction) {
        const intr = item.expected_interaction;
        sample.expected_interaction = intr === 'strong' || intr === 'weak' ? intr : null;
      }
      result.push(sample);
    }
    return result;
  } catch (e) {
    console.error('[expand] JSON 解析失败', e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 去重：normalized text 完全相同 / 前 8 字相同
// ---------------------------------------------------------------------------
function normalize(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

function dedupAgainst(newOnes: Partial<SeedSample>[], existing: Set<string>): Partial<SeedSample>[] {
  const out: Partial<SeedSample>[] = [];
  for (const s of newOnes) {
    const txt = s.text!;
    const norm = normalize(txt);
    if (!norm) continue;
    const head = norm.slice(0, 8);
    if (existing.has(norm)) continue;
    let dup = false;
    for (const e of existing) {
      if (e.length < 4) continue;  // 跳过太短的串（如空字符串、单字"无"），避免 startsWith 误判
      const eHead = e.slice(0, 8);
      if (e.startsWith(head) || norm.startsWith(eHead)) { dup = true; break; }
    }
    if (dup) continue;
    existing.add(norm);
    out.push(s);
  }
  return out;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
async function expandField(fieldId: FieldId, target: number): Promise<Partial<SeedSample>[]> {
  const config = FIELD_CONFIGS[fieldId];
  const seeds = loadSeeds(config.seedFile);
  console.log(`\n[${fieldId}] 加载种子 ${seeds.length} 条`);

  const seedNorm = new Set(seeds.map((s) => normalize(s.text)));
  const seedNonEmptyCount = seeds.filter((s) => !s.should_skip).length;
  const newTotal = Math.max(0, target - seedNonEmptyCount);
  console.log(`[${fieldId}] 目标总数 ${target}，已有非空 ${seedNonEmptyCount}，需新增 ${newTotal}`);

  if (newTotal === 0) return [];

  const grid = planGrid(config, newTotal);
  console.log(`[${fieldId}] 网格规划：${grid.length} 个生成点，合计 ${grid.reduce((s, g) => s + g.count, 0)} 条`);

  const all: Partial<SeedSample>[] = [];
  const logDir = resolve(projectRoot, 'eval', 'expansion-log');
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logPath = resolve(logDir, `${fieldId}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.jsonl`);

  for (const point of grid) {
    if (point.count <= 0) continue;
    // 一次最多 5 条，超过分批
    const batches: number[] = [];
    let remaining = point.count;
    while (remaining > 0) {
      const b = Math.min(5, remaining);
      batches.push(b);
      remaining -= b;
    }

    for (const batchSize of batches) {
      const fewShot = point.mainId === '__boundary__'
        ? pickBoundaryFewShot(seeds, 4)
        : pickFewShot(seeds, point.mainId, point.category, 3);

      const prompt = buildExpansionPrompt(config, point.mainId, point.category, fewShot, batchSize);
      process.stdout.write(`  [${fieldId}] ${point.mainId} / ${point.category} × ${batchSize} ...`);

      if (dryRun) {
        process.stdout.write(' (dry, skip)\n');
        continue;
      }

      const raw = await callLlm(prompt);
      appendFileSync(logPath, JSON.stringify({ point, batchSize, prompt, raw, ts: new Date().toISOString() }) + '\n', 'utf-8');

      if (!raw) {
        process.stdout.write(' ✗ LLM 失败\n');
        continue;
      }
      const parsed = parseSamples(raw, config.hasInteraction);
      const deduped = dedupAgainst(parsed, seedNorm);
      all.push(...deduped);
      process.stdout.write(` 解析 ${parsed.length} / 入库 ${deduped.length}\n`);
    }
  }

  return all;
}

function writeExpanded(fieldId: FieldId, samples: Partial<SeedSample>[]): void {
  const config = FIELD_CONFIGS[fieldId];
  const path = resolve(projectRoot, 'eval', config.outputFile);
  const lines: string[] = [];
  let idx = 1;
  for (const s of samples) {
    const id = `${fieldId}-exp-${String(idx).padStart(3, '0')}`;
    idx++;
    lines.push(JSON.stringify({ id, ...s }));
  }
  writeFileSync(path, lines.join('\n') + (lines.length ? '\n' : ''), 'utf-8');
  console.log(`[${fieldId}] 写入 ${samples.length} 条到 ${path}`);
}

async function main() {
  console.log('=== 评测数据集扩充 ===');
  console.log(`模型: ${getModelId()}`);
  console.log(`Base URL: ${process.env.QWEN_BASE_URL || '(default)'}`);
  console.log(`API Key: ${process.env.QWEN_API_KEY ? '已配置' : '未配置'}`);
  console.log(`Dry run: ${dryRun}`);

  const fields: FieldId[] = fieldFilter ? [fieldFilter as FieldId] : ['q22', 'q23', 'q24'];
  const defaultTarget = 85;
  const target = targetOverride ?? defaultTarget;

  for (const fieldId of fields) {
    if (!FIELD_CONFIGS[fieldId]) {
      console.error(`未知字段：${fieldId}`);
      continue;
    }
    const samples = await expandField(fieldId, target);
    if (!dryRun) writeExpanded(fieldId, samples);
  }

  console.log('\n完成。下一步：运行 npx tsx scripts/audit-sample.ts --field <id> 抽检 10%。');
}

main().catch((err) => {
  console.error('扩充失败：', err);
  process.exit(1);
});
