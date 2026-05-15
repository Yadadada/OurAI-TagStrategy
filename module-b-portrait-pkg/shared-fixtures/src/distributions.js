// Marginal distributions extracted from production ourai_school @ 2026-05-07.
// See coursework/DATA-DISTRIBUTION.md for the full breakdown.
// These are the source of truth for the generator. Tweak here, regenerate fixtures.
export const ACADEMY_DIST = [
    { value: '软件工程学院', weight: 16 },
    { value: '心理与认知科学学院', weight: 12 },
    { value: '统计学院', weight: 9 },
    { value: '数学科学学院', weight: 9 },
    { value: '历史学系', weight: 6 },
    { value: '地球科学学部', weight: 6 },
    { value: '经济与管理学部', weight: 6 },
    { value: '中国语言文学系', weight: 6 },
    { value: '信息学部', weight: 4 },
    { value: '生命科学学院', weight: 3 },
    { value: '马克思主义学院', weight: 3 },
    { value: '地理科学学院', weight: 3 },
    { value: '音乐学院', weight: 2 },
    { value: '网络空间安全学院', weight: 2 },
    { value: '国际汉语文化学院', weight: 2 },
    { value: '计算机科学与技术学院', weight: 4 },
    { value: '数据科学与工程学院', weight: 3 },
    { value: '物理学院', weight: 2 },
    { value: '法学院', weight: 2 },
];
export const CAMPUS_DIST = [
    { value: 'putuo', weight: 44 },
    { value: 'minhang', weight: 34 },
    { value: 'both', weight: 12 },
    { value: 'lingang', weight: 4 },
    { value: '', weight: 6 },
];
export const GENDER_DIST = [
    { value: 'female', weight: 69 },
    { value: 'male', weight: 25 },
    { value: 'non_binary', weight: 1 },
    { value: '', weight: 5 },
];
export const GRADE_DIST = [
    { value: 'master', weight: 28 },
    { value: 'undergrad_3', weight: 28 },
    { value: 'undergrad_1', weight: 22 },
    { value: 'undergrad_4', weight: 9 },
    { value: 'undergrad_2', weight: 4 },
    { value: 'doctor', weight: 3 },
    { value: '', weight: 6 },
];
export const SMOKING_DIST = [
    { value: 'reject', weight: 66 },
    { value: 'prefer_no', weight: 28 },
    { value: 'accept', weight: 1 },
    { value: '', weight: 5 },
];
export const LONG_DISTANCE_DIST = [
    { value: 'depends', weight: 50 },
    { value: 'accept', weight: 28 },
    { value: 'reject', weight: 16 },
    { value: '', weight: 6 },
];
export const ROUTINE_DIST = [
    { value: 'normal', weight: 35 },
    { value: 'night_owl', weight: 30 },
    { value: 'irregular', weight: 25 },
    { value: 'early_bird', weight: 10 },
];
export const RELATIONSHIP_GOAL_DIST = [
    { value: 'slow_burn', weight: 50 },
    { value: 'serious', weight: 30 },
    { value: 'friend_first', weight: 20 },
];
export const RELATIONSHIP_ROLE_DIST = [
    { value: 'flexible', weight: 35 },
    { value: 'equal', weight: 35 },
    { value: 'caregiver', weight: 18 },
    { value: 'receiver', weight: 12 },
];
// Hobbies: average user picks 4-6 of these.
export const HOBBIES = [
    'sports',
    'music',
    'movies',
    'reading',
    'gaming',
    'travel',
    'cooking',
    'photography',
    'art',
    'outdoor',
    'pets',
    'dance',
    'board_games',
    'volunteering',
    'coding',
    'science',
    'digital',
    'anime',
    'fashion',
    'writing',
];
export const PERSONALITY_TAGS = [
    'introverted',
    'extroverted',
    'slow_warm',
    'talkative',
    'humorous',
    'empathetic',
    'rational',
    'romantic',
    'independent',
    'clingy',
    'adventurous',
    'homebody',
    'organized',
    'spontaneous',
    'ambitious',
    'easygoing',
    'ambivert',
    'sensitive',
    'curious',
    'loyal',
    'perfectionist',
    'carefree',
    'creative',
    'stubborn',
    'anxious',
    'optimistic',
];
export const RELATIONSHIP_NEEDS = [
    'emotional_companion',
    'grow_together',
    'practical_care',
    'physical_closeness',
    'personal_space',
    'emotional_value',
    'shared_experience',
    'verbal_expression',
];
// Academy → hobbies/personality bias. Used to create realistic correlations.
// Each academy boosts the weight of certain hobbies and certain personality tags.
export const ACADEMY_HOBBY_BIAS = {
    软件工程学院: ['coding', 'gaming', 'digital', 'anime'],
    计算机科学与技术学院: ['coding', 'gaming', 'digital'],
    数据科学与工程学院: ['coding', 'science', 'reading'],
    网络空间安全学院: ['coding', 'gaming', 'digital'],
    心理与认知科学学院: ['reading', 'writing', 'art', 'volunteering'],
    统计学院: ['reading', 'science', 'board_games'],
    数学科学学院: ['reading', 'science', 'board_games'],
    物理学院: ['science', 'reading', 'outdoor'],
    生命科学学院: ['science', 'pets', 'outdoor'],
    历史学系: ['reading', 'travel', 'writing'],
    中国语言文学系: ['reading', 'writing', 'art'],
    国际汉语文化学院: ['reading', 'travel', 'writing'],
    地球科学学部: ['outdoor', 'travel', 'science'],
    地理科学学院: ['outdoor', 'travel', 'photography'],
    经济与管理学部: ['travel', 'fashion', 'reading'],
    法学院: ['reading', 'travel'],
    马克思主义学院: ['reading', 'volunteering'],
    音乐学院: ['music', 'dance', 'art'],
    信息学部: ['coding', 'gaming', 'digital'],
};
export const ACADEMY_PERSONALITY_BIAS = {
    软件工程学院: ['rational', 'introverted', 'creative', 'curious'],
    计算机科学与技术学院: ['rational', 'introverted', 'curious'],
    心理与认知科学学院: ['empathetic', 'sensitive', 'curious', 'organized'],
    数学科学学院: ['rational', 'organized', 'introverted'],
    统计学院: ['rational', 'organized', 'introverted'],
    历史学系: ['introverted', 'creative', 'sensitive'],
    中国语言文学系: ['creative', 'sensitive', 'romantic'],
    音乐学院: ['creative', 'romantic', 'extroverted'],
    地球科学学部: ['adventurous', 'curious', 'easygoing'],
    地理科学学院: ['adventurous', 'curious'],
    生命科学学院: ['curious', 'organized'],
    经济与管理学部: ['ambitious', 'extroverted', 'rational'],
};
// Likert q01 (proactive in introducing oneself) correlates with extroversion.
export const PERSONALITY_LIKERT_BIAS = {
    introverted: { q01: -1.5, q09: -1, q12: -0.5 },
    extroverted: { q01: 1.5, q09: 0.5, q06: 0.5 },
    slow_warm: { q01: -1, q18: 1 },
    talkative: { q01: 1, q12: 0.5 },
    empathetic: { q02: 0.5, q14: 0.5 },
    rational: { q05: 1, q07: 0.5 },
    romantic: { q15: 1, q16: 0.5, q18: -0.5 },
    independent: { q08: 1, q09: -1 },
    clingy: { q08: -1, q09: 1, q15: 1, q04: 1 },
    organized: { q03: 1, q11: 0.5 },
    spontaneous: { q03: -0.5, q06: 1 },
    ambitious: { q11: 1.5 },
    perfectionist: { q03: 0.5, q11: 0.5 },
    optimistic: { q05: 0.5 },
    anxious: { q04: 1.5, q05: -1 },
    loyal: { q03: 0.5, q14: 1, q10: 1 },
    stubborn: { q07: 1, q14: -0.5 },
};
// Feedback type distribution (synthesized — production has only 'liked' samples)
export const FEEDBACK_TYPES = [
    { value: 'liked', weight: 25 },
    { value: 'passed', weight: 35 },
    { value: 'dismissed', weight: 25 },
    { value: 'chatted', weight: 10 },
    { value: 'met', weight: 4 },
    { value: 'blocked', weight: 1 },
];
// MBTI type distribution among Chinese university students (approximate, public surveys).
// Used as the prior; the per-user MBTI is then derived from Likert axes.
export const MBTI_TYPE_PRIOR = {
    INFP: 12,
    INFJ: 10,
    ISFJ: 9,
    ISTJ: 9,
    ISFP: 8,
    INTP: 8,
    ISTP: 7,
    INTJ: 6,
    ENFP: 7,
    ENFJ: 5,
    ESFJ: 5,
    ESTJ: 4,
    ESFP: 4,
    ESTP: 3,
    ENTP: 2,
    ENTJ: 1,
};
// Active hours histogram (UTC) from production user_messages.
// Peaks at hour 6 (CN 14:00), 13-15 (21:00-23:00), 18 (02:00 night owls).
export const ACTIVE_HOUR_DIST_UTC = {
    0: 1, 1: 1, 2: 2, 3: 3, 4: 1, 5: 2, 6: 18, 7: 8, 8: 4, 9: 2, 10: 3, 11: 1,
    12: 6, 13: 13, 14: 7, 15: 23, 16: 4, 17: 1, 18: 16, 19: 8, 20: 4, 21: 2, 22: 1, 23: 1,
};
