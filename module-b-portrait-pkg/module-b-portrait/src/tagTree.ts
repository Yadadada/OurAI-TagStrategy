/**
 * 文本标签树定义
 *
 * 为 Q22(intro_prompt) / Q23(q19) / Q24(q20) 三个文本回答字段
 * 定义"固定主标签 + 半开放子标签"的分级标签体系。
 *
 * 设计原则：
 * - 主标签严格枚举，LLM 输出必须在列表内
 * - 子标签提供预设参考，但允许 LLM 输出新子标签
 * - Q22 额外有"互动方式"横切维度（强互动/弱互动）
 */

// ---------------------------------------------------------------------------
// 通用类型
// ---------------------------------------------------------------------------

export interface TagCategory {
  id: string;
  label: string;
  description: string;
  presetSubs: string[];
}

export interface ExtractedTag {
  main: string;
  sub: string;
  weight: number;
  quote: string;
}

export type InteractionMode = 'strong' | 'weak' | null;

export interface Q22TagResult {
  fieldId: 'intro_prompt';
  rawText: string;
  sceneTags: ExtractedTag[];
  interactionMode: InteractionMode;
  extractedAt: string;
  modelId: string;
}

export interface TextTagResult {
  fieldId: 'q19' | 'q20';
  rawText: string;
  tags: ExtractedTag[];
  extractedAt: string;
  modelId: string;
}

export type AnyTagResult = Q22TagResult | TextTagResult;

// ---------------------------------------------------------------------------
// Q22 见面偏好标签树 — 5 场景主标签 + 互动维度
// ---------------------------------------------------------------------------

export const Q22_SCENE_TAGS: TagCategory[] = [
  {
    id: 'food_social',
    label: '美食社交',
    description: '吃喝相关的活动，包括各类餐饮、饮品',
    presetSubs: [
      '咖啡', '奶茶', '火锅', '烧烤', '日料', '西餐',
      '甜品', '小吃', '奶茶店', '面馆', '烘焙', '冰淇淋',
    ],
  },
  {
    id: 'entertainment',
    label: '文娱体验',
    description: '看/玩/创作类活动，包括观影、展览、游戏、手工等',
    presetSubs: [
      '电影', '展览', '音乐会', '话剧', '剧本杀', '桌游',
      '密室逃脱', 'KTV', '手工', '画画', '摄影',
    ],
  },
  {
    id: 'sports_outdoor',
    label: '运动户外',
    description: '需要动起来的活动，体育运动或户外探索',
    presetSubs: [
      '跑步', '球类', '骑行', '爬山', '游泳', '健身',
      '滑板', '飞盘', '露营', '钓鱼', '攀岩',
    ],
  },
  {
    id: 'stroll',
    label: '散步闲逛',
    description: '低负担轻互动，随意走走看看',
    presetSubs: [
      '校园散步', '河边走走', '逛街', '逛公园',
      '压马路', '看夜景', '骑共享单车闲逛',
    ],
  },
  {
    id: 'study_together',
    label: '学习共处',
    description: '功能性陪伴，一起学习或安静共处',
    presetSubs: [
      '图书馆', '自习室', '一起看书', '一起做作业',
      '一起写代码', '泡实验室',
    ],
  },
];

export const Q22_INTERACTION_MODES = {
  strong: {
    label: '强互动',
    description: '聊天/深聊/分享/讨论',
    keywords: ['聊聊天', '分享近况', '深入交流', '谈心', '聊天', '聊聊', '深聊', '畅谈'],
  },
  weak: {
    label: '弱互动',
    description: '安静陪伴/各做各的',
    keywords: ['安静待着', '各自看书', '不用说太多话', '安静陪伴', '各做各的'],
  },
} as const;

export const Q22_MAIN_IDS = Q22_SCENE_TAGS.map((t) => t.id);

// ---------------------------------------------------------------------------
// Q23 关系雷区标签树 — 5 类
// ---------------------------------------------------------------------------

export const Q23_TAGS: TagCategory[] = [
  {
    id: 'communication_breakdown',
    label: '沟通断裂',
    description: '不沟通/冷处理/消失，沟通方式出问题',
    presetSubs: [
      '冷暴力', '已读不回', '不主动沟通', '逃避问题', '沉默对抗',
      '消失不解释', '吵架后冷战', '有话不直说', '阴阳怪气',
    ],
  },
  {
    id: 'dishonesty',
    label: '不真诚',
    description: '说谎/欺骗/隐瞒，诚信相关问题',
    presetSubs: [
      '说谎', '隐瞒', '脚踏两船', '表里不一', '虚伪',
      '画饼', '嘴上一套做一套', '出轨', '暧昧不清',
    ],
  },
  {
    id: 'emotional_neglect',
    label: '情感敷衍',
    description: '不用心/不投入/忽视对方感受',
    presetSubs: [
      '敷衍了事', '三心二意', '忽冷忽热', '不上心', '缺乏仪式感',
      '理所当然', '不记得重要日子', '没有回应', '态度随意',
    ],
  },
  {
    id: 'boundary_violation',
    label: '边界侵犯',
    description: '控制/越界/不尊重对方的边界和隐私',
    presetSubs: [
      '控制欲', '查手机', '过度干涉', '不尊重隐私', '跟踪',
      '限制社交', '翻旧账', '道德绑架', 'PUA', '人身攻击',
    ],
  },
  {
    id: 'over_demanding',
    label: '过度索取',
    description: '索取大于付出，自私自利',
    presetSubs: [
      '只索取不付出', '情感吸血', '自私自利', '把人当工具',
      '经济索取', '时间绑架', '精神内耗', '要求过高', '单方面牺牲',
    ],
  },
];

export const Q23_MAIN_IDS = Q23_TAGS.map((t) => t.id);

// ---------------------------------------------------------------------------
// Q24 补充要求标签树 — 7 类
// ---------------------------------------------------------------------------

export const Q24_TAGS: TagCategory[] = [
  {
    id: 'personality',
    label: '性格气质',
    description: '对对方性格、人格特质的期望',
    presetSubs: [
      '开朗', '幽默', '温柔', '阳光', '不内向', '有趣',
      '成熟稳重', '善良', '真诚', '大方', '有耐心', '情绪稳定',
    ],
  },
  {
    id: 'lifestyle',
    label: '生活方式',
    description: '日常习惯、兴趣爱好的匹配期望',
    presetSubs: [
      '爱运动', '不吸烟', '不酗酒', '有共同爱好', '饮食习惯相近',
      '作息规律', '爱整洁', '不说脏话', '喜欢音乐', '爱看书',
    ],
  },
  {
    id: 'relationship_pace',
    label: '关系节奏',
    description: '对相处速度、推进频率的期望',
    presetSubs: [
      '慢慢来', '不急着确定', '给彼此空间', '稳步发展',
      '不要太快推进', '先了解再决定',
    ],
  },
  {
    id: 'independence',
    label: '独立空间',
    description: '希望各自保持独立、不过度黏腻',
    presetSubs: [
      '有自己的生活', '不过度依赖', '保持各自社交', '独立',
      '不粘人', '有自己的圈子', '各自有事做',
    ],
  },
  {
    id: 'location_conditions',
    label: '地域条件',
    description: '校区、距离、年级等硬性条件',
    presetSubs: [
      '同校区', '同城', '身高要求', '年级相近', '年龄差距小', '同专业方向',
    ],
  },
  {
    id: 'appearance',
    label: '外貌形象',
    description: '对外貌、穿搭、体型的期望',
    presetSubs: [
      '身高', '体型', '穿搭风格', '干净整洁', '有气质', '运动型身材', '不邋遢',
    ],
  },
  {
    id: 'values',
    label: '价值观与人生观',
    description: '三观、责任感、人生规划相关期望',
    presetSubs: [
      '三观一致', '有责任感', '上进心', '有规划', '对未来规划一致',
      '对感情认真', '有目标感', '独立思考', '尊重平等',
    ],
  },
];

export const Q24_MAIN_IDS = Q24_TAGS.map((t) => t.id);

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

export function getTagTreeForField(fieldId: 'intro_prompt' | 'q19' | 'q20'): TagCategory[] {
  switch (fieldId) {
    case 'intro_prompt': return Q22_SCENE_TAGS;
    case 'q19': return Q23_TAGS;
    case 'q20': return Q24_TAGS;
  }
}

export function getMainIdsForField(fieldId: 'intro_prompt' | 'q19' | 'q20'): string[] {
  switch (fieldId) {
    case 'intro_prompt': return Q22_MAIN_IDS;
    case 'q19': return Q23_MAIN_IDS;
    case 'q20': return Q24_MAIN_IDS;
  }
}

export function isValidMainTag(fieldId: 'intro_prompt' | 'q19' | 'q20', mainId: string): boolean {
  return getMainIdsForField(fieldId).includes(mainId);
}
