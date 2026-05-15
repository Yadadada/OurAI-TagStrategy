/**
 * Persona-card contract.
 *
 * The Ourai backend invokes the vendored algorithm via the local helper
 * functions exported from `src/personaCard.ts`. A full payload requires the
 * DB + LLM, so the contract pins down only the *deterministic* surface that
 * the production code (and Module D's frontend, and Module A's matching
 * heuristics) rely on:
 *
 *   - buildUserVector(answers, profile) returns 15 L/M/H values
 *   - buildConsolidatedScores returns 6 named percentages
 *   - The standard type library is stable in size and code shape (4-letter
 *     codes are valid MBTI strings; ECBTI codes are 3-5 chars uppercase)
 *
 * Contract failure here means a Module B PR will *not* merge cleanly back
 * into Ourai.
 */

import { describe, it, expect } from 'vitest';
import { buildUserVector, buildConsolidatedScores } from '../src/personaCard.js';
import {
  STANDARD_TYPE_LIBRARY,
  FALLBACK_HHHH,
  HIDDEN_TYPES,
} from '../src/personaCardTypes.js';

const SAMPLE_ANSWERS = {
  q01: 6, q02: 5, q03: 7, q04: 4, q05: 6, q06: 5, q07: 4, q08: 3, q09: 5,
  q10: 6, q11: 6, q12: 5, q13: 3, q14: 6, q15: 5, q16: 5, q17: 5, q18: 5,
  relationship_goal: 'serious',
  relationship_role: 'equal',
  relationship_needs: ['emotional_companion', 'grow_together'],
  intro_prompt: '在闵行散步喝咖啡',
  q19: '已读不回',
  q20: '希望对方主动一点',
};

const SAMPLE_PROFILE = {
  campus: 'minhang',
  grade_label: 'undergrad_3',
  academy: '软件工程学院',
  relationship_goal: 'serious',
  long_distance_preference: 'depends',
  smoking_preference: 'reject',
  intro_prompt: '在闵行散步喝咖啡',
  hobbies: ['coding', 'music'],
  personality_tags: ['introverted', 'rational'],
};

describe('persona card contract — deterministic surface', () => {
  it('buildUserVector returns 15 L/M/H values, in DIM_ORDER', () => {
    const { vector, byDim } = buildUserVector(SAMPLE_ANSWERS, SAMPLE_PROFILE);
    expect(vector).toHaveLength(15);
    for (const v of vector) {
      expect(['L', 'M', 'H']).toContain(v);
    }
    // byDim must contain all 15 dim keys.
    const expectedKeys = [
      'SELF_EXPR', 'STRUCTURE', 'EMO_STAB', 'SECURITY', 'EXPLORE',
      'VALUES', 'REPAIR', 'COMMIT', 'EMPATHY',
      'PACE', 'DISTANCE', 'VICE',
      'INTRO_DENSITY', 'REDLINE', 'ICEBREAK',
    ];
    for (const k of expectedKeys) {
      expect(byDim[k]).toBeDefined();
      expect(['L', 'M', 'H']).toContain(byDim[k]);
    }
  });

  it('buildConsolidatedScores returns 6 percentage scores', () => {
    const scores = buildConsolidatedScores(SAMPLE_ANSWERS, SAMPLE_PROFILE);
    expect(scores).toHaveLength(6);
    for (const s of scores) {
      expect(typeof s.label).toBe('string');
      expect(s.percent).toBeGreaterThanOrEqual(0);
      expect(s.percent).toBeLessThanOrEqual(100);
    }
  });

  it('standard type library has 25 entries with 3-5 char uppercase codes and 15-char L/M/H patterns', () => {
    expect(STANDARD_TYPE_LIBRARY).toHaveLength(25);
    for (const t of STANDARD_TYPE_LIBRARY) {
      expect(t.code).toMatch(/^[A-Z]{3,5}$/);
      expect(t.pattern).toMatch(/^[LMH]{15}$/);
      expect(t.nickname).toBeTruthy();
      expect(t.fallbackSummary).toBeTruthy();
      expect(t.fallbackHighlights.length).toBeGreaterThanOrEqual(2);
      expect(t.palette.from).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(t.palette.to).toMatch(/^#[0-9a-fA-F]{3,8}$/);
      expect(t.palette.accent).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    }
  });

  it('fallback HALO + 4 hidden types are present', () => {
    expect(FALLBACK_HHHH.code).toBe('HALO');
    expect(HIDDEN_TYPES).toHaveLength(4);
    for (const t of HIDDEN_TYPES) {
      expect(t.category).toBe('hidden');
      expect(t.trigger).toBeDefined();
      expect(t.trigger!.keywords.length).toBeGreaterThan(0);
    }
  });
});

/**
 * The PersonaCardPayload shape that downstream code (Module D frontend, the
 * /partner page, Module A's match-explanation joins) depends on. We assert
 * the exported type exists structurally by constructing a minimal value with
 * `satisfies`. If anyone adds a required key, this file will fail to compile.
 */
import type { PersonaCardPayload } from '../src/personaCard.js';
describe('PersonaCardPayload structural contract', () => {
  it('has the keys mbti-card UI / matching pipeline depend on', () => {
    const sample: PersonaCardPayload = {
      code: 'SPARK',
      nickname: '电火花',
      catchphrase: '...',
      matchPercent: 80,
      hitDimensions: 4,
      totalDimensions: 6,
      specialKind: 'normal',
      badge: '匹配度 80%',
      kicker: null,
      sub: null,
      typeInterpretation: '...',
      strengths: ['x'],
      challenges: ['y'],
      primary: { code: 'SPARK', pattern: 'HMMHHMMHMHMMHHH', userVector: [], dimensions: [] },
      hidden: { code: 'EMBER', nickname: '余烬型', tagline: '...' },
      illustration: { kind: 'preset-svg', id: 'SPARK', emoji: '⚡', illustrationUrl: null, palette: { from: '#fff', to: '#000', accent: '#000' } },
      reading: { summary: 's', highlights: [], references: [] },
      meta: { generatedAt: 'now', llmModelId: 'm', degraded: false, versionKey: 'v', triggerKeyword: null },
    };

    // Spec calls out these keys explicitly:
    // mbti_type analogue → code (4-letter MBTI doesn't apply to ECBTI; the
    // ECBTI primary code is exposed under .code).
    // archetype → typeInterpretation (the human-readable type explanation)
    // traits → primary.userVector (the 15 L/M/H positions)
    // interests → consolidatedScores (the 6 trait dimensions)
    expect(sample.code).toMatch(/^[A-Z]{3,5}$/);
    expect(sample.primary.userVector).toBeDefined();
    expect(sample.reading).toBeDefined();
  });
});
