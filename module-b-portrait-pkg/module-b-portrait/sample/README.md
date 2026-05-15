# 模块 B · 参考实现

> 这只是一条可行路径，不代表唯一答案。建议你自己把 Spec、Plan、Implement、Test、Review 完整走一遍，跟 AI 协作的过程比最终代码更值得记录。

## 1. 范围

| 任务 | 状态 | 文件 |
|---|---|---|
| 必做 B1 跑通脚手架 | ✅ | `npm run dev`，5173 与 3010 同时起 |
| 必做 B2 读懂 personaCard.ts | ✅ | 实现细节见本 README §5 |
| 必做 B3 MBTI 雷达 | ✅ | 沿用 baseline，没动 |
| 必做 B4 端到端、consolidatedScores | ✅ | `server/index.ts` 提供 build-card |
| **进阶 A1（自定义）：依恋子量表** | ✅ | `src/portrait-extension/attachment-style.ts` 配 `components/AttachmentBars.tsx` |
| **进阶 A2：兴趣词云产品级打磨** | ✅ | `components/InterestCloud.tsx` 改用 echarts-wordcloud，加了分类筛选 |
| **进阶 A3：LLM 集成（原创）** | ✅ | `src/scoring/llm-narrative.ts`、`POST /api/portrait/narrative`，以及卡片 tab 上的按钮 |

## 2. 方法论

### 2.1 依恋子量表（4 题，三轴四类）

baseline 里 ECBTI 的 `SECURITY` 维度是 `(8-q04) + (8-q08)` 的平均，等于把焦虑面与回避面坍缩到同一档 L、M、H 上。问题就在这里：

| 例 | q04（回复迟疑会胡思乱想） | q08（反复确认） | q01（主动表达情绪） | q12（冲突主动修复） | 现有 SECURITY |
|---|---|---|---|---|---|
| 焦虑型 A | 7 高 | 7 高 | 6 高 | 6 高 | L 不安全 |
| 回避型 B | 2 低 | 2 低 | 2 低 | 2 低 | H 安全（误判） |
| 矛盾型 C | 7 高 | 7 高 | 2 低 | 2 低 | M（被平均掉了） |

设计的思路是**沿用现有的 q01、q04、q08、q12 四题**，分两轴打分，这样就不破坏 24-key 问卷契约。

| 题号 | 轴 | 反向？ |
|---|---|---|
| q04 | 焦虑 | 否（q04 高即焦虑高） |
| q08 | 焦虑 | 否 |
| q01 | 回避 | 是（q01 低即回避高） |
| q12 | 回避 | 是 |

分类用四象限 50/50 切，按中位数划线，沿用的是 Bartholomew 1991 与 Mickelson 1997 的常见做法。理论这条线大致是 Bowlby 1969、Bartholomew & Horowitz 1991，再到 ECR-S (Wei 2007)，详见 §6 引用。

整个子量表是作为 portrait extension 外挂的，不进 15 维 vector，也就不会影响 L1 距离匹配，条形图单独呈现。

### 2.2 LLM 人格故事

用 `claude -p --model haiku` 起子进程，外面包一层 JSON 解析，再叠三层兜底：

1. `spawn()` 抛异常（比如 claude 不在 PATH）：返回 `{source: 'fallback', reason: 'spawn failed'}`
2. 子进程非零退出、stderr 有内容：返回 `{source: 'fallback', reason: 'exit N: ...'}`
3. stdout 解析不出来（JSON parse 失败、缺 narrative 字段、长度 < 30 字）：返回 `{source: 'fallback', reason: 'unparseable'}`

任何错误最终都会落到一条 rule-based 的兜底文案，**API 永远不会抛出去**。

### 2.3 词云升级

baseline 的 `InterestCloud.tsx` 是拿 ECharts `series.type='graph'` 配 `layout='force'` 模拟词云的，几个问题都比较明显：tag 之间会互相穿插，字号最低能掉到 7 px，layout 收敛慢，鼠标一悬停就开始抽搐。

换成 `echarts-wordcloud`（~24 KB）以后：

- `sizeRange: [12, 42]`：字号底线提到 12 px，能看清
- `shape: 'circle'`、`gridSize: 6`、`drawOutOfBound: false`：不再溢出容器
- `rotationRange: [0, 0]`：中文不转 90 度
- 6 个分类 chip（lifestyle、art、media、entertainment、tech、social），点一下只看一类
- hover tooltip 显示权重、提及次数、分类标签

## 3. 关键数字

### 3.1 依恋子量表（n=500 fixtures）

| 类型 | 计数 | 比例 | 文献参考（Mickelson 1997, US n=8098） |
|---|---:|---:|---:|
| secure 安全型 | 71 | 14.2% | 59% |
| anxious-preoccupied 焦虑型 | 259 | 51.8% | 11% |
| dismissive-avoidant 回避型 | 35 | 7.0% | 25% |
| fearful-avoidant 矛盾型 | 135 | 27.0% | 5% |

三轴统计：

| 轴 | mean | median | p25 | p75 | std |
|---|---:|---:|---:|---:|---:|
| anxious | 60.4 | 58 | 50 | 75 | 17.04 |
| avoidant | 39.5 | 42 | 25 | 50 | 17.50 |
| secure | 37.0 | 42 | 25 | 50 | 15.51 |

合成 fixture 在 q04、q08 上有明显的焦虑偏置（mean=60.4，期望大约 50），这是合成生成器本身带的，并不是子量表的问题。

**与 ECBTI SECURITY 维度的交叉表**（同 500 用户）：

| | secure | anxious | dismissive | fearful |
|---|---:|---:|---:|---:|
| SECURITY=L | 0 | 144 | 0 | 79 |
| SECURITY=M | 38 | 115 | 24 | 56 |
| SECURITY=H | **33** | 0 | **11** | 0 |

SECURITY=H 共 44 人，其中 11 人在依恋子量表里被判成了 dismissive-avoidant，占 25%。原因不复杂：q04、q08 答得低（不焦虑），ECBTI 判"安全"；可这些人 q01、q12 也答得低（不主动表达、不主动修复），实际上是回避型不安全。

### 3.2 LLM 人格叙事（5 用户抽样）

| 指标 | 数值 |
|---|---|
| 命中率（LLM 路径成功） | 5/5，100% |
| 平均延迟 | 34.8 s |
| 中位延迟 | 38.1 s |
| 最快、最慢 | 21.0 s、49.4 s |
| 模型 | `claude -p --model haiku` |
| 平均输出长度 | 约 100 汉字 |

5 条样本，横跨 4 个 MBTI 与 3 种依恋类型：

| # | 用户 | MBTI | 依恋 | 输出（首尾摘） | 长度 | 延迟 |
|---|---|---|---|---|---:|---:|
| 1 | 素年 | ENTJ | 焦虑 | 「在镜头和食谱里追求完美的人...既想靠近彼此，又容易过度诠释那些模糊信号。」 | 102 字 | 22.5 s |
| 2 | 青禾 | INTP | 矛盾 | 「在故事和逻辑中闪闪发光的人...用谨慎守护了心中的渴望。」 | 99 字 | 49.4 s |
| 3 | 阿叶939 | ENFP | 焦虑 | 「总能从故事中看见可能性...反复确认他是否真的在意。」 | 110 字 | 43.0 s |
| 4 | 羽川 | INTJ | 矛盾 | 「在代码中构造精密的逻辑世界，却在照顾宠物时展露温柔。」 | 99 字 | 38.1 s |
| 5 | cici | ENFJ | 焦虑 | 「进房间就能点亮气氛的人...反复咀嚼那些可能只是随口一说的话。」 | 102 字 | 21.0 s |

对比起来，preset 的兜底文案是 27–53 字的模板拼接，LLM 这边能稳定写到 100 字左右，并且把 MBTI、兴趣、依恋三个信号都揉了进去。

Fallback 路径也验证过：把 `LLM_NARRATIVE_TIMEOUT_MS` 设成 1，5 条样本全部走兜底，每条都在 50 ms 以内返回。

### 3.3 契约测试

```
✓ contracts/persona-card.contract.test.ts (5 tests)
✓ contracts/questionnaire.contract.test.ts (4 tests)
Test Files  2 passed (2)
     Tests  9 passed (9)
```

每改一次都跑了一遍，全程 9/9。

## 4. 怎么跑

```bash
npm install
npm run fixtures:gen          # 一次性，生成 500 用户合成数据
npm run dev                   # 同时起 vite (5173) 与 express (3010)
```

打开 <http://localhost:5173>，三个 tab 分别是：

1. **画像可视化**：MBTI 雷达、11 维雷达、**新加的依恋三轴条形图**、升级后的兴趣词云（带分类筛选）
2. **问卷流程**：24 题完整问卷，提交以后顺手帮你算出依恋类型，再出一张条形图
3. **人格卡片**：调 `buildUserVector` 渲染 ECBTI 卡，下方有一个「用 LLM 写一段人格故事」的按钮，背后走 claude haiku 生成 70-90 字的中文叙事

其它命令：

```bash
npm run typecheck             # tsc --noEmit
npm run test:contract         # 9 个契约测试，必须全绿
npm run experiment:attachment # 在 500 fixture 用户上跑依恋分布
npm run experiment:narrative  # 在 5 个用户上跑 LLM narrative，记下延迟与样本
npm run build                 # 类型检查与 Vite 产物
```

## 5. baseline 15 维拆解

`src/personaCard.ts:420 buildUserVector`：

| 维度 | 来源 |
|---|---|
| SELF_EXPR | avg(q01, q09) |
| STRUCTURE | avg(q03, q15) |
| EMO_STAB | avg(q05, 8-q13) |
| SECURITY | avg(8-q04, 8-q08) |
| EXPLORE | q06 |
| VALUES | avg(q10, q11, q18) |
| REPAIR | avg(q12, q14) |
| COMMIT | avg(q16, q17) |
| EMPATHY | avg(q02, q04) |
| PACE | profile.relationship_goal → LMH |
| DISTANCE | profile.long_distance_preference → LMH |
| VICE | profile.smoking_preference → LMH |
| INTRO_DENSITY | textDensityToLmh(profile.intro_prompt) |
| REDLINE | textDensityToLmh(answers.q19, 8 个 high keywords) |
| ICEBREAK | textDensityToLmh(answers.q20, 7 个 high keywords) |

LMH 量化的规则是：avg ∈ [1, 7]，分成 L (≤2.5)、M (≤4.5)、H 三档。

读下来，这套打法有几个值得记一笔的问题：

1. q04 同时出现在 SECURITY 与 EMPATHY 两个维度里，在 15 维向量上等于贡献了双倍权重
2. SECURITY 用的 q04、q08 都是焦虑面，回避面（q01、q12）没参与进来，回避型不安全的人会被漏掉
3. `textDensityToLmh` 那张 highKeyword 列表，没有公开数据集做过校准

## 6. 公开数据集引用

### IPIP-NEO (Goldberg 1999)

International Personality Item Pool，由 Oregon Research Institute 维护，公有领域，官网 <https://ipip.ori.org/>。提供 50、120、300 题三种长度的 Big Five 量表，Cronbach α 在 5 个维度上分别是 0.86、0.78、0.81、0.85、0.81（Johnson 2014）。Johnson 2014 *J. Res. Pers.* 还公开了一个 30 万人的 IPIP-NEO 数据集（<https://osf.io/tbmh5/>）。

### ECR、ECR-S（Brennan 1998、Wei 2007）

ECR（36 项）是英语世界使用最广的成人依恋自评工具，被引超过 8000 次。ECR-S（12 项）在 4 个独立样本（n=388、232、154、416）上做过验证，每轴 6 题，焦虑 α=0.78，回避 α=0.84。中文翻译版（李同归 与 加藤和生 2006）在大学生样本上验证过。本实现是 ECR-S 的紧缩近似——每轴只用 2 题，焦虑 α 预计在 0.55-0.6 之间，回避 α 预计在 0.6-0.65 之间。

### Mickelson 1997 依恋国家样本

Mickelson, K. D., Kessler, R. C., & Shaver, P. R. (1997). *Adult attachment in a nationally representative sample.*
*J. Pers. Soc. Psychol.* 73(5), 1092–1106。n=8098，美国国家代表性样本（NCS，National Comorbidity Survey），被引超过 1400 次。§3.1 那张表的对照分布就是出自这里。

### BibTeX

```
@incollection{goldberg1999ipip,
  title={A broad-bandwidth, public domain, personality inventory measuring the lower-level facets of several five-factor models},
  author={Goldberg, Lewis R.},
  booktitle={Personality Psychology in Europe},
  volume={7}, pages={7--28}, year={1999},
  publisher={Tilburg University Press}
}
@incollection{brennan1998ecr,
  title={Self-report measurement of adult romantic attachment: An integrative overview},
  author={Brennan, Kelly A. and Clark, Catherine L. and Shaver, Phillip R.},
  booktitle={Attachment Theory and Close Relationships},
  pages={46--76}, year={1998}, publisher={Guilford Press}
}
@article{wei2007ecrs,
  title={The Experiences in Close Relationship Scale (ECR)-Short Form: Reliability, validity, and factor structure},
  author={Wei, Meifen and Russell, Daniel W. and Mallinckrodt, Brent and Vogel, David L.},
  journal={Journal of Personality Assessment},
  volume={88}, number={2}, pages={187--204}, year={2007},
  doi={10.1080/00223890701268041}
}
@article{mickelson1997adult,
  title={Adult attachment in a nationally representative sample},
  author={Mickelson, Kristin D. and Kessler, Ronald C. and Shaver, Phillip R.},
  journal={Journal of Personality and Social Psychology},
  volume={73}, number={5}, pages={1092--1106}, year={1997},
  doi={10.1037/0022-3514.73.5.1092}
}
```

## 7. 代码地图

```
sample/
├── README.md                         本文件
├── ai-conversations/                 跟 AI 助手讨论的过程，4 段按主题分
│   ├── 01-week1-read-baseline.md
│   ├── 02-week2-attachment-design.md
│   ├── 03-week3-wordcloud-polish.md
│   └── 04-week4-llm-integration.md
├── src/
│   ├── personaCard.ts                vendored，未改
│   ├── personaCardTypes.ts           vendored，未改
│   ├── portrait-extension/
│   │   └── attachment-style.ts       依恋子量表，A1 新增
│   ├── scoring/
│   │   └── llm-narrative.ts          LLM 人格叙事，A3 新增
│   ├── components/
│   │   ├── AttachmentBars.tsx        依恋三轴条形图，A1 新增
│   │   ├── InterestCloud.tsx         升级版词云，A2 改写
│   │   ├── MbtiRadar.tsx             baseline，未改
│   │   ├── TraitsRadar.tsx           baseline，未改
│   │   ├── PersonaCardView.tsx       vendored，未改
│   │   └── QuestionnaireFlow.tsx     baseline，未改
│   ├── server/index.ts               Express 跑在 3010，新增 /api/portrait/narrative
│   ├── App.tsx                       UI 外壳，三个 tab，加了 LLM 按钮
│   └── ...
├── scripts/
│   ├── experiment-attachment.ts      500 用户依恋分布
│   └── experiment-narrative.ts       LLM 延迟与样本输出
├── public-benchmarks/
│   ├── attachment-distribution.json  experiment-attachment.ts 的输出
│   └── narrative-samples.json        experiment-narrative.ts 的输出
└── contracts/                        契约测试，不动
```

几个关键文件：

1. `src/portrait-extension/attachment-style.ts`：4 题依恋子量表，复用 q01、q04、q08、q12。
2. `src/scoring/llm-narrative.ts`：`claude -p` 子进程封装，外面包一层 JSON 解析与三层兜底，API 不抛异常。
3. `src/components/InterestCloud.tsx`：echarts-wordcloud 布局，配分类筛选与 hover tooltip。

## 8. AI 讨论记录

- `ai-conversations/01-week1-read-baseline.md`
- `ai-conversations/02-week2-attachment-design.md`
- `ai-conversations/03-week3-wordcloud-polish.md`
- `ai-conversations/04-week4-llm-integration.md`
