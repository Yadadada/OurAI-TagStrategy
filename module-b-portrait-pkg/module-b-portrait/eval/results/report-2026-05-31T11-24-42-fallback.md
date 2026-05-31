# 文本标签抽取评测报告

- 时间：2026-05-31T11:24:42.321Z
- 运行模式：fallback-only
- 模型：gpt-4.1
- 总样本数：15
- **整体主标签准确率：53.3%**
- 平均耗时：0ms/样本

## Q22 评测结果

- 样本总数：15
- 平均耗时：0ms
- modelId 分布：fallback-keyword=13, skip-empty=2

### 核心指标

| 指标 | 命中 / 总数 | 准确率 |
|---|---|---|
| 主标签准确率 | 8/15 | **53.3%** |
| 子标签宽松命中率 | 5/12 | 41.7% |
| 空判召回率 | 3/3 | 100.0% |
| 互动维度准确率 | 11/15 | 73.3% |

### 按 category 分桶（主标签准确率）

| category | 命中 / 总数 | 准确率 |
|---|---|---|
| normal | 3/7 | 42.9% |
| empty | 3/3 | 100.0% |
| longtail | 0/2 | 0.0% |
| boundary | 1/2 | 50.0% |
| perturbation | 1/1 | 100.0% |

### 错误样本明细

- **q22-004** `一起去看展` (category: normal)
  - expected_main: `["entertainment"]`
  - extracted: `[]`
  - note: 看展览，不确定是否会交流很多
- **q22-005** `一起约着打场羽毛球` (category: normal)
  - expected_main: `["sports_outdoor"]`
  - extracted: `[]`
  - note: 羽毛球属于双人对打类运动，需要持续配合，归强互动
- **q22-006** `去学校附近逛逛` (category: normal)
  - expected_main: `["stroll"]`
  - extracted: `[]`
  - note: 没有提到聊聊天也没有说安静散步，所以互动类型归入null
- **q22-007** `去吃好吃的，边吃边聊聊天` (category: normal)
  - expected_main: `["food_social"]`
  - extracted: `[]`
  - note: 美食社交+强互动，提到了吃好吃的和聊聊天
- **q22-009** `citywalk` (category: longtail)
  - expected_main: `["stroll"]`
  - extracted: `[]`
  - note: citywalk属于网络用语，也是一起出去逛逛的意思；网络语境隐含轻互动，但文本未明确出现互动信号词，从严判null
- **q22-010** `一起出门探店` (category: longtail)
  - expected_main: `["food_social"]`
  - extracted: `[]`
  - note: 探店一般是探索美食的意思，归入美食社交
- **q22-011** `一起吃饭，吃完散步聊聊天` (category: boundary)
  - expected_main: `["food_social","stroll"]`
  - extracted: `[]`
  - note: 既有吃饭也有散步，同时两个主标签，另外提到了聊天，属于强互动
