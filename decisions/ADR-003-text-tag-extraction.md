# ADR-003: 文本标签抽取 — 固定主标签 + 半开放子标签方案

**状态**：已实施  
**日期**：2026-05-15  
**决策者**：项目组

## 背景

问卷中有 3 个文本回答字段（Q22/Q23/Q24），之前仅用 `textDensityToLmh()` 转换为 L/M/H 三级，信息损失极大。需要一套能提取结构化语义标签的方案。

## 决策

采用**方案三：固定主标签 + 半开放子标签**，单次 LLM 调用提取带 weight 和 quote 的结构化标签。

### 标签体系

| 字段 | 主标签数量 | 主标签 |
|------|-----------|--------|
| Q22 (intro_prompt) | 5 场景 + 横切互动维度 | food_social / entertainment / sports_outdoor / stroll / study_together + strong/weak |
| Q23 (q19) | 5 | communication_breakdown / dishonesty / emotional_neglect / boundary_violation / over_demanding |
| Q24 (q20) | 7 | personality / lifestyle / relationship_pace / independence / location_conditions / appearance / values |

### 关键设计决策

1. **"聊天"不作为场景主标签**，而是横切的互动方式维度（strong/weak），避免抢占所有场景的标签归属
2. **子标签半开放**：提供预设参考（10-12 个/类），但允许 LLM 输出预设外的新子标签
3. **每个标签携带 weight (0-1) 和 quote (原文依据)**，支持下游加权匹配和可解释性
4. **无 API Key 时关键词降级**：用 presetSubs 做简单匹配，确保离线可运行
5. **三字段并行调用**：`extractAllTextTags` 用 `Promise.all` 并行，不阻塞主流程

### 为什么不选其他方案

- **方案一（纯关键词匹配）**：无法处理同义改写和新表达
- **方案二（纯开放 LLM 生成）**：标签碎片化，无法归约匹配
- **方案四（Embedding + 聚类）**：冷启动不可用，计算成本高

## 实现文件

| 文件 | 职责 |
|------|------|
| `src/tagTree.ts` | 标签树定义 + 类型导出 |
| `src/textTagExtractor.ts` | LLM 调用 + JSON 解析 + 降级逻辑 |
| `src/personaCard.ts` | 集成到画像生成流程 |
| `contracts/text-tags.contract.test.ts` | 合约测试（18 个用例） |

## 后果

- 下游匹配可以利用 main tag 做分桶、weight 做加权
- 前端展示可以引用 quote 做解释
- 标签体系可以通过修改 tagTree.ts 迭代，不影响抽取逻辑
