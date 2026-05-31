# 文本标签抽取评测报告

- 时间：2026-05-31T11:38:03.959Z
- 运行模式：fallback-only
- 模型：gpt-4.1
- 总样本数：11
- **整体主标签准确率：54.5%**
- 平均耗时：0ms/样本

## Q22 评测结果

- 样本总数：11
- 平均耗时：0ms
- modelId 分布：fallback-keyword=10, skip-empty=1

### 核心指标

| 指标 | 命中 / 总数 | 准确率 |
|---|---|---|
| 主标签准确率 | 6/11 | **54.5%** |
| 子标签宽松命中率 | 4/9 | 44.4% |
| 空判召回率 | 2/2 | 100.0% |
| 互动维度准确率 | 7/11 | 63.6% |

### 按 category 分桶（主标签准确率）

| category | 命中 / 总数 | 准确率 |
|---|---|---|
| normal | 2/6 | 33.3% |
| empty | 2/2 | 100.0% |
| longtail | 0/1 | 0.0% |
| boundary | 1/1 | 100.0% |
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
- **q22-010** `一起出门探店` (category: longtail)
  - expected_main: `["food_social"]`
  - extracted: `[]`
  - note: 探店一般是探索美食的意思，归入美食社交
