# 评测数据集（Evaluation Dataset）

本目录存放文本标签抽取的评测数据，用于验证 `src/textTagExtractor.ts` 的抽取效果。

## 数据组成

| 文件 | 字段 | 数量目标 | 用途 |
|---|---|---|---|
| `q22_seeds.jsonl` | intro_prompt（第一次见面想做什么） | 15 条种子 → 扩到 80-100 | 主标签：5 个场景 + 互动维度 |
| `q23_seeds.jsonl` | q19（关系雷区） | 15 条种子 → 扩到 80-100 | 主标签：5 个雷区 |
| `q24_seeds.jsonl` | q20（补充要求） | 15 条种子 → 扩到 80-100 | 主标签：7 个补充类别 |

## 单条样本字段定义

```json
{
  "id": "q22-001",
  "text": "想找个咖啡馆坐坐聊聊天",
  "expected_main": ["food_social"],
  "expected_interaction": "strong",
  "expected_sub_keywords": ["咖啡"],
  "should_skip": false,
  "category": "normal",
  "note": "美食社交+强互动的典型组合"
}
```

| 字段 | 类型 | 说明 | 必填 |
|---|---|---|---|
| `id` | string | 唯一编号，格式 `{字段}-{三位序号}`（如 `q22-001`） | 是 |
| `text` | string | 模拟用户回答原文 | 是 |
| `expected_main` | string[] | 期望的主标签 ID 数组（多个表示都对，命中其一即正确） | 是 |
| `expected_interaction` | `"strong"` / `"weak"` / `null` | Q22 专用，互动维度期望值 | Q22 必填 |
| `expected_sub_keywords` | string[] | 子标签里期望出现的关键词（用于宽松匹配） | 选填 |
| `should_skip` | boolean | 是否应被 `EMPTY_TEXT_PATTERNS` 拦截返回空 | 是 |
| `category` | enum | 见下方"类别"分桶定义 | 是 |
| `note` | string | 标注理由备忘，给未来自己看 | 选填 |

## 类别（category）分桶

评测时按 category 分桶展示准确率，比一个总数更有说服力。

| 类别 | 含义 | 占比目标 |
|---|---|---|
| `normal` | 主标签清晰、表达自然 | ~55% |
| `longtail` | 网络用语、方言、缩写、不常见表达 | ~13% |
| `boundary` | 同时落在多个主标签上的边界样本 | ~13% |
| `empty` | 应被 skip（"随便"、空字符串、纯标点等） | ~13% |
| `perturbation` | 带否定词或语义反转 | ~7% |

## 标注规范（重要）

### 1. 用第一人称、口语化

写：`想去喝奶茶` / `不想太早确定关系`
不写：`用户希望前往奶茶店进行消费` / `User does not want to define the relationship prematurely`

### 2. 长度参考真实回答

5–30 字最常见，偶尔 1–2 条 50+ 字（用户偶尔会写长）。

### 3. `expected_main` 允许多值

边界样本（如"打球完吃饭"）标 `["sports_outdoor", "food_social"]`，评测时只要命中其中一个就算对。

### 4. `should_skip = true` 时

`expected_main` 必须是 `[]`，`expected_interaction` 必须是 `null`。

### 5. 自检问题

写完每条问自己：**如果让另一个人看这条 text，他会同意我的 expected_main 吗？**

如果不能 90% 确定，要么改 text 让其更清晰，要么加 `note` 解释你的判断依据。

## 主标签 ID 速查（写种子时对照用）

### Q22 (intro_prompt) — 5 个场景主标签

| ID | label | 典型子标签 |
|---|---|---|
| `food_social` | 美食社交 | 咖啡、奶茶、火锅、烧烤、日料、甜品 |
| `entertainment` | 文娱体验 | 电影、展览、剧本杀、桌游、KTV、手工 |
| `sports_outdoor` | 运动户外 | 跑步、球类、骑行、爬山、健身、飞盘 |
| `stroll` | 散步闲逛 | 校园散步、河边走走、逛街、压马路 |
| `study_together` | 学习共处 | 图书馆、自习室、一起看书、泡实验室 |

**互动维度（额外一维）**：
- `strong`：聊天/深聊/分享/讨论
- `weak`：安静陪伴/各做各的
- `null`：未明确

### Q23 (q19) — 5 个关系雷区主标签

| ID | label | 典型子标签 |
|---|---|---|
| `communication_breakdown` | 沟通断裂 | 冷暴力、已读不回、冷战、阴阳怪气 |
| `dishonesty` | 不真诚 | 说谎、隐瞒、脚踏两船、出轨 |
| `emotional_neglect` | 情感敷衍 | 敷衍、忽冷忽热、不上心、缺乏仪式感 |
| `boundary_violation` | 边界侵犯 | 控制欲、查手机、过度干涉、PUA |
| `over_demanding` | 过度索取 | 只索取不付出、情感吸血、自私自利 |

### Q24 (q20) — 7 个补充要求主标签

| ID | label | 典型子标签 |
|---|---|---|
| `personality` | 性格气质 | 开朗、幽默、温柔、成熟、情绪稳定 |
| `lifestyle` | 生活方式 | 爱运动、不吸烟、有共同爱好、爱整洁 |
| `relationship_pace` | 关系节奏 | 慢慢来、不急、给空间 |
| `independence` | 独立空间 | 有自己的生活、不粘人、有圈子 |
| `location_conditions` | 地域条件 | 同校区、同城、年级相近 |
| `appearance` | 外貌形象 | 身高、穿搭、干净整洁、有气质 |
| `values` | 价值观 | 三观一致、有责任感、上进心、对感情认真 |

## 写完后的下一步

1. 自检：每条都过一遍上面的"标注规范"
2. 提交给 Claude 审核：会检查 `expected_main` 是否合理、类别分布是否平衡
3. 跑评测脚本（后续创建 `scripts/run-eval.ts`）看基线效果
4. 用种子做 few-shot 让 LLM 扩充到 250 条
