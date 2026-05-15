export type DatingFieldType = 'single' | 'single_with_other' | 'multi' | 'text' | 'scale';

export interface DatingFieldOption {
  value: string;
  label: string;
}

export interface DatingQuestionField {
  id: string;
  type: DatingFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  description?: string;
  maxLength?: number;
  minSelections?: number;
  maxSelections?: number;
  options?: DatingFieldOption[];
  scale?: {
    min: number;
    max: number;
    minLabel: string;
    maxLabel: string;
  };
}

export interface DatingQuestionnaireDefinition {
  versionKey: string;
  schoolKey: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  profileFields: DatingQuestionField[];
  questions: DatingQuestionField[];
  scoringProfile: Record<string, unknown>;
}

const scale7 = {
  min: 1,
  max: 7,
  minLabel: '非常不同意',
  maxLabel: '非常同意',
} as const;

export const ECNU_DATING_QUESTIONNAIRE: DatingQuestionnaireDefinition = {
  versionKey: 'ecnu-spring-2026-v17',
  schoolKey: 'ecnu',
  title: '华东师大春季匹配问卷',
  description: '先完成基础资料，再回答匹配题。答完后即可设置账号，进入每周一次的揭晓池。',
  estimatedMinutes: 15,
  profileFields: [
    {
      id: 'display_name',
      type: 'text',
      label: '给自己起个昵称吧',
      required: false,
      placeholder: '不填的话系统会随机生成～',
      maxLength: 16,
    },
    {
      id: 'campus',
      type: 'single',
      label: '你平时更常待在哪个校区？',
      required: true,
      options: [
        { value: 'minhang', label: '闵行' },
        { value: 'putuo', label: '普陀' },
        { value: 'lingang', label: '临港' },
        { value: 'both', label: '不固定 / 多校区' },
      ],
    },
    {
      id: 'grade_label',
      type: 'single',
      label: '你现在的年级',
      required: true,
      options: [
        { value: 'undergrad_1', label: '本科一年级' },
        { value: 'undergrad_2', label: '本科二年级' },
        { value: 'undergrad_3', label: '本科三年级' },
        { value: 'undergrad_4', label: '本科四年级' },
        { value: 'master', label: '硕士阶段' },
        { value: 'doctor', label: '博士阶段' },
      ],
    },
    {
      id: 'academy',
      type: 'single_with_other',
      label: '你的学院',
      required: true,
      placeholder: '输入你的学院或专业',
      options: [
        { value: '教育学部', label: '教育学部' },
        { value: '地球科学学部', label: '地球科学学部' },
        { value: '信息学部', label: '信息学部' },
        { value: '经济与管理学部', label: '经济与管理学部' },
        { value: '中国语言文学系', label: '中国语言文学系' },
        { value: '历史学系', label: '历史学系' },
        { value: '哲学系', label: '哲学系' },
        { value: '外语学院', label: '外语学院' },
        { value: '传播学院', label: '传播学院' },
        { value: '国际汉语文化学院', label: '国际汉语文化学院' },
        { value: '思勉人文高等研究院', label: '思勉人文高等研究院' },
        { value: '心理与认知科学学院', label: '心理与认知科学学院' },
        { value: '体育与健康学院', label: '体育与健康学院' },
        { value: '马克思主义学院', label: '马克思主义学院' },
        { value: '政治与国际关系学院', label: '政治与国际关系学院' },
        { value: '社会发展学院', label: '社会发展学院' },
        { value: '法学院', label: '法学院' },
        { value: '经济与管理学院', label: '经济与管理学院' },
        { value: '公共管理学院', label: '公共管理学院' },
        { value: '统计学院', label: '统计学院' },
        { value: '数学科学学院', label: '数学科学学院' },
        { value: '物理学院', label: '物理学院' },
        { value: '化学与分子工程学院', label: '化学与分子工程学院' },
        { value: '生命科学学院', label: '生命科学学院' },
        { value: '地理科学学院', label: '地理科学学院' },
        { value: '生态与环境科学学院', label: '生态与环境科学学院' },
        { value: '海洋科学学院', label: '河口海岸科学研究院（海洋科学学院）' },
        { value: '计算机科学与技术学院', label: '计算机科学与技术学院' },
        { value: '软件工程学院', label: '软件工程学院' },
        { value: '数据科学与工程学院', label: '数据科学与工程学院' },
        { value: '信息与电子工程学院', label: '信息与电子工程学院（集成电路科学与工程学院）' },
        { value: '空间人工智能学院', label: '空间人工智能学院' },
        { value: '药学院', label: '药学院' },
        { value: '音乐学院', label: '音乐学院' },
        { value: '美术学院', label: '美术学院' },
        { value: '设计学院', label: '设计学院' },
        { value: '上海国际首席技术官学院', label: '上海国际首席技术官学院' },
        { value: '孟宪承书院', label: '孟宪承书院' },
        { value: '大夏书院', label: '大夏书院' },
        { value: '光华书院', label: '光华书院' },
        { value: '__other__', label: '其他' },
      ],
    },
    {
      id: 'gender_identity',
      type: 'single',
      label: '你的性别认同',
      required: true,
      options: [
        { value: 'female', label: '女生' },
        { value: 'male', label: '男生' },
        { value: 'non_binary', label: '非二元 / 其他' },
      ],
    },
    {
      id: 'desired_genders',
      type: 'multi',
      label: '你希望匹配到的性别',
      required: true,
      maxSelections: 3,
      options: [
        { value: 'female', label: '女生' },
        { value: 'male', label: '男生' },
        { value: 'non_binary', label: '非二元 / 其他' },
      ],
    },
    {
      id: 'smoking_preference',
      type: 'single',
      label: '你对吸烟的接受度',
      required: true,
      options: [
        { value: 'accept', label: '可以接受' },
        { value: 'prefer_no', label: '尽量不要' },
        { value: 'reject', label: '完全不能接受' },
      ],
    },
    {
      id: 'long_distance_preference',
      type: 'single',
      label: '你对毕业后异地 / 离沪的接受度',
      required: true,
      options: [
        { value: 'accept', label: '可以接受' },
        { value: 'depends', label: '看人再说' },
        { value: 'reject', label: '基本不能接受' },
      ],
    },
    {
      id: 'hobbies',
      type: 'multi',
      label: '你的兴趣爱好（可多选）',
      required: true,
      maxSelections: 6,
      options: [
        { value: 'sports', label: '运动健身' },
        { value: 'music', label: '音乐' },
        { value: 'movies', label: '电影/追剧' },
        { value: 'reading', label: '阅读' },
        { value: 'gaming', label: '游戏' },
        { value: 'travel', label: '旅行/探店' },
        { value: 'cooking', label: '做饭/美食' },
        { value: 'photography', label: '摄影' },
        { value: 'art', label: '画画/手工' },
        { value: 'outdoor', label: '户外/露营' },
        { value: 'pets', label: '撸猫撸狗' },
        { value: 'dance', label: '舞蹈' },
        { value: 'board_games', label: '桌游/剧本杀' },
        { value: 'volunteering', label: '公益/志愿' },
        { value: 'coding', label: '编程/技术' },
        { value: 'science', label: '科研/实验' },
        { value: 'digital', label: '数码/硬件' },
        { value: 'anime', label: '动漫/二次元' },
        { value: 'fashion', label: '穿搭/时尚' },
        { value: 'writing', label: '写作/创作' },
        { value: 'other', label: '其他' },
      ],
    },
    {
      id: 'personality_tags',
      type: 'multi',
      label: '你觉得自己是什么样的人？',
      required: true,
      minSelections: 1,
      options: [
        { value: 'introverted', label: '内向安静' },
        { value: 'extroverted', label: '外向活泼' },
        { value: 'slow_warm', label: '慢热' },
        { value: 'talkative', label: '话多' },
        { value: 'humorous', label: '幽默搞笑' },
        { value: 'empathetic', label: '共情力强' },
        { value: 'rational', label: '理性冷静' },
        { value: 'romantic', label: '浪漫' },
        { value: 'independent', label: '独立' },
        { value: 'clingy', label: '粘人' },
        { value: 'adventurous', label: '爱冒险' },
        { value: 'homebody', label: '宅' },
        { value: 'organized', label: '有计划' },
        { value: 'spontaneous', label: '随性' },
        { value: 'ambitious', label: '上进心强' },
        { value: 'easygoing', label: '佛系' },
        { value: 'ambivert', label: '内外兼具（看场合）' },
        { value: 'sensitive', label: '敏感细腻' },
        { value: 'curious', label: '好奇心强' },
        { value: 'loyal', label: '重感情/忠诚' },
        { value: 'perfectionist', label: '完美主义' },
        { value: 'carefree', label: '大大咧咧' },
        { value: 'creative', label: '有创意' },
        { value: 'stubborn', label: '有点倔' },
        { value: 'anxious', label: '容易焦虑' },
        { value: 'optimistic', label: '乐观积极' },
      ],
    },
    {
      id: 'routine',
      type: 'single',
      label: '你的作息习惯',
      required: true,
      options: [
        { value: 'early_bird', label: '早起型' },
        { value: 'normal', label: '正常作息' },
        { value: 'night_owl', label: '夜猫子' },
        { value: 'irregular', label: '不固定' },
      ],
    },
  ],
  questions: [
    { id: 'q01', type: 'scale', label: '面对感兴趣的人，我愿意先迈出认识的第一步。', required: true, scale: scale7 },
    { id: 'q02', type: 'scale', label: '即使不完全认同，我也会尽量体面地表达不同意见。', required: true, scale: scale7 },
    { id: 'q03', type: 'scale', label: '约好的时间和安排，我通常会认真守约。', required: true, scale: scale7 },
    { id: 'q04', type: 'scale', label: '一点点冷淡或不确定，会明显影响我的状态。', required: true, scale: scale7 },
    { id: 'q05', type: 'scale', label: '碰到压力时，我通常还能保持基本稳定。', required: true, scale: scale7 },
    { id: 'q06', type: 'scale', label: '我愿意尝试新的活动或新的相处方式。', required: true, scale: scale7 },
    { id: 'q07', type: 'scale', label: '发生矛盾时，我更需要先冷静一下再沟通，而不是马上解决。', required: true, scale: scale7 },
    { id: 'q08', type: 'scale', label: '即使在亲密关系里，我也会下意识保留距离。', required: true, scale: scale7 },
    { id: 'q09', type: 'scale', label: '我能比较自然地表达“我需要你”。', required: true, scale: scale7 },
    { id: 'q10', type: 'scale', label: '我更看重长期的踏实感，而不是短暂的心动。', required: true, scale: scale7 },
    { id: 'q11', type: 'scale', label: '我欣赏对未来有目标感、愿意持续努力的人。', required: true, scale: scale7 },
    { id: 'q12', type: 'scale', label: '发生分歧时，我更愿意把问题说清楚，而不是冷处理。', required: true, scale: scale7 },
    { id: 'q13', type: 'scale', label: '情绪上来时，我容易说出很伤人的话。', required: true, scale: scale7 },
    { id: 'q14', type: 'scale', label: '如果我做错了，我愿意主动道歉和修复。', required: true, scale: scale7 },
    { id: 'q15', type: 'scale', label: '我希望关系里有稳定的沟通频率和回应感。', required: true, scale: scale7 },
    {
      id: 'relationship_goal',
      type: 'single',
      label: '你现在更想要哪种关系节奏？',
      required: true,
      options: [
        { value: 'serious', label: '认真开始一段关系' },
        { value: 'slow_burn', label: '先慢慢认识再看' },
        { value: 'friend_first', label: '先做朋友再决定' },
      ],
    },
    { id: 'q16', type: 'scale', label: '我期待伴侣愿意为见面和相处留出真实时间。', required: true, scale: scale7 },
    { id: 'q17', type: 'scale', label: '我能接受两个人保留各自节奏，但仍然稳定投入。', required: true, scale: scale7 },
    { id: 'q18', type: 'scale', label: '比起“上头很快”，我更偏好慢慢建立安全感。', required: true, scale: scale7 },
    {
      id: 'relationship_needs',
      type: 'multi',
      label: '你在关系中最看重什么？（选 2-3 个）',
      required: true,
      minSelections: 2,
      maxSelections: 3,
      options: [
        { value: 'emotional_companion', label: '精神陪伴（能聊深的，懂我在想什么）' },
        { value: 'grow_together', label: '共同成长（互相督促，一起变好）' },
        { value: 'practical_care', label: '生活照顾（实际行动上的关心）' },
        { value: 'physical_closeness', label: '肢体亲密（牵手、拥抱、靠近的安全感）' },
        { value: 'personal_space', label: '独立空间（各自有节奏，不过度依赖）' },
        { value: 'emotional_value', label: '情绪价值（会哄我、让我开心）' },
        { value: 'shared_experience', label: '共同体验（一起探索新东西、建立回忆）' },
        { value: 'verbal_expression', label: '言语表达（会说想我、夸我、主动沟通）' },
      ],
    },
    {
      id: 'relationship_role',
      type: 'single',
      label: '你在关系里更偏向哪种角色？',
      required: true,
      options: [
        { value: 'caregiver', label: '主动照顾对方的那个' },
        { value: 'receiver', label: '被照顾更多的那个' },
        { value: 'equal', label: '互相平等，不分谁照顾谁' },
        { value: 'flexible', label: '看情况，不固定' },
      ],
    },
    {
      id: 'intro_prompt',
      type: 'text',
      label: '如果第一次见面，你最希望一起做什么？（选填）',
      required: false,
      placeholder: '例如：在闵行校区散步，喝咖啡聊聊最近在做什么',
      maxLength: 160,
    },
    {
      id: 'q19',
      type: 'text',
      label: '你最受不了一段关系里出现什么状态？（选填）',
      required: false,
      placeholder: '一句话描述即可',
      maxLength: 140,
    },
    {
      id: 'q20',
      type: 'text',
      label: '是否有其他补充或要求？（选填）',
      required: false,
      placeholder: '例如：希望对方不要太宅、想找同校区的、对身高有要求等',
      maxLength: 180,
    },
  ],
  scoringProfile: {
    weights: {
      relationship_goal: 0.22,
      attachment_and_security: 0.2,
      communication_and_repair: 0.2,
      lifestyle_and_availability: 0.18,
      values_and_stability: 0.2,
    },
    similarityMethod: 'weighted_cosine_plus_rule_penalty',
    assignmentMethod: 'maximum_weight_bipartite_matching',
  },
};
