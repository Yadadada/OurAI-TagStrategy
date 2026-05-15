#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateUsers } from './generate-users.js';
import { generatePortraits } from './generate-portraits.js';
import { generateMatches } from './generate-matches.js';
import type { FixtureMeta } from './types.js';

interface Args {
  users: number;
  matches: number;
  seed: number;
  holdout: number;
  outDir: string;
}

function parseArgs(argv: string[]): Args {
  const out: Args = { users: 5000, matches: 20000, seed: 42, holdout: 1000, outDir: '' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--users' && next) { out.users = parseInt(next, 10); i++; }
    else if (arg === '--matches' && next) { out.matches = parseInt(next, 10); i++; }
    else if (arg === '--seed' && next) { out.seed = parseInt(next, 10); i++; }
    else if (arg === '--holdout' && next) { out.holdout = parseInt(next, 10); i++; }
    else if (arg === '--out' && next) { out.outDir = next; i++; }
  }
  return out;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.outDir || join(here, '..', 'data');

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const totalUsers = args.users + args.holdout;
  console.log(`[fixtures] seed=${args.seed} users=${args.users} (+${args.holdout} holdout) matches=${args.matches}`);

  console.log('[fixtures] generating users...');
  const allUsers = generateUsers(totalUsers, args.seed);
  const trainUsers = allUsers.slice(0, args.users);
  const holdoutUsers = allUsers.slice(args.users);

  console.log('[fixtures] generating portraits...');
  const trainPortraits = generatePortraits(trainUsers, args.seed + 1);
  const holdoutPortraits = generatePortraits(holdoutUsers, args.seed + 2);

  console.log('[fixtures] generating matches (train)...');
  const matches = generateMatches(trainUsers, trainPortraits, args.matches, args.seed + 3);

  console.log('[fixtures] generating matches (holdout)...');
  const holdoutMatches = generateMatches(holdoutUsers, holdoutPortraits, Math.floor(args.matches / args.users * args.holdout), args.seed + 4);

  const meta: FixtureMeta = {
    generated_at: new Date().toISOString(),
    seed: args.seed,
    user_count: trainUsers.length,
    match_count: matches.length,
    holdout_user_count: holdoutUsers.length,
    upstream_commit: '2996e56564b6b0a4697581075918352c07be8cc8',
    notes:
      'Synthetic ECNU campus dating fixtures, generated from coursework distributions. ' +
      'Not derived from and not mappable to any real user. ' +
      'ground_truth_score is a hidden target; do not use it as an input feature for scorers — only for evaluation.',
  };

  console.log('[fixtures] writing files...');
  writeFileSync(join(outDir, 'users.json'), JSON.stringify(trainUsers, null, 0));
  writeFileSync(join(outDir, 'portraits.json'), JSON.stringify(trainPortraits, null, 0));
  writeFileSync(join(outDir, 'matches.json'), JSON.stringify(matches, null, 0));
  writeFileSync(join(outDir, 'holdout.json'), JSON.stringify({ users: holdoutUsers, portraits: holdoutPortraits, matches: holdoutMatches }, null, 0));
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2));

  console.log(`[fixtures] done. Output: ${outDir}`);
  console.log(`  users.json    ${trainUsers.length} records`);
  console.log(`  portraits.json ${trainPortraits.length} records`);
  console.log(`  matches.json  ${matches.length} records`);
  console.log(`  holdout.json  ${holdoutUsers.length} users + ${holdoutMatches.length} matches`);
}

main();
