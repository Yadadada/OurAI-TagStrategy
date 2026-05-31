# ADR-007: Few-shot 例子选取与评测公平性 — 四象限覆盖 + 硬编码剔除

**状态**：已实施
**日期**：2026-05-31
**决策者**：项目组

## 背景

方向 3 第一个实验是给 prompt 加 few-shot 例子。两个核心设计问题：

1. **选什么例子？**——few-shot 例子的选取直接决定 LLM 学到的"输出范式"
2. **如何评测公平？**——如果 few-shot 例子也出现在评测集里，等于"考前看过原题"，准确率虚高

## 决策

### 1. Few-shot 选取规范：每字段 4 条覆盖四象限

每个字段（Q22/Q23/Q24）选 **4 条 few-shot**，分别对应：

| 象限 | 作用 | Q23 例子 |
|---|---|---|
| **normal** | 教典型表达的标签归属 | "已读不回最受不了" → communication_breakdown |
| **longtail** | 教网络词到主标签的映射 | "喜欢画大饼" → dishonesty |
| **boundary** | 教多主标签 weight 分配 | "忽冷忽热，吵架还冷暴力" → emotional_neglect (0.5) + communication_breakdown (0.5) |
| **empty** | 教如何返回空数组 | "" → tags:[] |

**为什么 4 条而不是 2 条或 8 条**：
- 2 条：覆盖不全，LLM 学不到边界处理
- 8 条：prompt 显著变长（成本上升），且根据 in-context learning 文献，4-5 条之后边际收益递减

**例子来源**：从已有种子集挑选，**不是另写**——这样保证 few-shot 例子的标注质量与种子集一致。

### 2. 评测公平性：硬编码 ID 剔除

12 条 few-shot 例子的样本 ID 写死在 `scripts/run-eval.ts` 的 `FEW_SHOT_IDS` 常量中：

```typescript
const FEW_SHOT_IDS = new Set<string>([
  'q22-001', 'q22-009', 'q22-011', 'q22-013',
  'q23-001', 'q23-009', 'q23-011', 'q23-014',
  'q24-001', 'q24-010', 'q24-013', 'q24-003',
]);
```

跑评测时加 `--exclude-few-shot` flag，自动从评测集剔除这 12 条（256 → 244）。

**双向保证一致性**：
- `textTagExtractor.ts` 中 `FEW_SHOT_Q22/Q23/Q24` 数组（实际放进 prompt 的内容）
- `run-eval.ts` 中 `FEW_SHOT_IDS` 集合（评测时剔除的 ID）
- 两边必须严格对齐，注释中标注"修改时同步另一处"

### 3. 评测标志位规范

`--exclude-few-shot` 是**显式选项**而非默认行为。理由：
- 跑 baseline #4（零样本）时不需要剔除
- 跑 baseline #2/#3（带 few-shot）时必须剔除
- 显式标志位让命令行历史清晰，方便复现

## 为什么不选其他方案

- **few-shot 例子另写新文本**：写新文本就要重新人工标注，增加成本；且新文本风格可能与种子集不一致
- **不剔除评测集**：等于让 LLM 在评测中"看过原题"，准确率会虚高 5-10pp，失去对比意义
- **跨字段共享 few-shot**：标签体系不同（Q22 场景 vs Q23 雷区），共享例子会让 LLM 混淆
- **Random sampling few-shot**（每次抽取时随机抽几条）：评测不可复现，且增加运行时复杂度

## 实现文件

| 文件 | 职责 |
|---|---|
| `src/textTagExtractor.ts` | `FEW_SHOT_Q22/Q23/Q24` 数组（4 条/字段，含 reasoning 字段供 CoT 复用） |
| `scripts/run-eval.ts` | `FEW_SHOT_IDS` 集合 + `--exclude-few-shot` 标志 |
| `eval/BASELINE.md` | 记录 12 条 few-shot ID 的对应种子样本 |

## 后果

- **Baseline #2/#3 评测公平**：实际评测集 244 条，与 #4 同口径对比
- **few-shot 价值被准确量化**：Q22 子标签命中率 70.7%→89.9%（+19.2pp），证明 few-shot 主要价值是**教格式不是教知识**
- **暴露 few-shot 副作用**：q24-exp-019 在 #4 是对的、加了 few-shot 反而错（"给彼此空间"被例子 q24-013 风格带偏成 relationship_pace 而非 independence）—— 这条副作用是 PPT "no free lunch" 叙事的关键证据
- 未来加新 few-shot 例子时，规范化流程：从种子挑 → 标 ID → 同步两处常量 → 跑评测验证不引入新错
