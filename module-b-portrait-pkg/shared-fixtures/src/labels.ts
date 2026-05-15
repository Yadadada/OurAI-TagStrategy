// Localized labels for all enum-derived profile fields.
// Source of truth: the ECNU questionnaire definition in `questionnaire.ts`,
// where every field has a `value` (English/key) and a `label` (中文 display).
//
// Use these helpers anywhere a profile value is shown to a user. Don't render
// raw enum keys like `minhang`, `undergrad_4`, `cooking` — they break the
// product surface (mixed Chinese/English).

import { ECNU_DATING_QUESTIONNAIRE } from './questionnaire.js';

type FieldId =
  | 'campus'
  | 'grade_label'
  | 'gender_identity'
  | 'desired_genders'
  | 'smoking_preference'
  | 'long_distance_preference'
  | 'hobbies'
  | 'personality_tags'
  | 'routine'
  | 'relationship_goal'
  | 'relationship_needs'
  | 'relationship_role';

function buildLookup(fieldId: FieldId): Map<string, string> {
  const all = [
    ...ECNU_DATING_QUESTIONNAIRE.profileFields,
    ...ECNU_DATING_QUESTIONNAIRE.questions,
  ];
  const def = all.find((f) => f.id === fieldId);
  const map = new Map<string, string>();
  if (def?.options) {
    for (const opt of def.options) {
      map.set(opt.value, opt.label);
    }
  }
  return map;
}

const LOOKUPS: Record<FieldId, Map<string, string>> = {
  campus: buildLookup('campus'),
  grade_label: buildLookup('grade_label'),
  gender_identity: buildLookup('gender_identity'),
  desired_genders: buildLookup('desired_genders'),
  smoking_preference: buildLookup('smoking_preference'),
  long_distance_preference: buildLookup('long_distance_preference'),
  hobbies: buildLookup('hobbies'),
  personality_tags: buildLookup('personality_tags'),
  routine: buildLookup('routine'),
  relationship_goal: buildLookup('relationship_goal'),
  relationship_needs: buildLookup('relationship_needs'),
  relationship_role: buildLookup('relationship_role'),
};

// Fallback labels for values not covered by the questionnaire definitions
// (e.g. legacy values, or display strings the questionnaire doesn't expose).
const FALLBACKS: Record<string, string> = {
  // campus
  minhang: '闵行',
  putuo: '普陀',
  lingang: '临港',
  both: '多校区',
  // grade
  undergrad_1: '本科一年级',
  undergrad_2: '本科二年级',
  undergrad_3: '本科三年级',
  undergrad_4: '本科四年级',
  master: '硕士',
  doctor: '博士',
  // gender
  female: '女生',
  male: '男生',
  non_binary: '非二元',
  // smoking
  accept: '可接受',
  prefer_no: '尽量不要',
  reject: '完全不接受',
  // long_distance — overlap with smoking 'accept'/'reject'; field-aware lookup wins
  depends: '看人再说',
  // routine
  early_bird: '早起',
  normal: '正常作息',
  night_owl: '夜猫子',
  irregular: '不固定',
  // relationship_goal
  serious: '认真开始一段',
  slow_burn: '慢慢认识',
  friend_first: '先做朋友',
  // relationship_role
  caregiver: '主动照顾对方',
  receiver: '被照顾',
  equal: '互相平等',
  flexible: '看情况',
  // hobbies
  sports: '运动健身',
  music: '音乐',
  movies: '电影 / 追剧',
  reading: '阅读',
  gaming: '游戏',
  travel: '旅行 / 探店',
  cooking: '做饭 / 美食',
  photography: '摄影',
  art: '画画 / 手工',
  outdoor: '户外 / 露营',
  pets: '撸猫撸狗',
  dance: '舞蹈',
  board_games: '桌游 / 剧本杀',
  volunteering: '公益',
  coding: '编程 / 技术',
  science: '科研 / 实验',
  digital: '数码 / 硬件',
  anime: '动漫 / 二次元',
  fashion: '穿搭 / 时尚',
  writing: '写作 / 创作',
  other: '其它',
  // personality
  introverted: '内向安静',
  extroverted: '外向活泼',
  slow_warm: '慢热',
  talkative: '话多',
  humorous: '幽默搞笑',
  empathetic: '共情力强',
  rational: '理性冷静',
  romantic: '浪漫',
  independent: '独立',
  clingy: '粘人',
  adventurous: '爱冒险',
  homebody: '宅',
  organized: '有计划',
  spontaneous: '随性',
  ambitious: '上进心强',
  easygoing: '佛系',
  ambivert: '内外兼具',
  sensitive: '敏感细腻',
  curious: '好奇心强',
  loyal: '重感情',
  perfectionist: '完美主义',
  carefree: '大大咧咧',
  creative: '有创意',
  stubborn: '有点倔',
  anxious: '容易焦虑',
  optimistic: '乐观积极',
  // relationship_needs
  emotional_companion: '精神陪伴',
  grow_together: '共同成长',
  practical_care: '生活照顾',
  physical_closeness: '肢体亲密',
  personal_space: '独立空间',
  emotional_value: '情绪价值',
  shared_experience: '共同体验',
  verbal_expression: '言语表达',
};

/**
 * Translate a raw enum value into its Chinese display label.
 *
 * Lookup order: questionnaire definition for the field (preferred) → global
 * fallback table → original value (return as-is). Empty string and undefined
 * map to the empty string so callers can chain freely.
 */
export function labelFor(field: FieldId, value: string | null | undefined): string {
  if (!value) return '';
  const fieldLookup = LOOKUPS[field]?.get(value);
  if (fieldLookup) return fieldLookup;
  return FALLBACKS[value] ?? value;
}

/** Translate an array of values, joined by `sep` (default `、`). Empty arrays return ''. */
export function labelArray(field: FieldId, values: readonly string[] | null | undefined, sep = '、'): string {
  if (!values || values.length === 0) return '';
  return values.map((v) => labelFor(field, v)).filter(Boolean).join(sep);
}

/** Convenience map of all known short hobby/personality/etc. tag → Chinese label, for chip rendering. */
export function chipLabels(field: FieldId, values: readonly string[] | null | undefined): Array<{ value: string; label: string }> {
  if (!values) return [];
  return values.map((v) => ({ value: v, label: labelFor(field, v) })).filter((x) => x.label);
}
