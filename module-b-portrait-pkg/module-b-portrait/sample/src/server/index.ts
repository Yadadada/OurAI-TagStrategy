/**
 * Express backend for Module B (sample-b-best edition).
 *
 * Routes:
 *   GET  /api/portrait/health         liveness check
 *   GET  /api/portrait/users          list of {id, username} (capped at 100)
 *   GET  /api/portrait/:userId        { user, portrait, attachment } for that user
 *   POST /api/portrait/build-card     { answers, profile } → vector + scores + attachment
 *   POST /api/portrait/narrative      { userId } → LLM-generated 80-char narrative
 *                                     (graceful fallback to rule-based when claude -p
 *                                      is unavailable; see src/scoring/llm-narrative.ts)
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
import { scoreAttachmentStyle, ATTACHMENT_STYLE_LABELS } from '../portrait-extension/attachment-style.js';
import {
  generatePersonalityNarrative,
  buildRuleBasedNarrative,
} from '../scoring/llm-narrative.js';

const here = dirname(fileURLToPath(import.meta.url));
// here = sample/src/server/; fixtures live at coursework/shared-fixtures/data/
const FIXTURE_DIR = join(here, '..', '..', '..', '..', 'shared-fixtures', 'data');
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
  // Score attachment style as a side dish — front-end picks it up if present.
  const attachment = scoreAttachmentStyle(user.answers as unknown as Record<string, unknown>);
  res.json({ user, portrait, attachment });
});

/**
 * Run buildUserVector + buildConsolidatedScores against a posted user object.
 * Includes the attachment-style sub-scale (B1) so the QuestionnaireFlow tab
 * can render the new bar chart immediately after submission.
 */
app.post('/api/portrait/build-card', (req, res) => {
  const body = req.body as { answers?: Record<string, unknown>; profile?: Record<string, unknown> };
  if (!body?.answers || !body?.profile) {
    return res.status(400).json({ error: 'answers + profile required' });
  }
  const { vector, byDim } = buildUserVector(body.answers, body.profile);
  const consolidatedScores = buildConsolidatedScores(body.answers, body.profile);
  const attachment = scoreAttachmentStyle(body.answers);
  res.json({ vector, byDim, consolidatedScores, attachment });
});

/**
 * POST /api/portrait/narrative
 *
 * Body: { userId: string }
 * Returns: { narrative, source: 'llm'|'fallback', latencyMs, modelId, ... }
 *
 * Calls `claude -p --model haiku` to write a 70-90 char Chinese
 * personality narrative from {mbti_type, traits, interests, attachment}.
 * Falls back gracefully to a rule-based one-liner when claude is
 * unavailable / errors / times out.
 */
app.post('/api/portrait/narrative', async (req, res) => {
  const body = req.body as { userId?: string };
  if (!body?.userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  const user = userById.get(body.userId);
  if (!user) {
    return res.status(404).json({ error: 'user not found' });
  }
  const portrait = portraitByUser.get(body.userId);
  if (!portrait) {
    return res.status(404).json({ error: 'portrait not found' });
  }

  const attachment = scoreAttachmentStyle(user.answers as unknown as Record<string, unknown>);
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

  try {
    const result = await generatePersonalityNarrative(input, fallback);
    res.json({
      ...result,
      input: {
        userId: body.userId,
        mbti_type: input.mbti_type,
        attachment_style: attachmentLabel,
      },
    });
  } catch (err) {
    // Belt-and-suspenders — generatePersonalityNarrative should never throw,
    // but if it ever does we still degrade gracefully.
    res.json({
      narrative: fallback.ruleBasedOneLiner,
      source: 'fallback',
      latencyMs: 0,
      modelId: 'rule-based-fallback',
      fallbackReason: `unexpected error: ${(err as Error).message}`,
      input: {
        userId: body.userId,
        mbti_type: input.mbti_type,
        attachment_style: attachmentLabel,
      },
    });
  }
});

app.listen(PORT, () => {
  console.log(`[sample-b-best] portrait API listening on http://localhost:${PORT}`);
  console.log(`[sample-b-best] loaded ${users.length} users / ${portraits.length} portraits from ${FIXTURE_DIR}`);
});
