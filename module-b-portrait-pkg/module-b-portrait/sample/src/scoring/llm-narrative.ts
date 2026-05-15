/**
 * LLM personality narrative generator (B3 进阶项).
 *
 * Calls `claude -p --model haiku` to write a single-paragraph
 * (~80 char Chinese) personality narrative from {mbti_type, traits,
 * interests, attachment_style}.
 *
 * Why claude -p (not the Anthropic SDK):
 *   - This module ships in a coursework repo. Students should be able
 *     to clone, npm install, and run without setting up an API key.
 *   - claude -p inherits the user's existing Claude Code subscription,
 *     so the demo runs end-to-end on any developer box that already
 *     has Claude Code logged in.
 *   - Falling back gracefully to the rule-based one-liner when claude
 *     is missing means the API endpoint is *always* alive.
 *
 * Latency budget: claude -p haiku averages ~10-20 s per call. The
 * Express endpoint streams the result directly with no caching layer
 * (caching is left as an exercise; see EXPERIMENTS.md §E3).
 */

import { spawn } from 'node:child_process';

export interface NarrativeInput {
  mbti_type: string;                  // e.g. 'INFJ'
  archetype?: string | null;          // e.g. '深思的理想主义者'
  traits: Record<string, number>;     // 11 trait scores 0..100
  interests: Array<{ tag_name: string; weight: number; category?: string }>;
  /** Optional attachment-style summary line (B1 cross-feature). */
  attachment_style?: string | null;
  /** Optional ECBTI primary code (e.g. 'SPARK'). */
  ecbti_code?: string | null;
}

export interface NarrativeResult {
  narrative: string;
  source: 'llm' | 'fallback';
  latencyMs: number;
  modelId: string;
  /** Present when source='fallback' to explain why. */
  fallbackReason?: string;
}

/**
 * The fallback used when the LLM is unavailable. Mirrors the preset
 * `fallbackSummary` style from `personaCard.ts` so the demo never
 * shows an empty card. The caller is expected to pass in the
 * deterministic one-liner from the existing personaCard preset path.
 */
export interface NarrativeFallback {
  ruleBasedOneLiner: string;
}

const PROMPT_TEMPLATE = (input: NarrativeInput) => {
  const topInterests = [...input.interests]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map((i) => i.tag_name)
    .join('、') || '（暂无明显兴趣偏好）';

  const topTraits = Object.entries(input.traits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');

  const archetypeLine = input.archetype ? `架构师：${input.archetype}\n` : '';
  const attachmentLine = input.attachment_style
    ? `依恋风格：${input.attachment_style}\n`
    : '';
  const ecbtiLine = input.ecbti_code ? `ECBTI 代号：${input.ecbti_code}\n` : '';

  return `你是一位写人格洞察的中文文案。基于以下数据写一段 70-90 个汉字的"人格故事"：
MBTI：${input.mbti_type}
${archetypeLine}${ecbtiLine}${attachmentLine}前 3 性格分项：${topTraits}
高频兴趣：${topInterests}

要求：
1) 单段，不分行，不带 emoji，70-90 个汉字
2) 语气温暖具体，避免空话（不要"独特""魅力""与众不同"这类词）
3) 把 MBTI 偏好和 1-2 个具体兴趣自然结合
4) 如果给了依恋风格，结尾要点出对应的恋爱姿态（一句话）

只返回 JSON：{"narrative":"..."}`;
};

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const TIMEOUT_MS = Number(process.env.LLM_NARRATIVE_TIMEOUT_MS ?? 60000);
const MODEL = process.env.LLM_NARRATIVE_MODEL || 'haiku';

/**
 * Spawn `claude -p --model haiku <prompt>` and capture stdout.
 *
 * Resolves `null` (and never throws) on:
 *   - Process spawn failure (claude not on PATH)
 *   - Non-zero exit
 *   - Timeout
 *   - JSON parse failure
 */
async function callClaudeP(prompt: string): Promise<{ ok: true; text: string; modelId: string } | { ok: false; reason: string }> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (v: { ok: true; text: string; modelId: string } | { ok: false; reason: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(v);
    };

    let child;
    try {
      child = spawn(CLAUDE_BIN, ['-p', '--model', MODEL, prompt], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      return settle({ ok: false, reason: `spawn failed: ${(err as Error).message}` });
    }

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

    child.on('error', (err) => {
      settle({ ok: false, reason: `process error: ${err.message}` });
    });
    child.on('close', (code) => {
      if (code !== 0) {
        return settle({ ok: false, reason: `exit ${code}: ${stderr.trim().slice(0, 200)}` });
      }
      settle({ ok: true, text: stdout, modelId: `claude-${MODEL}` });
    });

    const timer = setTimeout(() => {
      try { child.kill('SIGTERM'); } catch { /* noop */ }
      settle({ ok: false, reason: `timeout after ${TIMEOUT_MS}ms` });
    }, TIMEOUT_MS);
  });
}

/**
 * Parse the LLM response. Tolerates:
 *   - Plain JSON: {"narrative":"..."}
 *   - Fenced JSON: ```json\n{"narrative":"..."}\n```
 *   - Naked text (treats it as the narrative if non-empty)
 */
function parseNarrativeText(raw: string): string | null {
  const stripped = raw
    .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
    .replace(/```[\s\S]*$/, '')
    .trim();

  // Try JSON parse first.
  const candidate = stripped || raw.trim();
  try {
    const parsed = JSON.parse(candidate);
    if (parsed && typeof parsed.narrative === 'string') {
      const out = parsed.narrative.trim();
      return out.length > 0 ? out : null;
    }
  } catch {
    // fall through
  }

  // Maybe it wrapped JSON in quotes or returned a bare string.
  const lines = candidate.split('\n').map((s) => s.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('{')) {
      try {
        const parsed = JSON.parse(line);
        if (parsed?.narrative) return String(parsed.narrative).trim();
      } catch { /* keep going */ }
    }
  }

  // Last resort: if the whole thing reads like a paragraph, return it.
  const collapsed = candidate.replace(/[`{}"]/g, '').trim();
  if (collapsed.length >= 30 && collapsed.length <= 200) return collapsed;
  return null;
}

/**
 * Generate a personality narrative.
 *
 * **Graceful degradation**: any failure in the LLM path returns the
 * provided rule-based one-liner (typically pulled from
 * `personaCard.ts`'s preset fallback) so the API endpoint always
 * succeeds.
 */
export async function generatePersonalityNarrative(
  input: NarrativeInput,
  fallback: NarrativeFallback,
): Promise<NarrativeResult> {
  const start = Date.now();
  const prompt = PROMPT_TEMPLATE(input);

  const result = await callClaudeP(prompt);
  const latencyMs = Date.now() - start;

  if (!result.ok) {
    return {
      narrative: fallback.ruleBasedOneLiner,
      source: 'fallback',
      latencyMs,
      modelId: 'rule-based-fallback',
      fallbackReason: result.reason,
    };
  }

  const text = parseNarrativeText(result.text);
  if (!text) {
    return {
      narrative: fallback.ruleBasedOneLiner,
      source: 'fallback',
      latencyMs,
      modelId: 'rule-based-fallback',
      fallbackReason: 'LLM returned unparseable output',
    };
  }

  return {
    narrative: text,
    source: 'llm',
    latencyMs,
    modelId: result.modelId,
  };
}

/**
 * Build the rule-based one-liner used as fallback when LLM is
 * unavailable. Mirrors the lightweight preset path in
 * `personaCard.ts` (fallbackSummary on a SbtiTypeDef) so the API
 * endpoint always returns something coherent.
 */
export function buildRuleBasedNarrative(input: NarrativeInput): string {
  const top = [...input.interests]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 2)
    .map((i) => i.tag_name);
  const interestPhrase = top.length === 0
    ? '兴趣未明显聚焦'
    : `常被「${top.join('・')}」类话题吸引`;
  const attachment = input.attachment_style ? `；恋爱中倾向${input.attachment_style}` : '';
  return `${input.mbti_type} 类型，${interestPhrase}${attachment}。`;
}
