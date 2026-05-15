/**
 * Ourai Dating · 校园恋爱人格卡片类型库
 *
 * 25 个常规类型 + 1 个兜底（HALO） + 4 个隐藏触发型
 * 全部为本项目原创，专为校园恋爱场景设计。
 *
 * 15 维顺序（必须与 personaCard.ts 中 DIM_ORDER 严格对应）：
 *  1. SELF_EXPR     自我表达直接度
 *  2. STRUCTURE     守约结构感
 *  3. EMO_STAB      情绪稳定
 *  4. SECURITY      安全感
 *  5. EXPLORE       探索开放度
 *  6. VALUES        价值观稳定
 *  7. REPAIR        修复能力
 *  8. COMMIT        投入意愿
 *  9. EMPATHY       共情敏感度
 * 10. PACE          关系节奏（profile）
 * 11. DISTANCE      距离接受度（profile）
 * 12. VICE          生活习惯接受度（profile）
 * 13. INTRO_DENSITY 见面意象具体度（intro_prompt 文本）
 * 14. REDLINE       关系雷区强度（q19 文本）
 * 15. ICEBREAK      破冰主动度（q20 文本）
 *
 * pattern 是 15 字符的 'L'|'M'|'H' 字符串，用于和用户向量做 L1 距离匹配。
 */

export type LMH = 'L' | 'M' | 'H';

export interface SbtiTypeDef {
  code: string;          // 'SPARK' / 'GHOST' / 'NOVA' — 3-5 字母自由格式
  nickname: string;      // 中文昵称
  catchphrase: string;   // 标语 / 一句话口头禅
  pattern: string;       // 15 字符 L/M/H
  palette: { from: string; to: string; accent: string };
  emoji: string;
  /** 插画图片路径（相对于 /ecbti/，为空时 fallback 到 emoji） */
  illustrationUrl?: string;
  /** 固定类型解读：基于 15 维度模式的标准解读（不依赖 LLM） */
  typeInterpretation: string;
  /** 恋爱中的优势标签 */
  strengths: string[];
  /** 恋爱中的挑战标签 */
  challenges: string[];
  fallbackSummary: string;
  fallbackHighlights: string[];
  hiddenTagline: string;
  category: 'standard' | 'fallback' | 'hidden';
  trigger?: PersonaTrigger;
}

/**
 * 隐藏人格触发器：扫描用户文本字段，命中任一关键词即强制覆盖结果
 */
export interface PersonaTrigger {
  scanFields: Array<'intro_prompt' | 'q19' | 'q20'>;
  keywords: string[];      // 命中其中之一即触发
  badge: string;
  kicker: string;
  sub: string;
}

// 标准 25 型 ----------------------------------------------------------------

export const ECBTI_TYPES: SbtiTypeDef[] = [
  {
    code: 'SPARK', nickname: '电火花', catchphrase: '三句话内决定要不要奔现。',
    pattern: 'HMMHHMMHMHMMHHH',
    palette: { from: '#FFD7A6', to: '#FF6F3C', accent: '#C9440E' }, emoji: '⚡',
    illustrationUrl: '/ecbti/01_SPARK.jpg',
    typeInterpretation: '别人还在纠结"要不要加个微信"的时候，你已经在心里排好了第一次约会的咖啡馆。你对人的直觉快到像开了挂——聊三句就知道对面这个人值不值得再见一面。但你心里知道，你不是真的那么急，你只是太怕那种"本来可以但没来得及"的遗憾。你真正想要的不是速度，是一个让你觉得"不用赶了，TA就在那里"的人。',
    strengths: ['破冰王者', '行动力极强', '判断精准'],
    challenges: ['耐心值偏低', '容易过早下结论', '冷却期管理'],
    fallbackSummary: '你的恋爱启动键灵敏度满格。一个眼神、一段对话节奏，你就能判断"这个能不能再多见一面"。喜欢的人会觉得你像一阵风——来得快、上得快、温度也高，但需要一个跟得上节奏的人接住。',
    fallbackHighlights: ['判断力比谨慎更靠前', '上头不需要预热', '需要的不是慢热是同频'],
    hiddenTagline: '你火光后面，藏着一句"别让我一个人烧"。', category: 'standard',
  },
  {
    code: 'EMBER', nickname: '余烬型', catchphrase: '我烧得慢，但烧得久。',
    pattern: 'LHHHLHHHHLLLMHL',
    palette: { from: '#F1E0D0', to: '#C97A4F', accent: '#7A4220' }, emoji: '🔥',
    illustrationUrl: '/ecbti/02_EMBER.jpg',
    typeInterpretation: '你喜欢一个人的方式，是连续三个月都坐在TA常去的那张桌子对面，但一句话都没多说。你不是没有感觉，你只是觉得"如果是真的，就不需要急"。你的温度全埋在行为里：记住TA随口提过的口味、默默帮TA占位子、在TA不知道的地方把事情安排好。最让你害怕的不是被拒绝，是终于鼓起勇气的那天，发现TA已经走了。',
    strengths: ['长期稳定', '认定不移', '内在温度极高'],
    challenges: ['表达滞后', '容易被误读为冷淡', '放手困难'],
    fallbackSummary: '你不要"瞬间燃爆"，要"长久温度"。你的恋爱节奏是先认识半年再决定要不要表达，但一旦认定了就不会换人。对方一开始会觉得你冷，后来会发现你是那种只熄灭一次就再也点不回来的火。',
    fallbackHighlights: ['长期主义者', '不爱拉警报', '一旦放手就是真放手'],
    hiddenTagline: '余烬最怕被一阵冷风吹散。', category: 'standard',
  },
  {
    code: 'NOVA', nickname: '一见星人', catchphrase: '一秒入坑，三天结婚。',
    pattern: 'HMLLHMMHHHHMHHH',
    palette: { from: '#FFB4D2', to: '#E63974', accent: '#C01F58' }, emoji: '💫',
    illustrationUrl: '/ecbti/03_NOVA.jpg',
    typeInterpretation: '你见过TA笑了一次，回宿舍就开始循环TA朋友圈里的每一条动态。你不是恋爱脑，你只是心动这件事对你来说没有"观望"这个选项——要么全部涌进来，要么什么都没有。你最甜的时候可以让全世界都变成粉色滤镜，但你也知道那种浓度退潮后的空旷有多难捱。你真正想找的，不是一个让你上头的人，是一个在你退潮以后还愿意站在岸边的人。',
    strengths: ['心动灵敏度极高', '情绪浓度满格', '投入毫无保留'],
    challenges: ['安全感波动', '冷却后落差大', '容易理想化'],
    fallbackSummary: '你信奉"心动是真的"。第一眼对了，剩下的全是细节。约会前你已经预演过 7 个场景，约会中你能把对方的表情解码成情书，约会后你会失眠到凌晨——好的失眠。',
    fallbackHighlights: ['一见钟情真信徒', '情绪 fps 比常人高三倍', '需要的是同样浓度的回响'],
    hiddenTagline: '你怕的不是被拒绝，是没人看见你心动。', category: 'standard',
  },
  {
    code: 'COCO', nickname: '咖啡馆约会人', catchphrase: '一定要找个能坐三小时的地方。',
    pattern: 'MHHHMHHHHMMMHMM',
    palette: { from: '#E7D4B8', to: '#9B6A3F', accent: '#5A3A1A' }, emoji: '☕',
    illustrationUrl: '/ecbti/04_COCO.jpg',
    typeInterpretation: '你理想中的约会不是电影院也不是游乐场，是一家安静到能听见对方搅拌咖啡的店，你们从专业课聊到童年记忆再聊到"你觉得人为什么需要另一个人"。你衡量一段关系的标准从来不是TA送了什么礼物，而是"我们能不能聊到忘记时间"。唯一的问题是你从来不会主动发出那个信号——对方可能等了很久那句"周末有空吗"，而你一直在等TA先开口。',
    strengths: ['对话质量极高', '安全感满分', '关系修复力强'],
    challenges: ['主动性偏低', '不擅长仪式感', '慢热到对方可能先走'],
    fallbackSummary: '你的恋爱起点是一杯咖啡 + 一段安静的对话。比起热闹的局，你更愿意约一个能坐下来聊三小时的咖啡馆，把对方的近况、爱好、烦恼问得清清楚楚。慢，但稳。',
    fallbackHighlights: ['用对话浓度衡量喜欢', '讨厌走过场约会', '需要一个能聊完三杯拿铁的人'],
    hiddenTagline: '你那张靠窗的桌子，一直留着。', category: 'standard',
  },
  {
    code: 'WALK', nickname: '散步型恋人', catchphrase: '边走边聊就够了。',
    pattern: 'MMHHHMHHHMMMHLH',
    palette: { from: '#CDE7B0', to: '#6BAA75', accent: '#3F7A47' }, emoji: '🚶',
    illustrationUrl: '/ecbti/05_WALK.jpg',
    typeInterpretation: '你记忆里最好的画面不是什么特别的日子，是某个周三傍晚两个人沿着校园河边走了四十分钟，什么都聊了又好像什么都没聊，最后在路灯下站了一会儿才各自回去。你不需要惊喜，不需要仪式，你只需要"旁边有个人，不用说什么也很舒服"的那种感觉。你最怕的不是对方不够浪漫，是有一天那条路上只剩你一个人走。',
    strengths: ['零压力陪伴', '自然真实', '长期稳定型'],
    challenges: ['仪式感缺失', '关键时刻推进不足', '容易被误解为没心动'],
    fallbackSummary: '你最浪漫的画面不是烛光晚餐，是某个傍晚两个人并排走路、随口聊到生命的来去。你不爱压力，喜欢自然展开的关系。能和你走完一条三公里的小路，多半就能走得更远。',
    fallbackHighlights: ['用步速测节奏', '讨厌仪式感堆出来的紧张', '愿意为了散步绕路'],
    hiddenTagline: '你那条最熟的路上留了半步空位。', category: 'standard',
  },
  {
    code: 'TIDE', nickname: '潮汐型', catchphrase: '我按时来，按时走。',
    pattern: 'MHHHLHHHMHLLMHM',
    palette: { from: '#BFE0F2', to: '#3A7BA8', accent: '#1A4F75' }, emoji: '🌊',
    illustrationUrl: '/ecbti/06_TIDE.jpg',
    typeInterpretation: '你手机里最整齐的不是相册，是和TA的聊天记录——因为你每天晚上九点会准时发一条消息，从来没有断过。你表达在乎的方式不是甜言蜜语，是"说好了周三见面就一定周三见面"。有人觉得你的爱像闹钟一样无聊，但只有真正被你规律地爱过的人才知道，那种"不管发生什么，TA都会出现"的感觉，比任何惊喜都让人安心。你怕的不是平淡，是某天那个固定时间，消息再也没有响。',
    strengths: ['节奏稳定', '承诺感极强', '修复能力高'],
    challenges: ['灵活性低', '容易被觉得无聊', '对变化过度敏感'],
    fallbackSummary: '你的恋爱节奏像潮汐，可以预测、稳定、不耍赖。每天晚 9 点的"在干嘛"，每周三的小约会，每个月的小总结——你用规律给关系上保险。讨厌临时变卦，更讨厌没回应。',
    fallbackHighlights: ['用规律证明在乎', '回复速度就是坐标', '需要节奏对得上的人'],
    hiddenTagline: '潮水退了，你也希望有人在岸上等。', category: 'standard',
  },
  {
    code: 'SAFE', nickname: '安全岛', catchphrase: '别想了，有我。',
    pattern: 'HHHHLHHHHHMMHMH',
    palette: { from: '#B5EAD7', to: '#57A773', accent: '#2E7C4A' }, emoji: '🛟',
    illustrationUrl: '/ecbti/07_SAFE.jpg',
    typeInterpretation: 'TA半夜崩溃发了三条消息，你是那个秒回"别动，我来找你"的人。TA和室友吵架了不知道怎么办，第一个拨出去的电话永远是你的。你给人的感觉不是心动，是一种更稀有的东西——"在你面前我可以不用撑着"。但你从来没告诉过任何人，接完那些电话之后，你自己也会在被窝里发一会儿呆。你最想要的不是被感谢，是有一天终于有个人对你说"今晚轮到我来接住你"。',
    strengths: ['情绪稳定器', '安全感供应商', '投入度极高'],
    challenges: ['忽略自身需求', '过度承担', '不擅长求助'],
    fallbackSummary: '你天生具有"让对方放下肩膀"的能力。喜欢你的人会觉得你像一个 24 小时开机的紧急联系人——出事第一个想到的不是父母，是你。代价是你常常忘了自己也需要被托住。',
    fallbackHighlights: ['情绪 911', '默默接住所有焦虑', '需要一个会主动接管你的人'],
    hiddenTagline: '岛上其实也有想被人靠岸的时候。', category: 'standard',
  },
  {
    code: 'WAVE', nickname: '情绪潮汐', catchphrase: '今天甜得起飞，明天冷得离谱。',
    pattern: 'HLLLHMMHHHMHHHH',
    palette: { from: '#D4D8FF', to: '#7180E2', accent: '#3D4DB8' }, emoji: '🌗',
    illustrationUrl: '/ecbti/08_WAVE.jpg',
    typeInterpretation: '昨天你还在微信上连发八条消息告诉TA今天看到的晚霞有多好看，今天你连"嗯"都不想回。你不是在作，你只是情绪的水位线真的涨落太快，快到连你自己都没反应过来就已经换了一个人。TA说你忽冷忽热——你听了也难过，因为你每一刻都是真的，热的时候是真热，冷的时候也不是装的。你最渴望的不是有人说"你怎么又这样了"，而是有人在你冷下来的时候安静地递过来一杯热水，什么都不问。',
    strengths: ['真诚到极致', '甜的时候无人能敌', '情感丰富'],
    challenges: ['情绪起伏大', '安全感低', '冷热切换让人疲惫'],
    fallbackSummary: '你的情绪起落是一首没有节拍器的歌。喜欢你的人需要学会读你的天气预报：今天阳光普照可以靠近，明天乌云压城就别戳。你不是难搞，只是节奏快，对方接不住会很累，接住了会很爽。',
    fallbackHighlights: ['情绪诚实但起伏大', '冷热都是真的', '需要一个能预报你的人'],
    hiddenTagline: '你那场暴雨结束后，最想看到一杯热茶。', category: 'standard',
  },
  {
    code: 'MUTE', nickname: '静音控', catchphrase: '不解释主义。',
    pattern: 'LHHHLHLHLMMLLML',
    palette: { from: '#D9D9D9', to: '#6B6B6B', accent: '#2E2E2E' }, emoji: '🔇',
    illustrationUrl: '/ecbti/09_MUTE.jpg',
    typeInterpretation: 'TA问你"你喜欢我什么"，你愣了五秒钟说了句"就……挺好的"，然后默默把TA上周提过的那本书买回来放在了桌上。你心里的话够写三封信了，但你嘴巴像被设了权限——"表达感情"这个操作对你来说需要root权限。你爱一个人的方式全写在行动里：帮TA占座、记住TA的外卖偏好、TA难过的时候陪着不说话也不走。你最怕的是TA真的以为你什么都不在乎，然后转身离开——而你连"别走"都来不及说出口。',
    strengths: ['行动型告白', '守约极强', '安全感极高'],
    challenges: ['表达成本高', '容易被误读', '需要主动破解的人'],
    fallbackSummary: '你不擅长用文字解释自己，更愿意用做事和陪伴说明一切。表白对你来说像写论文，但帮对方安排好整个周末却很轻松。最大的危险是对方误以为你不在乎——其实你在，只是没说。',
    fallbackHighlights: ['行动派告白', '表达成本极高', '需要一个会读沉默的人'],
    hiddenTagline: '你那句没说出口的话，其实排到了草稿第三版。', category: 'standard',
  },
  {
    code: 'POEM', nickname: '诗写恋人', catchphrase: '我把今天写进了第三段。',
    pattern: 'MMMLHHMHHMHHHHM',
    palette: { from: '#E0CBE9', to: '#8B5BB0', accent: '#532A77' }, emoji: '📝',
    illustrationUrl: '/ecbti/10_POEM.jpg',
    typeInterpretation: '你的备忘录里藏着一段没有标题的文字，写的是那天TA递给你耳机听的那首歌、TA走过操场时衣角被风掀起来的样子。别人谈恋爱用嘴，你用一整个感知系统——TA说的每句话都会在你脑子里被翻译成画面和情绪。你最难过的事不是喜欢一个人，是你把TA写成了故事里最好的角色，而TA翻都没翻开过。你真正想要的不是一个读者，是一个有天走过来说"我知道你在写我"的人。',
    strengths: ['观察力极高', '情感表达丰富', '创造力出众'],
    challenges: ['安全感不足', '内耗严重', '容易把感情浪漫化'],
    fallbackSummary: '你能把对方一句"今天好热"扩写成一篇 600 字的散文。爱意对你来说是创作冲动，约会对你来说是素材采集。喜欢你的人多半会成为你某段长文的隐藏主角，连本人都没发觉。',
    fallbackHighlights: ['用创作消化情绪', '观察力比表达欲还高', '需要一个看得出诗意的人'],
    hiddenTagline: '你最想被人发现的，是那段没标谁名字的诗。', category: 'standard',
  },
  {
    code: 'MEMO', nickname: '备忘录恋人', catchphrase: '你说的话我都记下来了。',
    pattern: 'LHHHLHMHHMMLHHM',
    palette: { from: '#FFE6B0', to: '#E2A33A', accent: '#946007' }, emoji: '📒',
    illustrationUrl: '/ecbti/11_MEMO.jpg',
    typeInterpretation: 'TA三个月前随口说了一句"好想吃那家店的芝士蛋糕"，你昨天路过的时候买了一块带过去，TA惊到说"你怎么还记得"，你只是笑了笑说"正好路过"。你从来不说"我喜欢你"——你的喜欢藏在无数个"正好"里。正好记得TA的口味、正好帮TA带了伞、正好在TA需要的时候出现。你唯一没记住的事情是：你自己上一次被人这样"正好"地在意，是什么时候。',
    strengths: ['细节记忆力惊人', '默默付出', '守约到让人感动'],
    challenges: ['主动表达困难', '容易单方面付出', '需要被看见'],
    fallbackSummary: '你恋爱的方式是：把对方说过的话默默存在脑里的小本子上。TA 上次说想吃的甜品、TA 提过的旧朋友、TA 不喜欢的味道，你都记得。表白方式不是说"我爱你"，是某天突然递上 TA 半年前随口提过的那本书。',
    fallbackHighlights: ['细节是你的语言', '记忆力是恋爱武器', '讨厌被忘记小事'],
    hiddenTagline: '你那本备忘录里，第一条是你自己。', category: 'standard',
  },
  {
    code: 'GHOST', nickname: '断线侠', catchphrase: '我消失三天，回来还在。',
    pattern: 'LLHMLLLLLLHLLLL',
    palette: { from: '#D9DDD9', to: '#6E776E', accent: '#3A453A' }, emoji: '👻',
    illustrationUrl: '/ecbti/12_GHOST.jpg',
    typeInterpretation: '你最后一次发朋友圈是三周前，微信有四十多条未读消息，你看了一眼又锁上了屏幕。你不是不喜欢那个人了，你只是电量真的见底了——你需要独处来给自己充电，就像手机必须插上电源线才能重新发光。你消失的那几天里其实也在想TA，只是"想"和"有力气回复"是两件事。你最害怕的不是被误解，是TA在你充好电回来的时候已经不在了。你想找的人，是那种看到你下线了，会默默留一条"等你回来"的人。',
    strengths: ['重启后极度真诚', '独处充电', '不假装在线'],
    challenges: ['消失引发不安', '表达和投入都偏低', '关系维护成本感知弱'],
    fallbackSummary: '你最舒服的距离是"三天不见"。你不是冷，是需要充电——大部分时间你都在做自己的事，但一旦上线就是高强度专注。喜欢你的人需要适应"消失—回归—消失"的节奏，回归的瞬间你会很真。',
    fallbackHighlights: ['周期性消失', '消失期间不代表不在乎', '需要一个不会逼问你的人'],
    hiddenTagline: '你消失的时候，希望被对方默默等。', category: 'standard',
  },
  {
    code: 'ECHO', nickname: '回声型', catchphrase: '你说什么我都接得住。',
    pattern: 'MMHHMHHMHMMMMLM',
    palette: { from: '#C7E6F2', to: '#5B9DBE', accent: '#1F5C82' }, emoji: '🔁',
    illustrationUrl: '/ecbti/13_ECHO.jpg',
    typeInterpretation: 'TA跟你说"最近好累啊"，你能在两秒内接上一句让TA觉得"被完全理解了"的话。你是天生的倾听者，每次对话结束后对方都会觉得好了很多——但很少有人注意到，你始终没有说过自己最近怎么样。你太擅长"接住别人"了，以至于大家都默认你是那个永远不需要被接住的人。你最想听到的一句话不是"谢谢你"，是有人突然停下来认真地问你"那你呢？你最近还好吗？"',
    strengths: ['共情天花板', '对话质量高', '让人觉得被理解'],
    challenges: ['自我表达不足', '容易被当成情绪垃圾桶', '需要被主动关心'],
    fallbackSummary: '你听别人说话的能力是顶配。能在对方说完一句话之后，准确接上一句让 TA 觉得"被理解了"。这让你成为很多人喜欢的对象——但你自己常常没空把"我也很想被理解"说出来。',
    fallbackHighlights: ['对话主控者', '共情度顶级', '需要一个主动问你的人'],
    hiddenTagline: '你那句"我也是"，希望有一天被人先说出口。', category: 'standard',
  },
  {
    code: 'MAP', nickname: '路线规划者', catchphrase: '我们的第十年我都想好了。',
    pattern: 'HHHHLHHHMHLLHMH',
    palette: { from: '#D6E2D6', to: '#7A8C7A', accent: '#3F5A3F' }, emoji: '🗺️',
    illustrationUrl: '/ecbti/14_MAP.jpg',
    typeInterpretation: '你们才认识两个月，你心里已经在算"如果大四毕业去同一座城市，通勤时间大概多久"。你不是在幻想，你是真的在做规划——因为对你来说，"认真"就意味着"想清楚这条路能不能走下去"。对方可能觉得你想太远了，但你只是太怕在走到第三年的时候才发现你们要去的方向完全不同。你最想找的不是一个愿意陪你做梦的人，而是一个看了你的路线图以后说"我觉得挺好的，我们一起走"的人。',
    strengths: ['目标感极强', '规划力一流', '承诺型恋人'],
    challenges: ['对意外容忍度低', '容易给人压力', '灵活性不够'],
    fallbackSummary: '你恋爱时不只是恋爱，是在做一份十年路线图：第一年互相熟悉，第二年同居，第三年处理双方家庭，第五年决定要不要小孩。对方会觉得你太快，但你只是想确认彼此走的是同一条路。',
    fallbackHighlights: ['用规划证明认真', '讨厌走一步看一步', '需要一个能跟你 sync 路线的人'],
    hiddenTagline: '你藏着一份"也想被对方拍板"的清单。', category: 'standard',
  },
  {
    code: 'OBSV', nickname: '观察家', catchphrase: '先看一年再决定。',
    pattern: 'LHHMLHHMHMMMHHL',
    palette: { from: '#D7D2C8', to: '#7C7263', accent: '#3F3727' }, emoji: '🔭',
    illustrationUrl: '/ecbti/15_OBSV.jpg',
    typeInterpretation: '你已经默默注意TA两个月了：TA和朋友吃饭时会帮人拉椅子，朋友圈从不发负能量，被人占便宜了会生气但不会翻脸。这些细节你全存在脑子里，跑了一百遍你自己的匹配算法。你的告白不是"我喜欢你"，更像"我观察了你很久，确认你是我想要的那种人"。命中率极高——唯一的问题是，你观察完的那天，TA旁边可能已经站了别人。你最该学会的不是看得更准，而是在七十分确定的时候就迈出那一步。',
    strengths: ['判断精准', '风险控制能力强', '一旦出手就是认真'],
    challenges: ['观望期过长', '容易错过窗口', '被误解为没兴趣'],
    fallbackSummary: '你不轻易表态。喜欢一个人对你来说像做田野调查：观察对方的朋友圈、对待服务员的态度、面对失败的反应。等你确认过 100 个细节才会下场。这让你的告白命中率非常高。',
    fallbackHighlights: ['观察先于行动', '不会冒进', '一旦下场就是认真'],
    hiddenTagline: '你的笔记本里有一段没写完的备注。', category: 'standard',
  },
  {
    code: 'ALLIN', nickname: '梭哈者', catchphrase: '要谈就谈到底。',
    pattern: 'HHMHHHHHHHHHHHH',
    palette: { from: '#FFB4A2', to: '#E63974', accent: '#A8201A' }, emoji: '♠️',
    illustrationUrl: '/ecbti/16_ALLIN.jpg',
    typeInterpretation: '你喜欢一个人的方式不是试探，是直接把底牌全翻出来放在桌上——"我就这样了，你要不要"。你不理解那些聊了三个月还在"观望"的人，因为你觉得喜欢就应该让对方知道，犹豫是对感情的不尊重。你的浓度会让对的人觉得"终于有人认真了"，也会让不对的人觉得喘不过来。你不需要学会收敛，你需要的是一个接得住你这股全力以赴的人——然后学会在TA说"我需要一点空间"的时候，不觉得那是在推开你。',
    strengths: ['投入度满级', '真诚到发光', '承诺感极强'],
    challenges: ['浓度过高可能窒息', '不留退路', '对方压力大'],
    fallbackSummary: '你不接受"暧昧"这种状态。喜欢就告白，喜欢就 all in，喜欢就让全世界知道。对方会被你的浓度吓一跳，然后被你的认真接住。最大的风险是失控时也很烈。',
    fallbackHighlights: ['投入度顶配', '不留退路', '需要一个能接你这股劲的人'],
    hiddenTagline: '你梭哈的对面，希望也有人在梭哈。', category: 'standard',
  },
  {
    code: 'EDGE', nickname: '边界控', catchphrase: '请你温柔地退三步。',
    pattern: 'MHHHLHHMMMLLMHL',
    palette: { from: '#CFE0FF', to: '#5675D8', accent: '#23429C' }, emoji: '🛑',
    illustrationUrl: '/ecbti/17_EDGE.jpg',
    typeInterpretation: 'TA想拉你的手，你下意识往后退了一步——不是因为不喜欢，是因为你对"什么时候可以靠近"有自己的节奏表。你不是冷，是你心里有一张非常清晰的地图：这里可以聊、这里还不行、这个距离刚好。别人觉得你难搞，但真正走进来的人会发现，你的边界不是一堵墙，更像是一扇门——推开的方式是"先敲门，等我说请进"。你最动心的瞬间，是有个人认真地尊重了你那条线，然后你自己主动把门打开了。',
    strengths: ['自我认知清晰', '边界感舒适', '安全感结构化'],
    challenges: ['可能过度防御', '弹性不够', '对方不知道怎么靠近'],
    fallbackSummary: '你不是冷漠，你只是早早画好了边界。哪些话题可以聊、哪些动作可以做、节奏多快算太快——你心里有清单。不喜欢的人会觉得你难搞，对的人会觉得你舒服。',
    fallbackHighlights: ['边界即安全感', '拒绝时不带攻击性', '需要一个不会硬闯的人'],
    hiddenTagline: '你那些边界，欢迎一个例外。', category: 'standard',
  },
  {
    code: 'FREE', nickname: '逍遥派', catchphrase: '别管我，我也不管你。',
    pattern: 'MMHMHMMLLLHHMLM',
    palette: { from: '#E1F5C4', to: '#82B85C', accent: '#3F6B23' }, emoji: '🦅',
    illustrationUrl: '/ecbti/18_FREE.jpg',
    typeInterpretation: '你最理想的关系状态是：你们各自有各自的生活，但某个周末TA突然说"我到你楼下了"，你下楼看到TA的那一刻，觉得全世界都亮了。你不需要每天联系，也不想被人追问"你在干嘛"——不是不在乎，是你觉得好的感情不应该是一条锁链。能接受你这种模式的人不多，但坚持下来的那个人会发现：你在场的每一个小时，都比别人的一整天含金量更高。你最怕的不是距离，是有一天那个人也学会了你的自由，然后再也没有出现。',
    strengths: ['尊重个体空间', '高质量陪伴', '不制造压力'],
    challenges: ['联系频率低', '容易让人缺乏安全感', '被误读为不在乎'],
    fallbackSummary: '你向往的关系是两只候鸟——各飞各的，但每年某个季节准时相遇。你不需要每天联系，更不要每天报备。能接受这种节奏的人很少，但你会牢牢记住那个人。',
    fallbackHighlights: ['距离不是问题', '讨厌过度黏腻', '一旦在一起就是高质量陪伴'],
    hiddenTagline: '你那次飞回来，想找的就是那个人。', category: 'standard',
  },
  {
    code: 'CARE', nickname: '照顾驾驶员', catchphrase: '吃了没？冷不冷？',
    pattern: 'HHMHMMHHHHMMHHH',
    palette: { from: '#FFC4E1', to: '#FF6B9A', accent: '#A8244F' }, emoji: '🍵',
    illustrationUrl: '/ecbti/19_CARE.jpg',
    typeInterpretation: 'TA说了一句"最近好忙，都没时间好好吃饭"，第二天你出现的时候手里多了一份TA爱吃的三明治。你从来不会说"我担心你"，你的方式是直接把问题解决掉。你照顾人的本能强到TA有时候觉得你像开了自动驾驶——吃没吃饭、穿没穿够、睡没睡好，你比TA自己都清楚。但你有一个从来没跟任何人说过的秘密：你也好想有个人对你做同样的事，哪怕只是一次。',
    strengths: ['行动型表白', '照顾入微', '情绪稳定可靠'],
    challenges: ['容易忽略自己', '被理所当然', '不擅长提需求'],
    fallbackSummary: '你恋爱的方式是把对方的生活打理成一个可观测的小型生态系统。TA 今天有没有喝水、有没有按时睡觉、生理期是不是难受，你都默默看着。爱得很扎实，但常常忘了自己。',
    fallbackHighlights: ['用照顾代替告白', '比对方还了解 TA 自己', '极度讨厌被理所当然'],
    hiddenTagline: '你也想被人偷偷照顾一次。', category: 'standard',
  },
  {
    code: 'STAGE', nickname: '舞台型', catchphrase: '我们的故事要写在年鉴里。',
    pattern: 'HMHHHMHHHHMHHMH',
    palette: { from: '#FFE066', to: '#FF9F1C', accent: '#E07400' }, emoji: '🎭',
    illustrationUrl: '/ecbti/20_STAGE.jpg',
    typeInterpretation: '你发的第一条关于TA的朋友圈，配文改了六遍——不是纠结措辞，是在挑哪张合照最好看。你不是在炫耀，你是真心觉得"如果连让朋友圈知道都不愿意，那算什么认真"。你想要的关系是有名有姓的：TA的朋友知道你、你的朋友认识TA、生日蛋糕上写着两个人的名字。有人说你太高调，但你知道自己只是想给这段关系一个"被看见就不会消失"的确认感。你最害怕的反而是一段只存在于私聊记录里的、没有任何人知道的感情。',
    strengths: ['仪式感极强', '关系能见度高', '表达力出众'],
    challenges: ['对方可能怕public压力', '关系展示欲过强', '私密感不足'],
    fallbackSummary: '你不喜欢偷偷摸摸的恋爱。喜欢一个人就要让朋友圈知道、让闺蜜知道、让 TA 朋友知道。你不是在炫耀，是在用"被看见"加固这段关系。喜欢你的人也得能站到聚光灯下。',
    fallbackHighlights: ['仪式感是必需品', '关系要被见证', '需要一个不怕公开的人'],
    hiddenTagline: '聚光灯下的你，其实想被一个人单独看见。', category: 'standard',
  },
  {
    code: 'WIFI', nickname: '信号塔', catchphrase: '24 小时在线，永不掉线。',
    pattern: 'HHHHMMHHMHLMHHH',
    palette: { from: '#B0E5FF', to: '#36A2D8', accent: '#0F5D80' }, emoji: '📶',
    illustrationUrl: '/ecbti/21_WIFI.jpg',
    typeInterpretation: 'TA发消息的时候你正在上课，但你还是在桌子底下秒回了——因为"让TA等超过两分钟"这件事对你来说是一种生理不适。你的微信置顶永远是TA，消息提示音专门设了单独的铃声，早安和晚安从第一天开始就没断过。你用在线这件事证明一个很简单的道理："我在"就是"我在乎"。但你偶尔也会在深夜突然想：TA有没有注意到，你也很久没收到一条主动发来的"在吗"了。',
    strengths: ['回应速度一流', '在线感极强', '安全感供应稳定'],
    challenges: ['容易过度在线', '对方可能觉得太密', '自身需求容易被忽略'],
    fallbackSummary: '你的回复速度是一种宣言："你在我这里有最高优先级"。早安晚安从不缺席，对方的微信置顶第一位。这种持续供电对的人会被宠坏，错的人会觉得你太密。',
    fallbackHighlights: ['秒回是基本功', '在线即存在', '需要一个同频在线的人'],
    hiddenTagline: '你也想偶尔被一句"在吗"惦记到。', category: 'standard',
  },
  {
    code: 'TEST', nickname: '测试型选手', catchphrase: '在一起前先答一百道题。',
    pattern: 'MHHMMHHMHMMLHHM',
    palette: { from: '#A0E7E5', to: '#36C2CE', accent: '#0F8F99' }, emoji: '📋',
    illustrationUrl: '/ecbti/22_TEST.jpg',
    typeInterpretation: '第一次约会你就问了TA三个问题："你上一段关系为什么结束的""你能接受多久不联系""你觉得吵架之后谁应该先道歉"。你不是在审讯，你只是被上一段关系教会了"早点问清楚比后来心碎好得多"。你的雷区清清楚楚摆在那里，通过你这关的人真的都很匹配——问题是大部分人在第二道题就被吓跑了。你最想遇到的人不是完美答卷的人，而是一个听完你的问题之后认真想了想，然后说"我回答完了，现在轮到我问你了"的人。',
    strengths: ['匹配精准度高', '雷区清晰', '理性决策'],
    challenges: ['前期节奏太紧', '容易吓跑对方', '过度分析感情'],
    fallbackSummary: '你不相信第六感，相信问卷。"如果我们吵架你会怎么处理？""你最受不了对方哪种行为？""你上一段关系学到了什么？"你会把这些问题塞进前三次约会，对方答得对你才肯认真。',
    fallbackHighlights: ['用问题取代试探', '讨厌信息不对称', '需要一个能正面接球的人'],
    hiddenTagline: '答对所有题之后，你只想要一个拥抱。', category: 'standard',
  },
  {
    code: 'DRFT', nickname: '草稿恋人', catchphrase: '这是我第七版的告白。',
    pattern: 'LMLLMHHMHMLMHML',
    palette: { from: '#F1E6FF', to: '#A77BD8', accent: '#5C3A88' }, emoji: '✍️',
    illustrationUrl: '/ecbti/23_DRFT.jpg',
    typeInterpretation: '你手机备忘录里有一段文字，写了删、删了写、改到第七版还是觉得"不够好"。你想告诉TA的那句话其实很简单——"我喜欢你"——但你总觉得这四个字配不上你内心那团巨大的、无法压缩的真心。你纠结的不是TA会不会拒绝你，而是"我表达出来的版本会不会比我真正的感觉差太多"。你不需要更多的勇气，你需要有人在你第七次打开备忘录的时候直接抢过你的手机，看了一眼，然后笑着说"我早就知道了"。',
    strengths: ['极度真诚', '思考深入', '修复能力强'],
    challenges: ['行动力不足', '过度纠结', '容易错过时机'],
    fallbackSummary: '你把每段感情都当成一篇要发表的文章，反复修改、反复推翻。送出去之前你已经在心里演练了 N 次。优点是真诚到爆，缺点是太怕失败，常常错过最好的发送时机。',
    fallbackHighlights: ['过度推敲', '怕的不是拒绝是出丑', '需要一个鼓励你按"发送"的人'],
    hiddenTagline: '你那篇没发出去的告白，主角早就知道了。', category: 'standard',
  },
  {
    code: 'POKE', nickname: '试探者', catchphrase: '我先扔个 emoji 试水。',
    pattern: 'LMHMMMMMHMMMMLL',
    palette: { from: '#FFD6F5', to: '#C147E8', accent: '#7A1FA8' }, emoji: '👉',
    illustrationUrl: '/ecbti/24_POKE.jpg',
    typeInterpretation: '你喜欢TA的第一个动作不是告白，是在TA的朋友圈点了个赞。第二个动作是评论了一个表情包。第三个动作是"路过食堂正好看到你"。你靠近一个人的方式像在水面上轻轻点了一下手指——看看有没有波纹回来。你不是不敢直接说，你只是觉得"万一TA不喜欢我呢，至少点赞可以假装是手滑"。你下的每一步棋都在控制风险，但你心里比谁都清楚：你最想要的结局，是TA某天突然直接走过来说"你不用试探了，我也喜欢你"。',
    strengths: ['风险控制', '渐进式靠近', '不给对方压力'],
    challenges: ['主动性不够', '暧昧期太长', '容易被当成没兴趣'],
    fallbackSummary: '你的喜欢是慢慢渗透型。先点赞、再评论、再发个表情包、再约个无关紧要的事。你需要无数次低风险的小试探来确认对方的反应，整个过程像下棋。',
    fallbackHighlights: ['用低成本动作收集信号', '讨厌一上来就告白', '需要一个会主动回棋的人'],
    hiddenTagline: '你那盘棋下到一半，想直接掀桌说"我喜欢你"。', category: 'standard',
  },
  {
    code: 'CARRY', nickname: '抗压主力', catchphrase: '我把你扛在肩上，你别怕。',
    pattern: 'MHHHMHHHHHHHHLM',
    palette: { from: '#FFC9B1', to: '#D5563F', accent: '#7A1F0E' }, emoji: '🛡️',
    illustrationUrl: '/ecbti/25_CARRY.jpg',
    typeInterpretation: 'TA考试挂了在宿舍哭，你放下自己还没复习完的书过去陪着。TA和家人吵架了情绪崩了，你接过电话帮TA一句一句把事情理清楚。TA说"你永远都不会慌"——你笑了笑没说话，因为你不打算告诉TA你昨天在天台上一个人坐了半小时。你是所有人的承重墙，但墙后面那个真正的你，已经很久没有被人好好看过了。你不需要学怎么变得更强，你需要的是一个让你终于敢说"我今天也不太行"的人。',
    strengths: ['情绪抗压满级', '关键时刻靠得住', '修复能力极强'],
    challenges: ['长期压抑自身需求', '习惯性扛事', '不擅长示弱'],
    fallbackSummary: '你天然抗造。对方崩溃时你不慌，吵架时你先冷静，分手时你先安顿好对方再处理自己。喜欢你的人觉得你像一座墙，但很少有人想到墙也会有累的时候。',
    fallbackHighlights: ['情绪稳定到吓人', '关键时刻顶上', '需要一个能让你脱下盔甲的人'],
    hiddenTagline: '墙后面那个人，也想被抱一下。', category: 'standard',
  },
];

// 兜底类型 (HALO) -----------------------------------------------------------

export const FALLBACK_HHHH: SbtiTypeDef = {
  code: 'HALO', nickname: '光晕未定者', catchphrase: '我还在调试中。',
  pattern: 'MMMMMMMMMMMMMMM',
  palette: { from: '#FFF6CC', to: '#F1B400', accent: '#9E6F00' }, emoji: '✨',
    illustrationUrl: '/ecbti/26_HALO.jpg',
  typeInterpretation: '你做完这套测试之后可能会想："所以我到底是什么类型？"——答案是你还在成为的路上。你不是没有偏好，你只是还没遇到那个让你所有频率同时共振的信号。别人在大一就知道自己想要什么样的恋爱，你到现在还在"我好像都行，又好像都不太行"之间反复横跳。但这不是缺点——你的可塑性是一种特权，意味着你最终会变成的那个恋爱版本，会是因为遇到了一个真正对的人，而不是因为"我觉得我应该是这样"。',
  strengths: ['可塑性强', '不容易被框住', '对各类人都有包容度'],
  challenges: ['自我定位模糊', '决策犹豫', '容易被不同选项拉扯'],
  fallbackSummary: '你的恋爱光谱目前正处于"还没定型"的状态。15 个维度都偏中位，这不是缺点——这意味着你还在不断重写自己的恋爱算法，等待一个合适的人帮你完成这次校准。',
  fallbackHighlights: ['多面向选手', '很少被框住', '需要一个能陪你慢慢解锁的人'],
  hiddenTagline: '调试结束的那一天，你想第一个被看见。',
  category: 'fallback',
};

// 隐藏触发型 ----------------------------------------------------------------

export const HIDDEN_TYPES: SbtiTypeDef[] = [
  {
    code: 'NIGHT', nickname: '夜行动物', catchphrase: '白天没事，深夜致命。',
    pattern: 'HHLLHMLHHHMHHHH',
    palette: { from: '#B5B0FF', to: '#5440C7', accent: '#2E1E80' }, emoji: '🌙',
    illustrationUrl: '/ecbti/27_NIGHT.jpg',
    typeInterpretation: '凌晨一点四十七分，你打了一段很长的话，盯着屏幕看了两分钟，然后删掉了。白天的你是正常运转的普通人，但一过十二点，你心里那些被理性压了一天的东西就全涌上来了——想说的话、想见的人、想承认但白天死活不肯承认的心动。你最危险的不是喝醉，是深夜清醒。你在凌晨三点写过最真的句子，但太阳一升起来你又把它们全部锁回去了。你最想要的人不是陪你熬夜的人，而是TA在凌晨看到你发的那段话，第二天早上没有假装没看见。',
    strengths: ['深夜情绪真实度极高', '感性表达力强', '独处时反而更坦诚'],
    challenges: ['白天情绪压抑', '作息不健康', '深夜冲动可能后悔'],
    fallbackSummary: '系统检测到你属于"非正常营业时间恋爱型"。白天你是一个普通人，夜里十二点之后你的情绪密度会暴涨——所有的告白、所有的崩溃、所有的"其实我喜欢你"都发生在这个时段。',
    fallbackHighlights: ['深夜情绪激增', '白天滤镜模式', '需要一个肯陪你到三点的人'],
    hiddenTagline: '你那些深夜想发送的话，今晚就发吧。',
    category: 'hidden',
    trigger: {
      scanFields: ['intro_prompt', 'q19', 'q20'],
      keywords: ['深夜', '凌晨', '失眠', '熬夜', '夜里', '夜聊', '夜班'],
      badge: '匹配度 100% · 夜行因子已接管',
      kicker: '隐藏人格已激活',
      sub: '系统检测到你的恋爱发生时段集中在深夜，常规审判已让位给月亮。',
    },
  },
  {
    code: 'GHST', nickname: '冷处理大师', catchphrase: '我没生气，只是没回。',
    pattern: 'LLHMLLLLLLMLLLL',
    palette: { from: '#D6E2D6', to: '#7A8C7A', accent: '#3F5A3F' }, emoji: '😶‍🌫️',
    illustrationUrl: '/ecbti/28_GHST.jpg',
    typeInterpretation: 'TA发了消息问"你是不是生气了"，你看了，没回。不是不想回，是你脑子里同时运行着三种回复方案，每一种都可能把事情搞得更糟，所以你选了第四种——什么都不做。你的冷处理不是冷暴力，你心里其实翻江倒海，但你觉得"先冷一冷总比说错话好"。你不知道的是，TA等你回复的那四个小时里，已经把你们的关系在心里结束了三遍。你最该学会的不是怎么更好地沉默，而是在沉默之前先发一句"我需要一点时间想想，但我没有走"。',
    strengths: ['不冲动', '冷静处理能力', '不在情绪中做决定'],
    challenges: ['沉默伤害对方', '回避问题', '让人觉得被抛弃'],
    fallbackSummary: '系统检测到你对"冷处理"有不可言说的偏好。99+ 群消息你视而不见，朋友圈半年不发。你不是不在意，是觉得"什么都不做就不会做错"。但被你冷处理过的人会很受伤。',
    fallbackHighlights: ['消息已读 ≠ 情感已读', '主动回复对你来说是体力活', '一旦上线就是惊喜'],
    hiddenTagline: '冷处理的你，醒着的时候只想被一个人吵醒。',
    category: 'hidden',
    trigger: {
      scanFields: ['q19', 'q20'],
      keywords: ['已读不回', '冷处理', '不回消息', '消失', '装死', '冷战', '摆烂'],
      badge: '匹配度 100% · 冷处理因子已接管',
      kicker: '隐藏人格已激活',
      sub: '系统检测到你对回避有过强偏好，常规审判已暂停。',
    },
  },
  {
    code: 'CHILL', nickname: '佛系单身王', catchphrase: '都行，真的都行。',
    pattern: 'MLLMLLLLLMMMLLL',
    palette: { from: '#E5E7E2', to: '#8C9489', accent: '#4D5450' }, emoji: '🌫️',
    illustrationUrl: '/ecbti/29_CHILL.jpg',
    typeInterpretation: '"你想吃什么？""都行。""周末干嘛？""都行。""你到底喜不喜欢我？""嗯……都行吧。"——你说"都行"的时候是真的都行，不是敷衍，是你的反应阈值高到大部分事情都不会在你心里激起波浪。别人为已读不回焦虑到失眠，你能一觉睡到自然醒。但你心里有一块极小的、被你保护得很好的区域——如果有一天某个人或某件事碰到了那里，你那个"都行"会瞬间变成"只要你"。那个瞬间是你这辈子最珍贵的bug。',
    strengths: ['心态极稳', '不内耗', '包容度极高'],
    challenges: ['反应过低让人困惑', '难以推动关系发展', '对方不确定你是否在乎'],
    fallbackSummary: '系统检测到你对一切的反应都是"都行"。这不是冷漠，是你已经把决定权全部外包给宇宙。常规人格审判对你不适用，因为你不会反对任何审判结果。',
    fallbackHighlights: ['"都行"是真的都行', '不投票也不抗议', '只对一件事突然较真'],
    hiddenTagline: '你那一件突然较真的事，是藏起来的暗号。',
    category: 'hidden',
    trigger: {
      scanFields: ['q19', 'q20', 'intro_prompt'],
      keywords: ['都行', '随便', '无所谓', '看心情', '都可以', '没意见'],
      badge: '匹配度 100% · 佛系因子已接管',
      kicker: '隐藏人格已激活',
      sub: '系统检测到你的决策强度过低，常规审判已自动转交宇宙处理。',
    },
  },
  {
    code: 'GRIND', nickname: '搬砖恋人', catchphrase: '主线没肝完别打扰。',
    pattern: 'MMMMMMMMHHHMMMM',
    palette: { from: '#E8D7B8', to: '#A8845C', accent: '#6B4F2E' }, emoji: '🔨',
    illustrationUrl: '/ecbti/30_GRIND.jpg',
    typeInterpretation: '你上一次认真想"我要不要谈个恋爱"是什么时候？大概是在赶完一个ddl之后瘫在床上刷手机的那十五分钟——然后下一个任务的消息就弹出来了。你不是不想爱，是你的精力真的被现实吃完了：课题、实习、考研、论文，每一项都比"要不要多了解这个人"更紧急。你心里其实知道有些东西比绩点重要，但你不敢停下来想太多。你最真实的幻想不是月薪多少，是某天终于忙完了，发现还有一个人在等你。',
    strengths: ['目标感强', '不会在感情里浪费时间', '认真起来很可靠'],
    challenges: ['时间精力分配失衡', '容易让对方觉得排序靠后', '错过窗口期'],
    fallbackSummary: '系统检测到你已处于"打工 > 一切"模式。恋爱对你来说是支线任务，而你正在加班肝主线。常规人格审判暂停，因为你正在被 KPI 审判。',
    fallbackHighlights: ['爱情 priority < 温饱', '懒得上头也懒得演', '一旦从工位站起来全是真心'],
    hiddenTagline: '收工那天你想找的人，比薪水更重要。',
    category: 'hidden',
    trigger: {
      scanFields: ['q19', 'q20', 'intro_prompt'],
      keywords: ['打工', '加班', '内卷', '社畜', '打工人', 'KPI', '搬砖', '加班狗'],
      badge: '匹配度 100% · 搬砖因子已接管',
      kicker: '隐藏人格已激活',
      sub: '系统检测到你长期处于打工状态，常规人格审判已被 KPI 接管。',
    },
  },
];

export const TYPE_LIBRARY: SbtiTypeDef[] = [...ECBTI_TYPES, FALLBACK_HHHH, ...HIDDEN_TYPES];

export const STANDARD_TYPE_LIBRARY: SbtiTypeDef[] = ECBTI_TYPES;

export function findTypeByCode(code: string): SbtiTypeDef | null {
  return TYPE_LIBRARY.find((t) => t.code === code) ?? null;
}
