/**
 * Text-tag extraction contract.
 *
 * Pins down the shape and invariants of the tag extraction output that
 * downstream consumers (Module D frontend, matching heuristics) rely on:
 *
 *   - Tag tree is stable: main IDs are fixed enums per field
 *   - ExtractedTag shape: { main, sub, weight, quote }
 *   - Q22TagResult has sceneTags + interactionMode
 *   - TextTagResult (Q23/Q24) has tags array
 *   - Fallback produces valid output without API key
 *   - Empty/meaningless text returns empty tags
 */

import { describe, it, expect } from 'vitest';
import {
  Q22_SCENE_TAGS,
  Q22_MAIN_IDS,
  Q22_INTERACTION_MODES,
  Q23_TAGS,
  Q23_MAIN_IDS,
  Q24_TAGS,
  Q24_MAIN_IDS,
  getTagTreeForField,
  getMainIdsForField,
  isValidMainTag,
  type ExtractedTag,
  type Q22TagResult,
  type TextTagResult,
} from '../src/tagTree.js';
import {
  extractQ22Tags,
  extractQ23Q24Tags,
  extractAllTextTags,
} from '../src/textTagExtractor.js';

// ---------------------------------------------------------------------------
// Tag tree structure contracts
// ---------------------------------------------------------------------------

describe('tag tree contract — stable enums', () => {
  it('Q22 has exactly 5 scene main tags', () => {
    expect(Q22_SCENE_TAGS).toHaveLength(5);
    expect(Q22_MAIN_IDS).toEqual([
      'food_social', 'entertainment', 'sports_outdoor', 'stroll', 'study_together',
    ]);
  });

  it('Q22 interaction modes are strong and weak only', () => {
    expect(Object.keys(Q22_INTERACTION_MODES)).toEqual(['strong', 'weak']);
    expect(Q22_INTERACTION_MODES.strong.keywords.length).toBeGreaterThan(0);
    expect(Q22_INTERACTION_MODES.weak.keywords.length).toBeGreaterThan(0);
  });

  it('Q23 has exactly 5 main tags', () => {
    expect(Q23_TAGS).toHaveLength(5);
    expect(Q23_MAIN_IDS).toEqual([
      'communication_breakdown', 'dishonesty', 'emotional_neglect',
      'boundary_violation', 'over_demanding',
    ]);
  });

  it('Q24 has exactly 7 main tags', () => {
    expect(Q24_TAGS).toHaveLength(7);
    expect(Q24_MAIN_IDS).toEqual([
      'personality', 'lifestyle', 'relationship_pace', 'independence',
      'location_conditions', 'appearance', 'values',
    ]);
  });

  it('every tag category has id, label, description, and non-empty presetSubs', () => {
    const allTrees = [...Q22_SCENE_TAGS, ...Q23_TAGS, ...Q24_TAGS];
    for (const cat of allTrees) {
      expect(cat.id).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.description).toBeTruthy();
      expect(cat.presetSubs.length).toBeGreaterThan(0);
    }
  });

  it('getTagTreeForField returns correct tree for each field', () => {
    expect(getTagTreeForField('intro_prompt')).toBe(Q22_SCENE_TAGS);
    expect(getTagTreeForField('q19')).toBe(Q23_TAGS);
    expect(getTagTreeForField('q20')).toBe(Q24_TAGS);
  });

  it('getMainIdsForField returns correct IDs', () => {
    expect(getMainIdsForField('intro_prompt')).toBe(Q22_MAIN_IDS);
    expect(getMainIdsForField('q19')).toBe(Q23_MAIN_IDS);
    expect(getMainIdsForField('q20')).toBe(Q24_MAIN_IDS);
  });

  it('isValidMainTag validates correctly', () => {
    expect(isValidMainTag('intro_prompt', 'food_social')).toBe(true);
    expect(isValidMainTag('intro_prompt', 'bogus')).toBe(false);
    expect(isValidMainTag('q19', 'dishonesty')).toBe(true);
    expect(isValidMainTag('q20', 'values')).toBe(true);
    expect(isValidMainTag('q20', 'communication_breakdown')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Extraction output shape contracts (no API key → fallback/empty)
// ---------------------------------------------------------------------------

describe('text-tag extraction contract — output shape', () => {
  it('Q22 empty text returns valid empty result', async () => {
    const result = await extractQ22Tags('');
    assertQ22Shape(result);
    expect(result.sceneTags).toHaveLength(0);
    expect(result.interactionMode).toBeNull();
    expect(result.modelId).toBe('skip-empty');
  });

  it('Q22 meaningless text ("没有") returns empty result', async () => {
    const result = await extractQ22Tags('没有');
    assertQ22Shape(result);
    expect(result.sceneTags).toHaveLength(0);
  });

  it('Q22 with keyword match falls back to keyword extractor', async () => {
    const result = await extractQ22Tags('想一起去喝咖啡聊聊天');
    assertQ22Shape(result);
    expect(result.modelId).toBe('fallback-keyword');
    if (result.sceneTags.length > 0) {
      for (const tag of result.sceneTags) {
        assertExtractedTagShape(tag);
        expect(Q22_MAIN_IDS).toContain(tag.main);
      }
    }
  });

  it('Q22 interaction mode detection works in fallback', async () => {
    const result = await extractQ22Tags('安静待着看书就好');
    assertQ22Shape(result);
    if (result.interactionMode !== null) {
      expect(['strong', 'weak']).toContain(result.interactionMode);
    }
  });

  it('Q23 empty text returns valid empty result', async () => {
    const result = await extractQ23Q24Tags('q19', '');
    assertTextTagShape(result, 'q19');
    expect(result.tags).toHaveLength(0);
    expect(result.modelId).toBe('skip-empty');
  });

  it('Q23 with keyword match produces valid tags', async () => {
    const result = await extractQ23Q24Tags('q19', '最受不了冷暴力和已读不回');
    assertTextTagShape(result, 'q19');
    expect(result.modelId).toBe('fallback-keyword');
    if (result.tags.length > 0) {
      for (const tag of result.tags) {
        assertExtractedTagShape(tag);
        expect(Q23_MAIN_IDS).toContain(tag.main);
      }
    }
  });

  it('Q24 empty text returns valid empty result', async () => {
    const result = await extractQ23Q24Tags('q20', '都行');
    assertTextTagShape(result, 'q20');
    expect(result.tags).toHaveLength(0);
    expect(result.modelId).toBe('skip-empty');
  });

  it('Q24 with keyword match produces valid tags', async () => {
    const result = await extractQ23Q24Tags('q20', '希望对方幽默开朗有耐心');
    assertTextTagShape(result, 'q20');
    expect(result.modelId).toBe('fallback-keyword');
    if (result.tags.length > 0) {
      for (const tag of result.tags) {
        assertExtractedTagShape(tag);
        expect(Q24_MAIN_IDS).toContain(tag.main);
      }
    }
  });

  it('extractAllTextTags returns all three fields', async () => {
    const result = await extractAllTextTags({
      intro_prompt: '喝咖啡',
      q19: '冷暴力',
      q20: '幽默',
    });
    expect(result).toHaveProperty('q22');
    expect(result).toHaveProperty('q23');
    expect(result).toHaveProperty('q24');
    assertQ22Shape(result.q22);
    assertTextTagShape(result.q23, 'q19');
    assertTextTagShape(result.q24, 'q20');
  });

  it('tags array never exceeds 3 items', async () => {
    const result = await extractQ23Q24Tags('q19', '冷暴力已读不回说谎隐瞒敷衍忽冷忽热控制欲');
    assertTextTagShape(result, 'q19');
    expect(result.tags.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

function assertQ22Shape(result: Q22TagResult) {
  expect(result.fieldId).toBe('intro_prompt');
  expect(typeof result.rawText).toBe('string');
  expect(Array.isArray(result.sceneTags)).toBe(true);
  expect(result.sceneTags.length).toBeLessThanOrEqual(3);
  expect(result.interactionMode === null
    || result.interactionMode === 'strong'
    || result.interactionMode === 'weak').toBe(true);
  expect(typeof result.extractedAt).toBe('string');
  expect(typeof result.modelId).toBe('string');
}

function assertTextTagShape(result: TextTagResult, fieldId: 'q19' | 'q20') {
  expect(result.fieldId).toBe(fieldId);
  expect(typeof result.rawText).toBe('string');
  expect(Array.isArray(result.tags)).toBe(true);
  expect(result.tags.length).toBeLessThanOrEqual(3);
  expect(typeof result.extractedAt).toBe('string');
  expect(typeof result.modelId).toBe('string');
}

function assertExtractedTagShape(tag: ExtractedTag) {
  expect(typeof tag.main).toBe('string');
  expect(tag.main.length).toBeGreaterThan(0);
  expect(typeof tag.sub).toBe('string');
  expect(tag.sub.length).toBeGreaterThan(0);
  expect(tag.sub.length).toBeLessThanOrEqual(20);
  expect(typeof tag.weight).toBe('number');
  expect(tag.weight).toBeGreaterThanOrEqual(0);
  expect(tag.weight).toBeLessThanOrEqual(1);
  expect(typeof tag.quote).toBe('string');
  expect(tag.quote.length).toBeLessThanOrEqual(60);
}
