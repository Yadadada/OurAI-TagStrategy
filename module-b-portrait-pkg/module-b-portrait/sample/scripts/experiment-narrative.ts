/**
 * Experiment runner for the LLM personality narrative (B3 进阶项).
 *
 * Calls `claude -p --model haiku` on N fixture users (default 5),
 * collects narrative text + latency + source ('llm' vs 'fallback'),
 * and dumps the result as JSON to
 * `public-benchmarks/narrative-samples.json`.
 *
 * The output feeds EXPERIMENTS.md §E2 (LLM latency + sample outputs).
 *
 * Usage:
 *   npm run experiment:narrative                # default 5 users
 *   N=8 npm run experiment:narrative
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SyntheticUser, SyntheticPortrait } from '@coursework/shared-fixtures';
import {
  generatePersonalityNarrative,
  buildRuleBasedNarrative,
} from '../src/scoring/llm-narrative.js';
import {
  scoreAttachmentStyle,
  ATTACHMENT_STYLE_LABELS,
} from '../src/portrait-extension/attachment-style.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(here, '..', '..', 'shared-fixtures', 'data');
const OUT_DIR = join(here, '..', 'public-benchmarks');
const OUT_FILE = join(OUT_DIR, 'narrative-samples.json');

function loadFixtures(): { users: SyntheticUser[]; portraits: Map<string, SyntheticPortrait> } {
  const users: SyntheticUser[] = JSON.parse(readFileSync(join(FIXTURE_DIR, 'users.json'), 'utf8'));
  const portraits: SyntheticPortrait[] = JSON.parse(readFileSync(join(FIXTURE_DIR, 'portraits.json'), 'utf8'));
  return { users, portraits: new Map(portraits.map((p) => [p.user_id, p])) };
}

async function main() {
  const N = Number(process.env.N ?? 5);
  const { users, portraits } = loadFixtures();

  // Pick a deterministic spread: indices 0, 50, 100, ...
  const stride = Math.max(1, Math.floor(users.length / N));
  const picked = Array.from({ length: N }, (_, i) => users[i * stride]).filter(Boolean);

  console.log(`[narrative] generating for ${picked.length} users via claude -p haiku…`);
  const samples: Array<Record<string, unknown>> = [];
  const latencies: number[] = [];
  let llmHits = 0;
  let fallbacks = 0;

  for (const u of picked) {
    const portrait = portraits.get(u.id);
    if (!portrait) continue;
    const attachment = scoreAttachmentStyle(u.answers as unknown as Record<string, unknown>);
    const attachmentLabel = ATTACHMENT_STYLE_LABELS[attachment.style];

    const input = {
      mbti_type: portrait.mbti.mbti_type,
      archetype: portrait.mbti.archetype ?? null,
      traits: portrait.traits as unknown as Record<string, number>,
      interests: portrait.interests.map((i) => ({
        tag_name: i.tag_name,
        weight: i.weight,
        category: i.category,
      })),
      attachment_style: `${attachmentLabel}（${attachment.oneLiner}）`,
    };
    const fallback = { ruleBasedOneLiner: buildRuleBasedNarrative(input) };

    process.stdout.write(`  ${u.username} (${input.mbti_type}, ${attachmentLabel}) … `);
    const result = await generatePersonalityNarrative(input, fallback);
    latencies.push(result.latencyMs);
    if (result.source === 'llm') llmHits += 1;
    else fallbacks += 1;
    process.stdout.write(`${result.source} ${result.latencyMs}ms\n`);
    process.stdout.write(`    > ${result.narrative}\n`);

    samples.push({
      user_id: u.id,
      username: u.username,
      mbti_type: input.mbti_type,
      archetype: input.archetype,
      attachment_style: attachmentLabel,
      narrative: result.narrative,
      narrativeLength: [...result.narrative].length,
      source: result.source,
      latencyMs: result.latencyMs,
      modelId: result.modelId,
      fallbackReason: result.fallbackReason,
    });
  }

  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const stats = {
    n: latencies.length,
    llmHits,
    fallbacks,
    avgLatencyMs: latencies.length ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : 0,
    medianLatencyMs: sortedLatencies[Math.floor(sortedLatencies.length / 2)] ?? 0,
    minLatencyMs: sortedLatencies[0] ?? 0,
    maxLatencyMs: sortedLatencies[sortedLatencies.length - 1] ?? 0,
  };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    OUT_FILE,
    JSON.stringify({ ranAt: new Date().toISOString(), stats, samples }, null, 2),
    'utf8',
  );

  console.log('\n[narrative] stats:');
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\n[narrative] wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
