/**
 * 文本标签抽取评测脚本
 *
 * 读取 eval/ 下的种子样本，跑抽取函数，按 category 分桶计算指标。
 * 输出 Markdown 报告（控制台 + 文件）+ JSON 原始结果（供后续 prompt 调优对比）。
 *
 * 运行方式：
 *   npx tsx scripts/run-eval.ts                # 默认跑所有字段
 *   npx tsx scripts/run-eval.ts --field q22    # 只跑 Q22
 *   npx tsx scripts/run-eval.ts --no-llm       # 强制走 fallback（不调 LLM）
 *
 * 输出位置：
 *   eval/results/report-{timestamp}.md
 *   eval/results/raw-{timestamp}.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// 加载 .env（必须在 import extractor 之前）
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

// 解析 CLI 参数
const args = process.argv.slice(2);
const fieldFilter = args.includes('--field') ? args[args.indexOf('--field') + 1] : null;
const noLlm = args.includes('--no-llm');

if (noLlm) {
  // 强制清空 API Key 触发 fallback 路径
  delete process.env.QWEN_API_KEY;
}

const { extractQ22Tags, extractQ23Q24Tags } = await import('../src/textTagExtractor.js');

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

interface SeedSample {
  id: string;
  text: string;
  expected_main: string[];
  expected_interaction?: 'strong' | 'weak' | null;
  expected_sub_keywords?: string[];
  should_skip: boolean;
  category: 'normal' | 'longtail' | 'boundary' | 'empty' | 'perturbation';
  note?: string;
}

interface EvalRecord {
  sample: SeedSample;
  fieldId: 'q22' | 'q23' | 'q24';
  extractedMains: string[];
  extractedSubs: string[];
  extractedInteraction: 'strong' | 'weak' | null;
  modelId: string;
  latencyMs: number;
  mainCorrect: boolean;
  subCorrect: boolean;
  interactionCorrect: boolean | null;
  emptyJudgmentCorrect: boolean;
}

// ---------------------------------------------------------------------------
// 读取种子样本
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
    } catch (e) {
      console.warn(`[warn] 解析失败：${filename} 行 "${trimmed.slice(0, 60)}"`);
    }
  }
  return samples;
}

// ---------------------------------------------------------------------------
// 评测核心：四个指标
// ---------------------------------------------------------------------------

/** 主标签准确率：抽取的 main 任一命中 expected_main 即对；空判时双方都为空才对 */
function evalMain(extracted: string[], expected: string[]): boolean {
  if (expected.length === 0) {
    return extracted.length === 0;
  }
  return extracted.some((m) => expected.includes(m));
}

/** 子标签宽松命中：substring 双向匹配；expected 为空则不计入（返回 true） */
function evalSub(extractedSubs: string[], expectedKeywords: string[]): boolean {
  if (!expectedKeywords || expectedKeywords.length === 0) return true;
  for (const kw of expectedKeywords) {
    for (const sub of extractedSubs) {
      if (sub.includes(kw) || kw.includes(sub)) return true;
    }
  }
  return false;
}

/** 互动维度准确率（仅 Q22）：三值严格相等 */
function evalInteraction(
  extracted: 'strong' | 'weak' | null,
  expected: 'strong' | 'weak' | null | undefined,
): boolean | null {
  if (expected === undefined) return null;
  return extracted === expected;
}

/** 空判召回：仅在 should_skip:true 时计算，要求抽取结果为空 */
function evalEmptyJudgment(sample: SeedSample, extractedMains: string[]): boolean {
  if (!sample.should_skip) return true;
  return extractedMains.length === 0;
}

// ---------------------------------------------------------------------------
// 执行抽取（按字段分发）
// ---------------------------------------------------------------------------

async function runExtraction(
  fieldId: 'q22' | 'q23' | 'q24',
  text: string,
): Promise<{
  mains: string[];
  subs: string[];
  interaction: 'strong' | 'weak' | null;
  modelId: string;
  latencyMs: number;
}> {
  const start = Date.now();

  if (fieldId === 'q22') {
    const result = await extractQ22Tags(text);
    return {
      mains: result.sceneTags.map((t) => t.main),
      subs: result.sceneTags.map((t) => t.sub),
      interaction: result.interactionMode,
      modelId: result.modelId,
      latencyMs: Date.now() - start,
    };
  }

  const innerFieldId = fieldId === 'q23' ? 'q19' : 'q20';
  const result = await extractQ23Q24Tags(innerFieldId, text);
  return {
    mains: result.tags.map((t) => t.main),
    subs: result.tags.map((t) => t.sub),
    interaction: null,
    modelId: result.modelId,
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// 跑完一个字段，返回所有评测记录
// ---------------------------------------------------------------------------

async function evalField(
  fieldId: 'q22' | 'q23' | 'q24',
  filename: string,
): Promise<EvalRecord[]> {
  const samples = loadSeeds(filename);
  console.log(`\n[${fieldId.toUpperCase()}] 加载 ${samples.length} 条种子样本（${filename}）`);

  const records: EvalRecord[] = [];
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    process.stdout.write(`  跑样本 ${i + 1}/${samples.length} (${s.id})...`);
    const ext = await runExtraction(fieldId, s.text);

    const mainCorrect = evalMain(ext.mains, s.expected_main);
    const subCorrect = evalSub(ext.subs, s.expected_sub_keywords ?? []);
    const interactionCorrect = fieldId === 'q22' ? evalInteraction(ext.interaction, s.expected_interaction) : null;
    const emptyJudgmentCorrect = evalEmptyJudgment(s, ext.mains);

    records.push({
      sample: s,
      fieldId,
      extractedMains: ext.mains,
      extractedSubs: ext.subs,
      extractedInteraction: ext.interaction,
      modelId: ext.modelId,
      latencyMs: ext.latencyMs,
      mainCorrect,
      subCorrect,
      interactionCorrect,
      emptyJudgmentCorrect,
    });

    process.stdout.write(` ${mainCorrect ? '✓' : '✗'} (${ext.latencyMs}ms, ${ext.modelId})\n`);
  }

  return records;
}

// ---------------------------------------------------------------------------
// 聚合统计：按 category 分桶
// ---------------------------------------------------------------------------

interface FieldSummary {
  fieldId: string;
  total: number;
  mainAcc: { correct: number; total: number; ratio: number };
  subAcc: { correct: number; total: number; ratio: number };
  emptyRecall: { correct: number; total: number; ratio: number };
  interactionAcc: { correct: number; total: number; ratio: number } | null;
  byCategory: Record<string, {
    total: number;
    mainCorrect: number;
    mainAcc: number;
  }>;
  byModel: Record<string, number>;
  avgLatencyMs: number;
  errors: EvalRecord[];
}

function summarize(records: EvalRecord[]): FieldSummary {
  const fieldId = records[0]?.fieldId ?? '';
  const total = records.length;

  const mainCorrectCount = records.filter((r) => r.mainCorrect).length;
  const subEvaluable = records.filter((r) => (r.sample.expected_sub_keywords ?? []).length > 0);
  const subCorrectCount = subEvaluable.filter((r) => r.subCorrect).length;

  const emptyEvaluable = records.filter((r) => r.sample.should_skip);
  const emptyCorrectCount = emptyEvaluable.filter((r) => r.emptyJudgmentCorrect).length;

  let interactionAcc: FieldSummary['interactionAcc'] = null;
  if (fieldId === 'q22') {
    const interEvaluable = records.filter((r) => r.interactionCorrect !== null);
    const interCorrect = interEvaluable.filter((r) => r.interactionCorrect === true).length;
    interactionAcc = {
      correct: interCorrect,
      total: interEvaluable.length,
      ratio: interEvaluable.length > 0 ? interCorrect / interEvaluable.length : 0,
    };
  }

  const byCategory: FieldSummary['byCategory'] = {};
  for (const r of records) {
    const cat = r.sample.category;
    if (!byCategory[cat]) byCategory[cat] = { total: 0, mainCorrect: 0, mainAcc: 0 };
    byCategory[cat].total++;
    if (r.mainCorrect) byCategory[cat].mainCorrect++;
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].mainAcc = byCategory[cat].mainCorrect / byCategory[cat].total;
  }

  const byModel: Record<string, number> = {};
  for (const r of records) {
    byModel[r.modelId] = (byModel[r.modelId] ?? 0) + 1;
  }

  const avgLatencyMs = records.reduce((sum, r) => sum + r.latencyMs, 0) / total;

  const errors = records.filter((r) => !r.mainCorrect);

  return {
    fieldId,
    total,
    mainAcc: { correct: mainCorrectCount, total, ratio: mainCorrectCount / total },
    subAcc: {
      correct: subCorrectCount,
      total: subEvaluable.length,
      ratio: subEvaluable.length > 0 ? subCorrectCount / subEvaluable.length : 0,
    },
    emptyRecall: {
      correct: emptyCorrectCount,
      total: emptyEvaluable.length,
      ratio: emptyEvaluable.length > 0 ? emptyCorrectCount / emptyEvaluable.length : 0,
    },
    interactionAcc,
    byCategory,
    byModel,
    avgLatencyMs,
    errors,
  };
}

// ---------------------------------------------------------------------------
// 报告输出（Markdown）
// ---------------------------------------------------------------------------

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function renderSummary(s: FieldSummary): string {
  const lines: string[] = [];
  lines.push(`## ${s.fieldId.toUpperCase()} 评测结果`);
  lines.push('');
  lines.push(`- 样本总数：${s.total}`);
  lines.push(`- 平均耗时：${s.avgLatencyMs.toFixed(0)}ms`);
  lines.push(`- modelId 分布：${Object.entries(s.byModel).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  lines.push('');
  lines.push('### 核心指标');
  lines.push('');
  lines.push('| 指标 | 命中 / 总数 | 准确率 |');
  lines.push('|---|---|---|');
  lines.push(`| 主标签准确率 | ${s.mainAcc.correct}/${s.mainAcc.total} | **${pct(s.mainAcc.ratio)}** |`);
  lines.push(`| 子标签宽松命中率 | ${s.subAcc.correct}/${s.subAcc.total} | ${pct(s.subAcc.ratio)} |`);
  lines.push(`| 空判召回率 | ${s.emptyRecall.correct}/${s.emptyRecall.total} | ${pct(s.emptyRecall.ratio)} |`);
  if (s.interactionAcc) {
    lines.push(`| 互动维度准确率 | ${s.interactionAcc.correct}/${s.interactionAcc.total} | ${pct(s.interactionAcc.ratio)} |`);
  }
  lines.push('');
  lines.push('### 按 category 分桶（主标签准确率）');
  lines.push('');
  lines.push('| category | 命中 / 总数 | 准确率 |');
  lines.push('|---|---|---|');
  for (const [cat, info] of Object.entries(s.byCategory)) {
    lines.push(`| ${cat} | ${info.mainCorrect}/${info.total} | ${pct(info.mainAcc)} |`);
  }
  lines.push('');

  if (s.errors.length > 0) {
    lines.push('### 错误样本明细');
    lines.push('');
    for (const r of s.errors) {
      lines.push(`- **${r.sample.id}** \`${r.sample.text}\` (category: ${r.sample.category})`);
      lines.push(`  - expected_main: \`${JSON.stringify(r.sample.expected_main)}\``);
      lines.push(`  - extracted: \`${JSON.stringify(r.extractedMains)}\``);
      if (r.sample.note) lines.push(`  - note: ${r.sample.note}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== 文本标签抽取评测 ===');
  console.log(`模型: ${process.env.DATING_TAG_MODEL_ID || process.env.QWEN_TAG_MODEL_ID || 'qwen-plus'}`);
  console.log(`Base URL: ${process.env.QWEN_BASE_URL || '(default)'}`);
  console.log(`API Key: ${process.env.QWEN_API_KEY ? '已配置' : '未配置（走 fallback）'}`);
  console.log(`字段过滤: ${fieldFilter ?? '全部'}`);
  console.log(`强制 fallback: ${noLlm ? '是' : '否'}`);

  const fieldsToRun: { fieldId: 'q22' | 'q23' | 'q24'; filename: string }[] = [
    { fieldId: 'q22', filename: 'q22_seeds.jsonl' },
    { fieldId: 'q23', filename: 'q23_seeds.jsonl' },
    { fieldId: 'q24', filename: 'q24_seeds.jsonl' },
  ];

  const targets = fieldFilter ? fieldsToRun.filter((f) => f.fieldId === fieldFilter) : fieldsToRun;
  if (targets.length === 0) {
    console.error(`未找到字段：${fieldFilter}（可选：q22/q23/q24）`);
    process.exit(1);
  }

  const allRecords: EvalRecord[] = [];
  const summaries: FieldSummary[] = [];

  for (const target of targets) {
    const records = await evalField(target.fieldId, target.filename);
    allRecords.push(...records);
    summaries.push(summarize(records));
  }

  // 整体汇总
  const overall = {
    totalSamples: allRecords.length,
    overallMainAcc: allRecords.filter((r) => r.mainCorrect).length / allRecords.length,
    avgLatencyMs: allRecords.reduce((sum, r) => sum + r.latencyMs, 0) / allRecords.length,
    runMode: noLlm ? 'fallback-only' : (process.env.QWEN_API_KEY ? 'llm' : 'no-key-fallback'),
    timestamp: new Date().toISOString(),
  };

  // 渲染 Markdown 报告
  const mdLines: string[] = [];
  mdLines.push(`# 文本标签抽取评测报告`);
  mdLines.push('');
  mdLines.push(`- 时间：${overall.timestamp}`);
  mdLines.push(`- 运行模式：${overall.runMode}`);
  mdLines.push(`- 模型：${process.env.DATING_TAG_MODEL_ID || process.env.QWEN_TAG_MODEL_ID || 'qwen-plus'}`);
  mdLines.push(`- 总样本数：${overall.totalSamples}`);
  mdLines.push(`- **整体主标签准确率：${pct(overall.overallMainAcc)}**`);
  mdLines.push(`- 平均耗时：${overall.avgLatencyMs.toFixed(0)}ms/样本`);
  mdLines.push('');

  for (const s of summaries) {
    mdLines.push(renderSummary(s));
  }

  const reportMd = mdLines.join('\n');

  // 输出
  const resultsDir = resolve(projectRoot, 'eval', 'results');
  if (!existsSync(resultsDir)) mkdirSync(resultsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const tag = noLlm ? `${ts}-fallback` : ts;
  const mdPath = resolve(resultsDir, `report-${tag}.md`);
  const jsonPath = resolve(resultsDir, `raw-${tag}.json`);

  writeFileSync(mdPath, reportMd, 'utf-8');
  writeFileSync(jsonPath, JSON.stringify({ overall, summaries, records: allRecords }, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log(reportMd);
  console.log('='.repeat(60));
  console.log(`\n报告已写入：\n  ${mdPath}\n  ${jsonPath}`);
}

main().catch((err) => {
  console.error('评测失败：', err);
  process.exit(1);
});
