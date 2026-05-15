import {
  ACADEMY_DIST,
  ACADEMY_HOBBY_BIAS,
  ACADEMY_PERSONALITY_BIAS,
  CAMPUS_DIST,
  GENDER_DIST,
  GRADE_DIST,
  HOBBIES,
  LONG_DISTANCE_DIST,
  PERSONALITY_LIKERT_BIAS,
  PERSONALITY_TAGS,
  RELATIONSHIP_GOAL_DIST,
  RELATIONSHIP_NEEDS,
  RELATIONSHIP_ROLE_DIST,
  ROUTINE_DIST,
  SMOKING_DIST,
} from './distributions.js';
import { chance, clipInt, gauss, makeRng, pick, pickN, pickWeighted, pseudoId, randInt } from './random.js';
import type { Gender, QuestionnaireAnswers, SyntheticUser } from './types.js';

const GENDERS: readonly Gender[] = ['female', 'male', 'non_binary'];

function generateDesiredGenders(rng: () => number, self: Gender | ''): Gender[] {
  // 80% heterosexual, 13% bi, 5% other-only, 2% none.
  if (!self || self === 'non_binary') return pickN(rng, GENDERS, randInt(rng, 1, 2));
  const r = rng();
  if (r < 0.8) {
    return self === 'female' ? ['male'] : ['female'];
  }
  if (r < 0.93) {
    return self === 'female' ? ['male', 'female'] : ['female', 'male'];
  }
  if (r < 0.98) {
    return self === 'female' ? ['female'] : ['male'];
  }
  return [];
}

function generateHobbies(rng: () => number, academy: string): string[] {
  const bias = new Set(ACADEMY_HOBBY_BIAS[academy] ?? []);
  const items = HOBBIES.map((h) => ({
    value: h,
    weight: bias.has(h) ? 6 : 1,
  }));
  const n = randInt(rng, 3, 6);
  const out = new Set<string>();
  while (out.size < n) {
    out.add(pickWeighted(rng, items));
  }
  return [...out];
}

function generatePersonalityTags(rng: () => number, academy: string): string[] {
  const bias = new Set(ACADEMY_PERSONALITY_BIAS[academy] ?? []);
  const items = PERSONALITY_TAGS.map((t) => ({
    value: t,
    weight: bias.has(t) ? 5 : 1,
  }));
  const n = randInt(rng, 3, 7);
  const out = new Set<string>();
  while (out.size < n) {
    out.add(pickWeighted(rng, items));
  }
  return [...out];
}

function generateAnswers(
  rng: () => number,
  personality: string[],
  goal: 'serious' | 'slow_burn' | 'friend_first',
): QuestionnaireAnswers {
  const baseLikert = (): number => clipInt(gauss(rng, 4.5, 1.4), 1, 7);
  const answers: Record<string, number> = {};
  for (let i = 1; i <= 18; i++) {
    answers[`q${String(i).padStart(2, '0')}`] = baseLikert();
  }

  // Apply personality biases (deterministic mean shifts)
  for (const tag of personality) {
    const bias = PERSONALITY_LIKERT_BIAS[tag];
    if (!bias) continue;
    for (const [qid, shift] of Object.entries(bias)) {
      if (qid in answers && shift != null) {
        answers[qid] = clipInt(answers[qid]! + shift, 1, 7);
      }
    }
  }

  // Goal influence
  if (goal === 'serious') {
    answers.q10 = clipInt(answers.q10! + 1, 1, 7);
    answers.q15 = clipInt(answers.q15! + 1, 1, 7);
  } else if (goal === 'friend_first') {
    answers.q18 = clipInt(answers.q18! + 1, 1, 7);
  }

  return {
    q01: answers.q01!, q02: answers.q02!, q03: answers.q03!, q04: answers.q04!,
    q05: answers.q05!, q06: answers.q06!, q07: answers.q07!, q08: answers.q08!,
    q09: answers.q09!, q10: answers.q10!, q11: answers.q11!, q12: answers.q12!,
    q13: answers.q13!, q14: answers.q14!, q15: answers.q15!, q16: answers.q16!,
    q17: answers.q17!, q18: answers.q18!,
    relationship_goal: goal,
    relationship_role: pickWeighted(rng, RELATIONSHIP_ROLE_DIST as any),
    relationship_needs: pickN(rng, RELATIONSHIP_NEEDS, randInt(rng, 2, 3)),
  };
}

const NICKNAMES_FEMALE = ['小棠', '柚子', '阿叶', '阿岚', '林夕', '青禾', '素年', '玖月', 'lina', 'mia', 'cici', 'echo'];
const NICKNAMES_MALE = ['阿川', '默白', '南野', '羽川', '陈默', '林深', '阿哲', 'kai', 'leo', 'eric', 'tom', 'jay'];
const NICKNAMES_NEUTRAL = ['七月', '风行', '野子', 'sky', 'ocean', 'cloud', '一川', '远山', '小满', '半夏'];

function generateUsername(rng: () => number, gender: Gender | '', index: number): string {
  const pool = gender === 'female' ? NICKNAMES_FEMALE : gender === 'male' ? NICKNAMES_MALE : NICKNAMES_NEUTRAL;
  const base = pick(rng, pool);
  return chance(rng, 0.3) ? `${base}${randInt(rng, 1, 999)}` : base;
}

const INTRO_PROMPTS = [
  '在闵行校区散步，喝咖啡聊聊最近在做什么',
  '一起去丽娃河边走走',
  '吃个晚饭聊天',
  '一起去看个展',
  '图书馆自习然后吃晚饭',
  '去普陀的咖啡馆',
  '一起去吃火锅',
  '看场电影',
  '一起去运动',
  '随便走走聊聊',
];

const Q19_DEALBREAKERS = [
  '冷暴力', '不回消息', '说谎', '敷衍', '忽冷忽热', '不真诚', '越界', '过度索取', '吵架不沟通', '占有欲强',
];

const Q20_NOTES = [
  '希望对方不要太宅',
  '想找同校区的',
  '希望喜欢音乐',
  '希望有自己的事情',
  '希望性格开朗',
  '希望对方爱运动',
  '不喜欢说脏话',
  '希望节奏慢一点',
];

export function generateUsers(count: number, seed: number): SyntheticUser[] {
  const rng = makeRng(seed);
  const out: SyntheticUser[] = [];
  const baseDate = new Date('2026-04-01T00:00:00Z').getTime();

  for (let i = 0; i < count; i++) {
    const academy = pickWeighted(rng, ACADEMY_DIST as any) as string;
    const campus = pickWeighted(rng, CAMPUS_DIST as any) as string;
    const grade = pickWeighted(rng, GRADE_DIST as any) as string;
    const gender = pickWeighted(rng, GENDER_DIST as any) as Gender | '';
    const desired = generateDesiredGenders(rng, gender);
    const smoking = pickWeighted(rng, SMOKING_DIST as any) as string;
    const long_distance = pickWeighted(rng, LONG_DISTANCE_DIST as any) as string;
    const routine = pickWeighted(rng, ROUTINE_DIST as any) as string;
    const hobbies = generateHobbies(rng, academy);
    const personality = generatePersonalityTags(rng, academy);
    const goal = pickWeighted(rng, RELATIONSHIP_GOAL_DIST as any) as 'slow_burn' | 'serious' | 'friend_first';
    const answers = generateAnswers(rng, personality, goal);
    const intro = chance(rng, 0.4) ? pick(rng, INTRO_PROMPTS) : undefined;

    if (intro) answers.intro_prompt = intro;
    if (chance(rng, 0.3)) answers.q19 = pick(rng, Q19_DEALBREAKERS);
    if (chance(rng, 0.2)) answers.q20 = pick(rng, Q20_NOTES);

    const created_at = new Date(baseDate + randInt(rng, 0, 30 * 24 * 3600 * 1000)).toISOString();
    const last_active_at = new Date(
      Math.min(Date.now(), new Date(created_at).getTime() + randInt(rng, 0, 7 * 24 * 3600 * 1000)),
    ).toISOString();

    out.push({
      id: pseudoId('user', i),
      username: generateUsername(rng, gender, i),
      school_key: 'ecnu',
      profile: {
        campus: campus as any,
        grade_label: grade as any,
        academy,
        gender_identity: gender,
        desired_genders: desired,
        smoking_preference: smoking as any,
        long_distance_preference: long_distance as any,
        routine: routine as any,
        hobbies,
        personality_tags: personality,
        relationship_goal: goal,
        relationship_role: answers.relationship_role,
        relationship_needs: answers.relationship_needs,
        intro_prompt: intro,
      },
      answers,
      metadata: {
        created_at,
        last_active_at,
        seed_index: i,
      },
    });
  }

  return out;
}
