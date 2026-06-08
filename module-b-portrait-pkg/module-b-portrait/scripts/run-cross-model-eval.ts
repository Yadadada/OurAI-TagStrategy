/**
 * 跨模型交叉验证脚本
 *
 * 在同一份 256 条评测集上跑多个模型，对比主标签准确率，回应"GPT-4.1 扩充 +
 * GPT-4.1 评测"的同分布偏差问题。
 *
 * 通过 textTagExtractor.ts 中的 provider 路由层，本脚本可同时驱动：
 *   - OpenAI 兼容协议（GPT 系列） → /openai/v1/chat/completions
 *   - Anthropic Messages API（Claude 系列） → /anthropic/v1/messages
 *   - Google Gemini GenerateContent（Gemini 系列） → /gemini/v1beta/models/{id}:generateContent
 *
 * 用法：
 *   # 在 GPT-4.1 上跑（baseline，复现已有结果）
 *   npx tsx scripts/run-cross-model-eval.ts --model gpt-4.1
 *
 *   # 在 Claude 上跑（注意双横杠前缀，是本地 proxy 的 model id）
 *   npx tsx scripts/run-cross-model-eval.ts --model anthropic--claude-4.5-sonnet
 *   npx tsx scripts/run-cross-model-eval.ts --model anthropic--claude-4.7-opus
 *
 *   # 在 Gemini 上跑
 *   npx tsx scripts/run-cross-model-eval.ts --model gemini-2.5-pro
 *
 *   # 跑 default suite（三家横向对比，每家一遍 256 条）
 *   npx tsx scripts/run-cross-model-eval.ts --suite default
 *
 * 设计原则：
 *   1. 复用 run-eval.ts 全部统计代码，仅覆盖 DATING_TAG_MODEL_ID + DATING_TAG_BASE_URL
 *   2. 每模型评测前做"健康检查"：用单条样本探测，命中 fallback-keyword 即立刻 abort，
 *      避免静默跑完 256 条得到无效结果（这是上一次跑 claude/gemini 全 39.1% 的根因）
 *   3. 整合输出对比表写到 eval/CROSS-MODEL-RESULT.md
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// 加载 .env
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

// CLI 参数
const args = process.argv.slice(2);
const modelArg = args.includes('--model') ? args[args.indexOf('--model') + 1] : null;
const suiteArg = args.includes('--suite') ? args[args.indexOf('--suite') + 1] : null;
const datasetArg = args.includes('--dataset') ? args[args.indexOf('--dataset') + 1] : 'all';
const skipHealthCheck = args.includes('--skip-health-check');

// 默认 suite：跨三个家族，每家选一个中档
const DEFAULT_SUITE = [
  'gpt-4.1',                       // baseline，与扩充时同模型
  'anthropic--claude-4.5-sonnet',  // 跨家族 1
  'gemini-2.5-pro',                // 跨家族 2
];

function modelsToRun(): string[] {
  if (modelArg) return [modelArg];
  if (suiteArg === 'default') return DEFAULT_SUITE;
  console.error('必须指定 --model <name> 或 --suite default');
  console.error('可选模型示例：');
  console.error('  OpenAI: gpt-4.1 / gpt-4.1-mini / gpt-5 / gpt-5-mini');
  console.error('  Claude: anthropic--claude-4.5-sonnet / anthropic--claude-4.7-opus / ...');
  console.error('  Gemini: gemini-2.5-pro / gemini-2.5-flash / gemini-2.5-flash-lite');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 根据模型 id 推断 provider 和对应 base URL
//
// 假设本地 proxy 监听在 http://localhost:6655，三个 provider 分别挂在不同 path。
// 如果 .env 里 QWEN_BASE_URL 不是 localhost:6655 形态，或用户改了 proxy 端口，
// 这里通过 LOCAL_PROXY_ROOT 重新组装。
// ---------------------------------------------------------------------------

function detectProvider(modelId: string): 'openai' | 'anthropic' | 'gemini' {
  if (modelId.startsWith('anthropic--')) return 'anthropic';
  if (modelId.startsWith('gemini-')) return 'gemini';
  return 'openai';
}

function getProxyRoot(): string {
  // 优先 LOCAL_PROXY_ROOT；否则从 QWEN_BASE_URL 截取 host:port
  const explicit = process.env.LOCAL_PROXY_ROOT?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const qwen = process.env.QWEN_BASE_URL?.trim();
  if (qwen) {
    try {
      const url = new URL(qwen);
      return `${url.protocol}//${url.host}`;
    } catch {}
  }
  return 'http://localhost:6655';
}

function baseUrlFor(provider: 'openai' | 'anthropic' | 'gemini'): string {
  const root = getProxyRoot();
  switch (provider) {
    case 'anthropic': return `${root}/anthropic/v1`;
    case 'gemini': return `${root}/gemini/v1beta`;
    default: return `${root}/openai/v1`;
  }
}

// ---------------------------------------------------------------------------
// 健康检查：跑单条样本，确认 LLM 真的连通了，不是走 fallback-keyword
// 这是上一次评测翻车（claude/gemini 全 39.1%）后加的防呆机制
// ---------------------------------------------------------------------------

async function healthCheck(model: string): Promise<{ ok: true; modelIdFromResult: string } | { ok: false; reason: string }> {
  // 子进程隔离：把环境变量调好后，让子进程 import extractor 跑一次
  // 探测脚本写到临时文件再执行，避开 Windows / Bash 命令行转义差异
  const provider = detectProvider(model);
  const baseUrl = baseUrlFor(provider);
  const probeScript = `
import { extractQ22Tags } from '../src/textTagExtractor.js';
const r = await extractQ22Tags('想找个咖啡馆坐坐聊聊天');
console.log('PROBE_RESULT:' + JSON.stringify({ modelId: r.modelId, sceneTags: r.sceneTags.length }));
`;
  const probePath = resolve(projectRoot, 'scripts', '.cross-model-probe.tmp.mts');
  writeFileSync(probePath, probeScript, 'utf-8');
  try {
    const env = {
      ...process.env,
      DATING_TAG_MODEL_ID: model,
      DATING_TAG_BASE_URL: baseUrl,
    };
    delete (env as any).DATING_TAG_FEW_SHOT;
    delete (env as any).DATING_TAG_COT;
    const out = execSync(
      `npx tsx ${JSON.stringify(probePath)}`,
      { cwd: projectRoot, env, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] },
    );
    const line = out.split('\n').find((l) => l.startsWith('PROBE_RESULT:'));
    if (!line) return { ok: false, reason: '探测无输出（LLM 调用本身的错误日志见上方 stderr）' };
    const probe = JSON.parse(line.slice('PROBE_RESULT:'.length));
    if (probe.modelId === 'fallback-keyword') {
      return { ok: false, reason: 'LLM 调用未生效，结果走了 fallback-keyword（关键词匹配兜底）。常见原因：模型 id 不对 / 协议不匹配 / proxy 鉴权失败。具体错误见上方 [text-tag-extractor] 日志' };
    }
    if (probe.modelId === 'skip-empty') {
      return { ok: false, reason: '探测样本被判为空——这不应该发生，说明探测脚本本身错了' };
    }
    return { ok: true, modelIdFromResult: probe.modelId };
  } catch (e: any) {
    return { ok: false, reason: `探测进程异常：${e?.message || e}` };
  } finally {
    try { unlinkSync(probePath); } catch {}
  }
}

// ---------------------------------------------------------------------------
// 跑一次评测，返回最新生成的 report 文件路径
// ---------------------------------------------------------------------------

function listResultFiles(): string[] {
  const dir = resolve(projectRoot, 'eval', 'results');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('raw-') && f.endsWith('.json'))
    .map((f) => resolve(dir, f));
}

function runForModel(model: string, datasetMode: string): { rawPath: string; mdPath: string; model: string } {
  console.log('\n========================================');
  console.log(`▶ 跑模型: ${model}（数据集: ${datasetMode}）`);
  console.log('========================================');

  const before = new Set(listResultFiles());

  const provider = detectProvider(model);
  const baseUrl = baseUrlFor(provider);
  const env = {
    ...process.env,
    DATING_TAG_MODEL_ID: model,
    DATING_TAG_BASE_URL: baseUrl,
  };
  // 跑零样本（与 baseline #4 同条件）
  delete (env as any).DATING_TAG_FEW_SHOT;
  delete (env as any).DATING_TAG_COT;

  console.log(`  provider: ${provider}`);
  console.log(`  base URL: ${baseUrl}`);

  try {
    execSync(`npx tsx scripts/run-eval.ts --dataset ${datasetMode}`, {
      stdio: 'inherit',
      cwd: projectRoot,
      env,
    });
  } catch (e) {
    console.error(`[${model}] 评测失败：`, e);
    throw e;
  }

  const after = listResultFiles();
  const newFiles = after.filter((f) => !before.has(f));
  if (newFiles.length === 0) {
    throw new Error(`[${model}] 未发现新生成的 raw-*.json`);
  }
  newFiles.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const rawPath = newFiles[0];
  const mdPath = rawPath.replace(/[\\/]raw-/, (m) => m.replace('raw-', 'report-')).replace(/\.json$/, '.md');
  return { rawPath, mdPath, model };
}

// ---------------------------------------------------------------------------
// 解析 raw json 提取核心指标
// ---------------------------------------------------------------------------

interface CrossModelRow {
  model: string;
  totalSamples: number;
  overallMainAcc: number;
  avgLatencyMs: number;
  avgTotalTokens: number;
  perField: Record<string, { mainAcc: number; longtailAcc: number | null }>;
  reportPath: string;
  fallbackRatio: number; // 实际走 fallback 的样本占比，用于"评测有效性"判断
}

function parseResult(rawPath: string, model: string): CrossModelRow {
  const data = JSON.parse(readFileSync(rawPath, 'utf-8'));
  const overall = data.overall;
  const perField: CrossModelRow['perField'] = {};
  for (const s of data.summaries ?? []) {
    const longtail = s.byCategory?.longtail;
    perField[s.fieldId] = {
      mainAcc: s.mainAcc?.ratio ?? 0,
      longtailAcc: longtail ? longtail.mainAcc : null,
    };
  }
  const records = data.records ?? [];
  const fallbackCount = records.filter((r: any) => r.modelId === 'fallback-keyword').length;
  const fallbackRatio = records.length > 0 ? fallbackCount / records.length : 0;
  return {
    model,
    totalSamples: overall.totalSamples,
    overallMainAcc: overall.overallMainAcc,
    avgLatencyMs: overall.avgLatencyMs,
    avgTotalTokens: overall.avgTotalTokens ?? 0,
    perField,
    reportPath: rawPath,
    fallbackRatio,
  };
}

// ---------------------------------------------------------------------------
// 渲染对比表 Markdown
// ---------------------------------------------------------------------------

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function renderComparison(rows: CrossModelRow[]): string {
  const lines: string[] = [];
  lines.push('# 跨模型交叉验证结果');
  lines.push('');
  lines.push(`- 时间：${new Date().toISOString()}`);
  lines.push(`- 数据集：${datasetArg}（${rows[0]?.totalSamples ?? '?'} 条）`);
  lines.push(`- 评测条件：零样本（无 few-shot、无 CoT）`);
  lines.push('');
  lines.push('## 总体准确率对比');
  lines.push('');
  lines.push('| 模型 | 整体主标签准确率 | 平均耗时 | 平均 tok/样本 | fallback 占比 |');
  lines.push('|---|---|---|---|---|');
  for (const r of rows) {
    const fallbackMark = r.fallbackRatio > 0.05 ? `⚠️ ${pct(r.fallbackRatio)}` : pct(r.fallbackRatio);
    lines.push(`| **${r.model}** | ${pct(r.overallMainAcc)} | ${r.avgLatencyMs.toFixed(0)}ms | ${r.avgTotalTokens.toFixed(0)} | ${fallbackMark} |`);
  }
  lines.push('');
  lines.push('> fallback 占比 = 走关键词兜底的样本数 / 总样本。理想值应 ≤ 几个 skip-empty 类样本，> 5% 表示 LLM 对部分样本调用失败，结果可信度受影响。');
  lines.push('');
  lines.push('## 按字段分桶对比');
  lines.push('');
  lines.push('| 模型 | Q22 整体 | Q22 longtail | Q23 整体 | Q23 longtail | Q24 整体 | Q24 longtail |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const q22 = r.perField.q22;
    const q23 = r.perField.q23;
    const q24 = r.perField.q24;
    const fmt = (v: number | null | undefined) => (v == null ? '—' : pct(v));
    lines.push(`| **${r.model}** | ${fmt(q22?.mainAcc)} | ${fmt(q22?.longtailAcc)} | ${fmt(q23?.mainAcc)} | ${fmt(q23?.longtailAcc)} | ${fmt(q24?.mainAcc)} | ${fmt(q24?.longtailAcc)} |`);
  }
  lines.push('');
  lines.push('## 同分布偏差判断');
  lines.push('');
  if (rows.length >= 2) {
    const baseline = rows[0];
    const others = rows.slice(1);
    const diffs = others.map((r) => ({
      model: r.model,
      diffPp: (r.overallMainAcc - baseline.overallMainAcc) * 100,
      fallbackRatio: r.fallbackRatio,
    }));
    lines.push(`以 **${baseline.model}**（与扩充模型同源）为基准：`);
    lines.push('');
    for (const d of diffs) {
      let verdict: string;
      if (d.fallbackRatio > 0.05) {
        verdict = `⚠️ fallback 占比 ${pct(d.fallbackRatio)}，本次评测对该模型未真实生效，无法判断同分布偏差`;
      } else if (Math.abs(d.diffPp) <= 3) {
        verdict = '✅ 差距 ≤ 3pp，跨模型一致性良好，同分布偏差可控';
      } else if (Math.abs(d.diffPp) <= 5) {
        verdict = '⚠️ 差距 3-5pp，存在轻度同分布偏差，建议关注 longtail 桶细节';
      } else {
        verdict = '❌ 差距 > 5pp，存在显著同分布偏差，评测集偏向某一家族';
      }
      lines.push(`- **${d.model}**：${d.diffPp > 0 ? '+' : ''}${d.diffPp.toFixed(1)}pp — ${verdict}`);
    }
  } else {
    lines.push('（仅跑了一个模型，无法判断同分布偏差。请用 `--suite default` 跑至少 2 个模型）');
  }
  lines.push('');
  lines.push('## 报告文件');
  lines.push('');
  for (const r of rows) {
    lines.push(`- ${r.model}: \`${r.reportPath.replace(projectRoot, '.')}\``);
  }
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

async function main() {
  const models = modelsToRun();

  console.log('=== 跨模型交叉验证 ===');
  console.log(`Proxy root：${getProxyRoot()}`);
  console.log(`Dataset：${datasetArg}`);
  console.log(`待测模型：${models.join(', ')}`);
  console.log(`健康检查：${skipHealthCheck ? '已跳过（不推荐）' : '启用'}`);

  if (!process.env.QWEN_API_KEY) {
    console.error('未配置 QWEN_API_KEY，无法调用 LLM。请检查 .env');
    process.exit(1);
  }

  // --- Phase 1: 健康检查 ---
  if (!skipHealthCheck) {
    console.log('\n=== Phase 1: 健康检查 ===');
    const failed: string[] = [];
    for (const model of models) {
      process.stdout.write(`检查 ${model} ... `);
      const result = await healthCheck(model);
      if (result.ok) {
        console.log(`✅ 真实模型 id: ${result.modelIdFromResult}`);
      } else {
        console.log(`❌ ${result.reason}`);
        failed.push(model);
      }
    }
    if (failed.length > 0) {
      console.error(`\n以下模型未通过健康检查，本次评测中止：`);
      for (const m of failed) console.error(`  - ${m}`);
      console.error(`\n排查建议：`);
      console.error(`  1. 用 curl 直接打 proxy 看真实错误：`);
      console.error(`     curl ${getProxyRoot()}/openai/v1/models -H "Authorization: Bearer $QWEN_API_KEY"`);
      console.error(`  2. 确认模型 id 在 proxy 上确实存在（注意 anthropic-- 前缀）`);
      console.error(`  3. 如果你确信 proxy 有问题但仍想强行跑，加 --skip-health-check`);
      process.exit(1);
    }
  }

  // --- Phase 2: 全量评测 ---
  console.log('\n=== Phase 2: 全量评测 ===');
  const rows: CrossModelRow[] = [];
  for (const model of models) {
    try {
      const { rawPath } = runForModel(model, datasetArg);
      const row = parseResult(rawPath, model);
      rows.push(row);
      if (row.fallbackRatio > 0.05) {
        console.warn(`⚠️ [${model}] fallback 占比 ${pct(row.fallbackRatio)} 超 5%，结果可信度受影响`);
      }
    } catch (e) {
      console.error(`[${model}] 跳过：`, e);
    }
  }

  if (rows.length === 0) {
    console.error('所有模型评测失败，无对比结果产出');
    process.exit(1);
  }

  const md = renderComparison(rows);
  const outPath = resolve(projectRoot, 'eval', 'CROSS-MODEL-RESULT.md');
  writeFileSync(outPath, md, 'utf-8');

  console.log('\n========================================');
  console.log(md);
  console.log('========================================');
  console.log(`\n对比报告已写入：${outPath}`);
  console.log('\n下一步：把这个表格作为 "Baseline #6 (跨模型对照)" 追加到 eval/BASELINE.md');
}

main().catch((err) => {
  console.error('交叉验证失败：', err);
  process.exit(1);
});
