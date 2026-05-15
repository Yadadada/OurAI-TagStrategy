/**
 * Tiny Express backend for Module B.
 *
 * Reads users + portraits from the shared-fixtures generated JSON files and
 * exposes them at:
 *
 *   GET  /api/portrait/users          → list of {id, username}
 *   GET  /api/portrait/:userId        → { user, portrait } for that user
 *   POST /api/portrait/build-card     → { user } → degraded persona card payload
 *   GET  /api/portrait/health         → liveness check
 *
 * The `:userId` route is the one Vite dev server proxies to during demo. The
 * student is encouraged to add their own routes (server-side persona card
 * generation, A/B questionnaire variants, ...) in TASKS.md 进阶 30.
 *
 * Port: 3010 (so it doesn't collide with module C/D dev servers).
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { SyntheticPortrait, SyntheticUser } from '@coursework/shared-fixtures';
import {
  buildUserVector,
  buildConsolidatedScores,
} from '../personaCard.js';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(here, '..', '..', '..', 'shared-fixtures', 'data');
const PORT = Number(process.env.PORT ?? 3010);

interface FixtureBundle {
  users: SyntheticUser[];
  portraits: SyntheticPortrait[];
}

function loadFixtures(): FixtureBundle {
  const usersPath = join(FIXTURE_DIR, 'users.json');
  const portraitsPath = join(FIXTURE_DIR, 'portraits.json');

  for (const p of [usersPath, portraitsPath]) {
    if (!existsSync(p)) {
      throw new Error(
        `Fixture not found: ${p}\n` +
          `Run \`npm run fixtures:gen\` first to generate synthetic data.`,
      );
    }
  }

  return {
    users: JSON.parse(readFileSync(usersPath, 'utf8')),
    portraits: JSON.parse(readFileSync(portraitsPath, 'utf8')),
  };
}

const { users, portraits } = loadFixtures();
const portraitByUser = new Map(portraits.map((p) => [p.user_id, p]));
const userById = new Map(users.map((u) => [u.id, u]));

const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/api/portrait/health', (_req, res) => {
  res.json({ ok: true, users: users.length, portraits: portraits.length });
});

app.get('/api/portrait/users', (_req, res) => {
  // Cap to first 100 for the demo dropdown — the small fixture set has 500.
  const list = users.slice(0, 100).map((u) => ({ id: u.id, username: u.username }));
  res.json({ users: list });
});

app.get('/api/portrait/:userId', (req, res) => {
  const user = userById.get(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }
  const portrait = portraitByUser.get(user.id) ?? null;
  res.json({ user, portrait });
});

/**
 * Run buildUserVector + buildConsolidatedScores against a posted user object.
 * Useful for the QuestionnaireFlow tab to preview the algorithm without
 * rebuilding the whole client bundle.
 */
app.post('/api/portrait/build-card', (req, res) => {
  const body = req.body as { answers?: Record<string, unknown>; profile?: Record<string, unknown> };
  if (!body?.answers || !body?.profile) {
    return res.status(400).json({ error: 'answers + profile required' });
  }
  const { vector, byDim } = buildUserVector(body.answers, body.profile);
  const consolidatedScores = buildConsolidatedScores(body.answers, body.profile);
  res.json({ vector, byDim, consolidatedScores });
});

app.listen(PORT, () => {
  console.log(`[module-b] portrait API listening on http://localhost:${PORT}`);
  console.log(`[module-b] loaded ${users.length} users / ${portraits.length} portraits from ${FIXTURE_DIR}`);
});
