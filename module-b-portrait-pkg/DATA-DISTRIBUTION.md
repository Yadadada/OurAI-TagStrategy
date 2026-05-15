# 合成数据分布

`shared-fixtures` 采用的目标分布。**不映射任何真实用户。**

`shared-fixtures/src/distributions.ts` 把所有比例固化为常量。改了之后跑 `npm run generate` 重新生成。

## 院系分布

| 学院 | 权重 |
|---|---:|
| 软件工程学院 | 16 |
| 心理与认知科学学院 | 12 |
| 统计学院 | 9 |
| 数学科学学院 | 9 |
| 历史学系 | 6 |
| 地球科学学部 | 6 |
| 经济与管理学部 | 6 |
| 中国语言文学系 | 6 |
| 计算机科学与技术学院 | 4 |
| 信息学部 | 4 |
| 数据科学与工程学院 | 3 |
| 生命科学学院 | 3 |
| 马克思主义学院 | 3 |
| 地理科学学院 | 3 |
| 物理学院 | 2 |
| 法学院 | 2 |
| 音乐学院 | 2 |
| 网络空间安全学院 | 2 |
| 国际汉语文化学院 | 2 |

## 校区

| 值 | 权重 |
|---|---:|
| putuo | 44 |
| minhang | 34 |
| both | 12 |
| lingang | 4 |
| (空) | 6 |

## 性别

| 值 | 权重 |
|---|---:|
| female | 69 |
| male | 25 |
| non_binary | 1 |
| (空) | 5 |

## 年级

| 值 | 权重 |
|---|---:|
| master | 28 |
| undergrad_3 | 28 |
| undergrad_1 | 22 |
| undergrad_4 | 9 |
| undergrad_2 | 4 |
| doctor | 3 |
| (空) | 6 |

## 偏好

- **smoking_preference**: reject 66、prefer_no 28、accept 1、空 5
- **long_distance_preference**: depends 50、accept 28、reject 16、空 6
- **desired_genders**: 异性恋单选权重 ~80%，双性恋多选 ~13%，同性向 ~5%，空 ~2%

## hobbies 枚举（21 个）

`sports, music, movies, reading, gaming, travel, cooking, photography, art, outdoor, pets, dance, board_games, volunteering, coding, science, digital, anime, fashion, writing, other`

合成时每用户选 3-6 个，并按所属学院做兴趣偏置（软工生更易选 coding/gaming，心理学院更易选 reading/writing 等，详见 `distributions.ts` 中 `ACADEMY_HOBBY_BIAS`）。

## personality_tags 枚举（26 个）

`introverted, extroverted, slow_warm, talkative, humorous, empathetic, rational, romantic, independent, clingy, adventurous, homebody, organized, spontaneous, ambitious, easygoing, ambivert, sensitive, curious, loyal, perfectionist, carefree, creative, stubborn, anxious, optimistic`

每用户 3-7 个，按学院做性格偏置。

## 问卷

- 24 题：18 道 1-7 分 Likert（q01-q18）、1 道关系节奏单选、1 道关系需求多选（2-3 选、8 选项）、1 道关系角色单选、3 道开放题（intro_prompt, q19 雷区, q20 补充）
- 完整题目源在 `shared-fixtures/src/questionnaire.ts`
- 答题分布：Likert 项以高斯 N(4.5, 1.4) 为先验，按 personality_tags 做均值偏移（`PERSONALITY_LIKERT_BIAS`），再按 relationship_goal 做后验微调

## 匹配（dating_matches）

- **compatibility_score**: 整数 0-100
- **match_type**: instant 85，weekly_batch 15
- **status**: revealed 62，pending 38
- **explanation jsonb**: 4 个 key — `summary`（一句话总结，30-80 字）/ `highlights`（3 条亮点，每条 15-30 字）/ `shared_keywords`（2-4 个）/ `complement_points`（1-2 条互补）

## 反馈

- 类型枚举：`liked, passed, dismissed, chatted, met, blocked`
- 反馈分布按 `ground_truth_score` 的 4 段桶映射（详见 `generate-matches.ts` 的 `feedbackFromGroundTruth`）

## 消息

- 长度（中文字符）: 高斯 N(35, 23)，p90 ~50，最长不超过 ~120
- 类型分布：text 90、share_card 5、sticker 3、coin_packet 2

## 活跃时段（UTC）

按"大学生作息"设计：早上 14:00、晚饭后 21:00-23:00、深夜 02:00 三个峰值（即 UTC 06:00、13:00-15:00、18:00），见 `ACTIVE_HOUR_DIST_UTC`。

## 不要做的事

合成数据以及由它生成的衍生品（matches.json、portraits.json、训练好的模型权重）**不允许**被任何形式映射回真实用户。
