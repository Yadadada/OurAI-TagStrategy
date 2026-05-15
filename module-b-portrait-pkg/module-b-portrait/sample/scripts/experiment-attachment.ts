/**
 * Experiment runner for the attachment-style sub-scale (B1 进阶项).
 *
 * Computes the distribution of attachment styles + axis statistics on
 * the 500 fixture users, and dumps the result as JSON to
 * `public-benchmarks/attachment-distribution.json` (consumed by
 * EXPERIMENTS.md).
 *
 * Usage:
 *   npm run experiment:attachment
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SyntheticUser } from '@coursework/shared-fixtures';
import { scoreAttachmentStyle, type AttachmentStyle } from '../src/portrait-extension/attachment-style.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(here, '..', '..', 'shared-fixtures', 'data');
const OUT_DIR = join(here, '..', 'public-benchmarks');
const OUT_FILE = join(OUT_DIR, 'attachment-distribution.json');

function loadUsers(): SyntheticUser[] {
  const path = join(FIXTURE_DIR, 'users.json');
  if (!existsSync(path)) {
    throw new Error(`fixture not found: ${path}\nRun \`npm run fixtures:gen\` first.`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

interface AxisStats {
  mean: number;
  median: number;
  p25: number;
  p75: number;
  std: number;
}

function summarize(values: number[]): AxisStats {
  if (values.length === 0) return { mean: 0, median: 0, p25: 0, p75: 0, std: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const pick = (q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / sorted.length;
  return {
    mean: Math.round(mean * 100) / 100,
    median: pick(0.5),
    p25: pick(0.25),
    p75: pick(0.75),
    std: Math.round(Math.sqrt(variance) * 100) / 100,
  };
}

function main() {
  const users = loadUsers();
  console.log(`[attachment] scoring ${users.length} fixture users…`);

  const styleCounts: Record<AttachmentStyle, number> = {
    'secure': 0,
    'anxious-preoccupied': 0,
    'dismissive-avoidant': 0,
    'fearful-avoidant': 0,
  };
  const anxiousValues: number[] = [];
  const avoidantValues: number[] = [];
  const secureValues: number[] = [];
  const confidenceCounts = { high: 0, medium: 0, low: 0 };

  const sampleByStyle: Record<AttachmentStyle, Array<{ id: string; username: string; anxious: number; avoidant: number; secure: number }>> = {
    'secure': [],
    'anxious-preoccupied': [],
    'dismissive-avoidant': [],
    'fearful-avoidant': [],
  };

  for (const u of users) {
    const score = scoreAttachmentStyle(u.answers as unknown as Record<string, unknown>);
    styleCounts[score.style] += 1;
    anxiousValues.push(score.anxious);
    avoidantValues.push(score.avoidant);
    secureValues.push(score.secure);
    confidenceCounts[score.confidence] += 1;
    if (sampleByStyle[score.style].length < 3) {
      sampleByStyle[score.style].push({
        id: u.id,
        username: u.username,
        anxious: score.anxious,
        avoidant: score.avoidant,
        secure: score.secure,
      });
    }
  }

  const result = {
    sampleSize: users.length,
    distribution: Object.fromEntries(
      (Object.keys(styleCounts) as AttachmentStyle[]).map((k) => [
        k,
        {
          count: styleCounts[k],
          percent: Math.round((styleCounts[k] / users.length) * 1000) / 10,
        },
      ]),
    ),
    confidence: confidenceCounts,
    axes: {
      anxious: summarize(anxiousValues),
      avoidant: summarize(avoidantValues),
      secure: summarize(secureValues),
    },
    samplePerStyle: sampleByStyle,
    publishedReference: {
      source: 'Mickelson, Kessler & Shaver 1997 (US national sample, n=8098)',
      secure_pct: 59,
      anxious_pct: 11,
      avoidant_pct: 25,
      fearful_pct: 5,
    },
    ranAt: new Date().toISOString(),
  };

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), 'utf8');

  console.log('\n[attachment] distribution:');
  for (const [style, info] of Object.entries(result.distribution)) {
    console.log(`  ${style.padEnd(22)} ${String(info.count).padStart(3)} (${info.percent}%)`);
  }
  console.log('\n[attachment] axes:');
  console.log(`  anxious  mean=${result.axes.anxious.mean}  median=${result.axes.anxious.median}  std=${result.axes.anxious.std}`);
  console.log(`  avoidant mean=${result.axes.avoidant.mean}  median=${result.axes.avoidant.median}  std=${result.axes.avoidant.std}`);
  console.log(`  secure   mean=${result.axes.secure.mean}   median=${result.axes.secure.median}   std=${result.axes.secure.std}`);
  console.log(`\n[attachment] confidence: high=${confidenceCounts.high} medium=${confidenceCounts.medium} low=${confidenceCounts.low}`);
  console.log(`\n[attachment] wrote ${OUT_FILE}`);
}

main();
