/**
 * Questionnaire flow contract.
 *
 * The questionnaire UI is allowed to evolve, but the *output* — the
 * `answers` object handed to `personaCard.buildUserVector` — must contain
 * all 24 keys. Anything missing breaks the algorithm + breaks the join with
 * Module A's matching pipeline.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDefaultAnswers,
  QUESTIONNAIRE_ANSWER_KEYS,
} from '../src/components/QuestionnaireFlow.js';
import { ECNU_DATING_QUESTIONNAIRE } from '@coursework/shared-fixtures/questionnaire';

describe('questionnaire contract — 24 answer keys', () => {
  it('QUESTIONNAIRE_ANSWER_KEYS lists exactly 24 keys', () => {
    expect(QUESTIONNAIRE_ANSWER_KEYS).toHaveLength(24);
  });

  it('buildDefaultAnswers produces an object covering all 24 keys', () => {
    const a = buildDefaultAnswers();
    for (const key of QUESTIONNAIRE_ANSWER_KEYS) {
      expect(a[key]).toBeDefined();
    }
    expect(Object.keys(a).sort()).toEqual([...QUESTIONNAIRE_ANSWER_KEYS].sort());
  });

  it('the 18 likert keys default to a valid 1-7 number', () => {
    const a = buildDefaultAnswers();
    const likertKeys = QUESTIONNAIRE_ANSWER_KEYS.filter(
      (k) => /^q\d+$/.test(k) && k !== 'q19' && k !== 'q20',
    );
    expect(likertKeys).toHaveLength(18);
    for (const k of likertKeys) {
      expect(typeof a[k]).toBe('number');
      expect(a[k] as number).toBeGreaterThanOrEqual(1);
      expect(a[k] as number).toBeLessThanOrEqual(7);
    }
  });

  it('shared-fixtures questionnaire definition exposes the same 18 likert questions', () => {
    const likertFromDef = ECNU_DATING_QUESTIONNAIRE.questions.filter((q) => q.type === 'scale');
    expect(likertFromDef).toHaveLength(18);
    const likertIds = new Set(likertFromDef.map((q) => q.id));
    for (const k of QUESTIONNAIRE_ANSWER_KEYS) {
      if (/^q\d+$/.test(k) && k !== 'q19' && k !== 'q20') {
        expect(likertIds.has(k)).toBe(true);
      }
    }
  });
});
