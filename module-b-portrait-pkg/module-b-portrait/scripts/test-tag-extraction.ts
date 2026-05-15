/**
 * 本地测试脚本 — 验证文本标签抽取是否正常工作
 *
 * 运行方式：npx tsx scripts/test-tag-extraction.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// 手动加载 .env（必须在 import extractor 之前）
const envPath = resolve(import.meta.dirname, '..', '.env');
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

const { extractAllTextTags } = await import('../src/textTagExtractor.js');

const testCases = [
  {
    label: '测试1：典型回答',
    intro_prompt: '想一起去喝咖啡聊聊天，或者河边散散步',
    q19: '最受不了冷暴力和已读不回，有话可以直说',
    q20: '希望对方幽默开朗，三观一致，有自己的生活',
  },
  {
    label: '测试2：简短回答',
    intro_prompt: '看电影',
    q19: '说谎',
    q20: '身高170以上',
  },
  {
    label: '测试3：空/无意义',
    intro_prompt: '都行',
    q19: '没有',
    q20: '',
  },
];

async function main() {
  console.log('=== 文本标签抽取测试 ===\n');
  console.log(`模型: ${process.env.DATING_TAG_MODEL_ID || process.env.QWEN_TAG_MODEL_ID || 'qwen-plus'}`);
  console.log(`Base URL: ${process.env.QWEN_BASE_URL || '(default)'}`);
  console.log(`API Key: ${process.env.QWEN_API_KEY ? '已配置' : '未配置'}\n`);

  for (const tc of testCases) {
    console.log(`--- ${tc.label} ---`);
    console.log(`  Q22: "${tc.intro_prompt}"`);
    console.log(`  Q23: "${tc.q19}"`);
    console.log(`  Q24: "${tc.q20}"`);

    const start = Date.now();
    const result = await extractAllTextTags({
      intro_prompt: tc.intro_prompt,
      q19: tc.q19,
      q20: tc.q20,
    });
    const elapsed = Date.now() - start;

    console.log(`\n  [Q22 结果] model=${result.q22.modelId}, 耗时${elapsed}ms`);
    console.log(`    场景标签: ${JSON.stringify(result.q22.sceneTags, null, 2)}`);
    console.log(`    互动方式: ${result.q22.interactionMode}`);

    console.log(`  [Q23 结果] model=${result.q23.modelId}`);
    console.log(`    标签: ${JSON.stringify(result.q23.tags, null, 2)}`);

    console.log(`  [Q24 结果] model=${result.q24.modelId}`);
    console.log(`    标签: ${JSON.stringify(result.q24.tags, null, 2)}`);
    console.log('');
  }
}

main().catch(console.error);
