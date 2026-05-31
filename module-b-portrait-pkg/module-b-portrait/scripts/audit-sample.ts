/**
 * 扩充数据抽检脚本
 *
 * 从 eval/{field}_expanded.jsonl 随机抽 10%（最少 5 条），
 * 输出 markdown 表格供人工核对标注质量。
 *
 * 运行方式：
 *   npx tsx scripts/audit-sample.ts                       # 三个字段全抽
 *   npx tsx scripts/audit-sample.ts --field q22           # 只抽 Q22
 *   npx tsx scripts/audit-sample.ts --rate 0.2            # 抽 20%
 *
 * 输出：
 *   eval/audit/{field}-{ts}.md：抽检表（带"是否合格"列让你勾选）
 *   eval/audit/{field}-{ts}.json：抽中样本的原始记录
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const args = process.argv.slice(2);
const fieldFilter = args.includes('--field') ? args[args.indexOf('--field') + 1] : null;
const rateArg = args.includes('--rate') ? Number(args[args.indexOf('--rate') + 1]) : null;

interface Sample {
  id: string;
  text: string;
  expected_main: string[];
  expected_interaction?: 'strong' | 'weak' | null;
  expected_sub_keywords?: string[];
  should_skip: boolean;
  category: string;
  note?: string;
}

function loadJsonl(path: string): Sample[] {
  if (!existsSync(path)) return [];
  const content = readFileSync(path, 'utf-8');
  const out: Sample[] = [];
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch {}
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderMarkdown(fieldId: string, samples: Sample[], total: number, rate: number): string {
  const lines: string[] = [];
  lines.push(`# ${fieldId.toUpperCase()} 扩充数据抽检表`);
  lines.push('');
  lines.push(`- 抽检比例：${(rate * 100).toFixed(0)}%（${samples.length}/${total}）`);
  lines.push(`- 时间：${new Date().toISOString()}`);
  lines.push('');
  lines.push('## 检查方法');
  lines.push('');
  lines.push('对每条样本判断：');
  lines.push('1. **text 是否合理**：是真实用户可能写的话吗？语气、长度、用词是否自然？');
  lines.push('2. **expected_main 是否正确**：根据 tagTree 的语义边界判断');
  lines.push('3. **category 是否正确**：normal/longtail/boundary/perturbation 分类是否对得上 text');
  lines.push('4. **expected_sub_keywords 是否在 text 中真实出现**（substring 匹配能命中）');
  lines.push('');
  lines.push('在"判定"列填：✓（合格）/ ✗（有问题，并在备注列写明哪里错）');
  lines.push('');
  const hasInteraction = samples.some((s) => 'expected_interaction' in s && s.expected_interaction !== undefined);
  const headers = ['id', 'text', 'expected_main', ...(hasInteraction ? ['interaction'] : []), 'sub_keywords', 'category', '判定', '问题备注'];
  lines.push('| ' + headers.join(' | ') + ' |');
  lines.push('|' + headers.map(() => '---').join('|') + '|');
  for (const s of samples) {
    const row = [
      `\`${s.id}\``,
      s.text.replace(/\|/g, '\\|'),
      `\`${JSON.stringify(s.expected_main)}\``,
      ...(hasInteraction ? [String(s.expected_interaction ?? 'null')] : []),
      `\`${JSON.stringify(s.expected_sub_keywords ?? [])}\``,
      s.category,
      ' ',
      ' ',
    ];
    lines.push('| ' + row.join(' | ') + ' |');
  }
  lines.push('');
  lines.push('## 抽检结论（人工填写）');
  lines.push('');
  lines.push('- 合格数：__ / ' + samples.length);
  lines.push('- 合格率：__ %');
  lines.push('- 主要问题类型：');
  lines.push('  - [ ] text 不自然 / 像机器生成');
  lines.push('  - [ ] expected_main 标错了主标签');
  lines.push('  - [ ] category 分类错（如 longtail 但其实是 normal）');
  lines.push('  - [ ] sub_keywords 不在 text 中');
  lines.push('  - [ ] 其他：');
  lines.push('');
  lines.push('## 决策（人工填写）');
  lines.push('');
  lines.push('- [ ] 整批接受');
  lines.push('- [ ] 修正个别错误后接受（在上表 ✗ 行直接改）');
  lines.push('- [ ] 整批重生成（合格率 < 80% 时）');
  return lines.join('\n');
}

function auditField(fieldId: string, rate: number): boolean {
  const inputPath = resolve(projectRoot, 'eval', `${fieldId}_expanded.jsonl`);
  const samples = loadJsonl(inputPath);
  if (samples.length === 0) {
    console.warn(`[${fieldId}] ${inputPath} 不存在或为空，跳过`);
    return false;
  }

  const sampleSize = Math.max(5, Math.ceil(samples.length * rate));
  const picked = shuffle(samples).slice(0, sampleSize);

  // 按 id 排序输出，方便对照
  picked.sort((a, b) => a.id.localeCompare(b.id));

  const auditDir = resolve(projectRoot, 'eval', 'audit');
  if (!existsSync(auditDir)) mkdirSync(auditDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const mdPath = resolve(auditDir, `${fieldId}-${ts}.md`);
  const jsonPath = resolve(auditDir, `${fieldId}-${ts}.json`);

  writeFileSync(mdPath, renderMarkdown(fieldId, picked, samples.length, rate), 'utf-8');
  writeFileSync(jsonPath, JSON.stringify({ fieldId, total: samples.length, sampleSize, picked }, null, 2), 'utf-8');

  console.log(`[${fieldId}] 抽 ${sampleSize}/${samples.length} 条`);
  console.log(`  → ${mdPath}`);
  return true;
}

async function main() {
  const rate = rateArg ?? 0.1;
  const fields = fieldFilter ? [fieldFilter] : ['q22', 'q23', 'q24'];
  console.log(`=== 抽检（rate=${(rate * 100).toFixed(0)}%）===`);
  for (const f of fields) {
    auditField(f, rate);
  }
  console.log('\n完成。打开 eval/audit/ 下的 md 文件，逐条核对。');
}

main().catch((err) => {
  console.error('抽检失败：', err);
  process.exit(1);
});
