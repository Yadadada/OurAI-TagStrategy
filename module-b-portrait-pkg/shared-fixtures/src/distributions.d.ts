export declare const ACADEMY_DIST: readonly [{
    readonly value: "软件工程学院";
    readonly weight: 16;
}, {
    readonly value: "心理与认知科学学院";
    readonly weight: 12;
}, {
    readonly value: "统计学院";
    readonly weight: 9;
}, {
    readonly value: "数学科学学院";
    readonly weight: 9;
}, {
    readonly value: "历史学系";
    readonly weight: 6;
}, {
    readonly value: "地球科学学部";
    readonly weight: 6;
}, {
    readonly value: "经济与管理学部";
    readonly weight: 6;
}, {
    readonly value: "中国语言文学系";
    readonly weight: 6;
}, {
    readonly value: "信息学部";
    readonly weight: 4;
}, {
    readonly value: "生命科学学院";
    readonly weight: 3;
}, {
    readonly value: "马克思主义学院";
    readonly weight: 3;
}, {
    readonly value: "地理科学学院";
    readonly weight: 3;
}, {
    readonly value: "音乐学院";
    readonly weight: 2;
}, {
    readonly value: "网络空间安全学院";
    readonly weight: 2;
}, {
    readonly value: "国际汉语文化学院";
    readonly weight: 2;
}, {
    readonly value: "计算机科学与技术学院";
    readonly weight: 4;
}, {
    readonly value: "数据科学与工程学院";
    readonly weight: 3;
}, {
    readonly value: "物理学院";
    readonly weight: 2;
}, {
    readonly value: "法学院";
    readonly weight: 2;
}];
export declare const CAMPUS_DIST: readonly [{
    readonly value: "putuo";
    readonly weight: 44;
}, {
    readonly value: "minhang";
    readonly weight: 34;
}, {
    readonly value: "both";
    readonly weight: 12;
}, {
    readonly value: "lingang";
    readonly weight: 4;
}, {
    readonly value: "";
    readonly weight: 6;
}];
export declare const GENDER_DIST: readonly [{
    readonly value: "female";
    readonly weight: 69;
}, {
    readonly value: "male";
    readonly weight: 25;
}, {
    readonly value: "non_binary";
    readonly weight: 1;
}, {
    readonly value: "";
    readonly weight: 5;
}];
export declare const GRADE_DIST: readonly [{
    readonly value: "master";
    readonly weight: 28;
}, {
    readonly value: "undergrad_3";
    readonly weight: 28;
}, {
    readonly value: "undergrad_1";
    readonly weight: 22;
}, {
    readonly value: "undergrad_4";
    readonly weight: 9;
}, {
    readonly value: "undergrad_2";
    readonly weight: 4;
}, {
    readonly value: "doctor";
    readonly weight: 3;
}, {
    readonly value: "";
    readonly weight: 6;
}];
export declare const SMOKING_DIST: readonly [{
    readonly value: "reject";
    readonly weight: 66;
}, {
    readonly value: "prefer_no";
    readonly weight: 28;
}, {
    readonly value: "accept";
    readonly weight: 1;
}, {
    readonly value: "";
    readonly weight: 5;
}];
export declare const LONG_DISTANCE_DIST: readonly [{
    readonly value: "depends";
    readonly weight: 50;
}, {
    readonly value: "accept";
    readonly weight: 28;
}, {
    readonly value: "reject";
    readonly weight: 16;
}, {
    readonly value: "";
    readonly weight: 6;
}];
export declare const ROUTINE_DIST: readonly [{
    readonly value: "normal";
    readonly weight: 35;
}, {
    readonly value: "night_owl";
    readonly weight: 30;
}, {
    readonly value: "irregular";
    readonly weight: 25;
}, {
    readonly value: "early_bird";
    readonly weight: 10;
}];
export declare const RELATIONSHIP_GOAL_DIST: readonly [{
    readonly value: "slow_burn";
    readonly weight: 50;
}, {
    readonly value: "serious";
    readonly weight: 30;
}, {
    readonly value: "friend_first";
    readonly weight: 20;
}];
export declare const RELATIONSHIP_ROLE_DIST: readonly [{
    readonly value: "flexible";
    readonly weight: 35;
}, {
    readonly value: "equal";
    readonly weight: 35;
}, {
    readonly value: "caregiver";
    readonly weight: 18;
}, {
    readonly value: "receiver";
    readonly weight: 12;
}];
export declare const HOBBIES: readonly ["sports", "music", "movies", "reading", "gaming", "travel", "cooking", "photography", "art", "outdoor", "pets", "dance", "board_games", "volunteering", "coding", "science", "digital", "anime", "fashion", "writing"];
export declare const PERSONALITY_TAGS: readonly ["introverted", "extroverted", "slow_warm", "talkative", "humorous", "empathetic", "rational", "romantic", "independent", "clingy", "adventurous", "homebody", "organized", "spontaneous", "ambitious", "easygoing", "ambivert", "sensitive", "curious", "loyal", "perfectionist", "carefree", "creative", "stubborn", "anxious", "optimistic"];
export declare const RELATIONSHIP_NEEDS: readonly ["emotional_companion", "grow_together", "practical_care", "physical_closeness", "personal_space", "emotional_value", "shared_experience", "verbal_expression"];
export declare const ACADEMY_HOBBY_BIAS: Record<string, readonly string[]>;
export declare const ACADEMY_PERSONALITY_BIAS: Record<string, readonly string[]>;
export declare const PERSONALITY_LIKERT_BIAS: Record<string, Partial<Record<string, number>>>;
export declare const FEEDBACK_TYPES: readonly [{
    readonly value: "liked";
    readonly weight: 25;
}, {
    readonly value: "passed";
    readonly weight: 35;
}, {
    readonly value: "dismissed";
    readonly weight: 25;
}, {
    readonly value: "chatted";
    readonly weight: 10;
}, {
    readonly value: "met";
    readonly weight: 4;
}, {
    readonly value: "blocked";
    readonly weight: 1;
}];
export declare const MBTI_TYPE_PRIOR: Record<string, number>;
export declare const ACTIVE_HOUR_DIST_UTC: Record<number, number>;
