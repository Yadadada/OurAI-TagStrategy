import { clipInt, gauss, makeRng } from './random.js';
// MBTI axes derived from Likert answers + personality tags.
// 0 = E/S/T/J, 100 = I/N/F/P (matching production user_portrait.mbti_ei layout).
function mbtiFromUser(user, rng) {
    const a = user.answers;
    const tags = new Set(user.profile.personality_tags);
    // E/I: q01 (proactive), q09 (express need), tags introverted/extroverted
    let ei = 50;
    ei += (4 - a.q01) * 6; // low q01 -> introverted -> +I
    ei += (4 - a.q09) * 4;
    if (tags.has('introverted'))
        ei += 18;
    if (tags.has('extroverted'))
        ei -= 18;
    if (tags.has('homebody'))
        ei += 8;
    if (tags.has('talkative'))
        ei -= 10;
    ei += gauss(rng, 0, 6);
    // S/N: openness (q06) + creative/curious tags
    let sn = 50;
    sn += (a.q06 - 4) * 5;
    if (tags.has('creative'))
        sn += 14;
    if (tags.has('curious'))
        sn += 8;
    if (tags.has('rational'))
        sn -= 6;
    if (tags.has('organized'))
        sn -= 8;
    sn += gauss(rng, 0, 6);
    // T/F: empathetic vs rational; q05 (calm under pressure) leans T
    let tf = 50;
    if (tags.has('empathetic'))
        tf += 18;
    if (tags.has('sensitive'))
        tf += 12;
    if (tags.has('romantic'))
        tf += 8;
    if (tags.has('rational'))
        tf -= 18;
    tf += (a.q14 - 4) * 4; // willingness to apologize -> F
    tf += gauss(rng, 0, 6);
    // J/P: organized -> J; spontaneous -> P; q03 (punctual) -> J
    let jp = 50;
    jp += (4 - a.q03) * 6;
    if (tags.has('organized'))
        jp -= 16;
    if (tags.has('perfectionist'))
        jp -= 10;
    if (tags.has('spontaneous'))
        jp += 16;
    if (tags.has('carefree'))
        jp += 8;
    jp += gauss(rng, 0, 6);
    ei = clipInt(ei, 0, 100);
    sn = clipInt(sn, 0, 100);
    tf = clipInt(tf, 0, 100);
    jp = clipInt(jp, 0, 100);
    const type = `${ei >= 50 ? 'I' : 'E'}${sn >= 50 ? 'N' : 'S'}${tf >= 50 ? 'F' : 'T'}${jp >= 50 ? 'P' : 'J'}`;
    return { ei, sn, tf, jp, type };
}
const ARCHETYPES = {
    INFP: { name: '理想主义梦行者', one_liner: '会写小说也会哭' },
    INFJ: { name: '安静的洞察者', one_liner: '看一眼就懂你' },
    ISFJ: { name: '温柔的守护者', one_liner: '默默把事情打理好' },
    ISTJ: { name: '可靠的执行人', one_liner: '说到做到不掉链子' },
    ISFP: { name: '感性的艺术家', one_liner: '低声美学家' },
    INTP: { name: '深思的探究者', one_liner: '一个人能玩三天' },
    ISTP: { name: '冷静的工匠', one_liner: '动手解决一切' },
    INTJ: { name: '战略型独行者', one_liner: '十年规划已就位' },
    ENFP: { name: '热情的连接者', one_liner: '每天都在发光' },
    ENFJ: { name: '温暖的引路人', one_liner: '会照顾每一个人' },
    ESFJ: { name: '社交型暖心人', one_liner: '聚会少不了你' },
    ESTJ: { name: '高效的指挥官', one_liner: '把混乱整理成清单' },
    ESFP: { name: '舞台中央的乐天派', one_liner: '走到哪里都热闹' },
    ESTP: { name: '行动派冒险家', one_liner: '想到就立刻去做' },
    ENTP: { name: '点子机器人', one_liner: '一周一个新计划' },
    ENTJ: { name: '推进型领导者', one_liner: '把目标变成现实' },
};
function buildTraits(user, rng) {
    const a = user.answers;
    const tags = new Set(user.profile.personality_tags);
    const v = (mean, sd = 8) => clipInt(gauss(rng, mean, sd), 0, 100);
    // Map Likert + tags to 0-100 trait scores. Each trait blends 2-3 signals.
    const extroversion = v(60 - (4 - a.q01) * 8 + (tags.has('extroverted') ? 20 : 0) - (tags.has('introverted') ? 20 : 0));
    const openness = v(50 + (a.q06 - 4) * 8 + (tags.has('curious') ? 15 : 0) + (tags.has('creative') ? 12 : 0));
    const conscientiousness = v(50 + (a.q03 - 4) * 8 + (tags.has('organized') ? 15 : 0) - (tags.has('spontaneous') ? 8 : 0));
    const agreeableness = v(55 + (a.q14 - 4) * 6 + (tags.has('empathetic') ? 12 : 0) - (tags.has('stubborn') ? 8 : 0));
    const emotional_stability = v(50 + (a.q05 - 4) * 8 - (tags.has('anxious') ? 18 : 0) + (tags.has('optimistic') ? 8 : 0));
    const logic_score = v(50 + (tags.has('rational') ? 22 : 0));
    const creativity_score = v(50 + (tags.has('creative') ? 22 : 0) + (tags.has('curious') ? 6 : 0));
    const eq_score = v(55 + (tags.has('empathetic') ? 18 : 0) + (a.q02 - 4) * 4);
    const execution_score = v(50 + (tags.has('ambitious') ? 18 : 0) + (a.q11 - 4) * 4);
    const curiosity_score = v(50 + (tags.has('curious') ? 22 : 0) + (a.q06 - 4) * 4);
    const social_score = v(50 + extroversion * 0.3 - 15 + (tags.has('talkative') ? 10 : 0));
    return {
        extroversion, openness, conscientiousness, agreeableness, emotional_stability,
        logic_score, creativity_score, eq_score, execution_score, curiosity_score, social_score,
    };
}
const HOBBY_TO_INTERESTS = {
    sports: [{ tag: '运动健身', category: 'lifestyle' }, { tag: '跑步', category: 'lifestyle' }],
    music: [{ tag: '音乐', category: 'art' }, { tag: 'live演出', category: 'art' }],
    movies: [{ tag: '电影', category: 'media' }, { tag: '追剧', category: 'media' }],
    reading: [{ tag: '阅读', category: 'media' }, { tag: '小说', category: 'media' }],
    gaming: [{ tag: '游戏', category: 'entertainment' }],
    travel: [{ tag: '旅行', category: 'lifestyle' }, { tag: '探店', category: 'lifestyle' }],
    cooking: [{ tag: '美食', category: 'lifestyle' }, { tag: '做饭', category: 'lifestyle' }],
    photography: [{ tag: '摄影', category: 'art' }],
    art: [{ tag: '画画', category: 'art' }, { tag: '手工', category: 'art' }],
    outdoor: [{ tag: '户外', category: 'lifestyle' }, { tag: '露营', category: 'lifestyle' }],
    pets: [{ tag: '宠物', category: 'lifestyle' }],
    dance: [{ tag: '舞蹈', category: 'art' }],
    board_games: [{ tag: '桌游', category: 'entertainment' }, { tag: '剧本杀', category: 'entertainment' }],
    volunteering: [{ tag: '公益', category: 'social' }],
    coding: [{ tag: '编程', category: 'tech' }],
    science: [{ tag: '科研', category: 'tech' }],
    digital: [{ tag: '数码', category: 'tech' }],
    anime: [{ tag: '动漫', category: 'entertainment' }],
    fashion: [{ tag: '时尚', category: 'lifestyle' }, { tag: '穿搭', category: 'lifestyle' }],
    writing: [{ tag: '写作', category: 'art' }],
};
function buildInterests(user, rng) {
    const interests = [];
    for (const hobby of user.profile.hobbies) {
        const tags = HOBBY_TO_INTERESTS[hobby] ?? [];
        for (const t of tags) {
            interests.push({
                tag_name: t.tag,
                category: t.category,
                weight: clipInt(gauss(rng, 65, 18), 30, 100),
                mention_count: clipInt(gauss(rng, 4, 3), 1, 30),
            });
        }
    }
    return interests;
}
export function generatePortraits(users, seed) {
    const rng = makeRng(seed);
    return users.map((user) => {
        const mbti = mbtiFromUser(user, rng);
        const archetype = ARCHETYPES[mbti.type] ?? { name: '兼容型', one_liner: '看场合切换' };
        const sample_count = (user.answers.q19 ? 1 : 0) + (user.answers.q20 ? 1 : 0) + 18;
        const confidence = sample_count >= 22 ? 'high' : sample_count >= 18 ? 'medium' : 'low';
        return {
            user_id: user.id,
            mbti: {
                mbti_type: mbti.type,
                mbti_ei: mbti.ei,
                mbti_sn: mbti.sn,
                mbti_tf: mbti.tf,
                mbti_jp: mbti.jp,
                mbti_confidence: confidence,
                archetype: archetype.name,
                one_liner: archetype.one_liner,
            },
            traits: buildTraits(user, rng),
            interests: buildInterests(user, rng),
        };
    });
}
