# Held-out 评测集说明

## 文件清单

- `q22_holdout.jsonl` — 27 条
- `q23_holdout.jsonl` — 27 条
- `q24_holdout.jsonl` — 26 条
- 合计 **80 条**

## 用途

回应负责人提出的"GPT-4.1 扩充 + GPT-4.1 评测 = 同分布偏差"质疑的**第二层验证**。第一层（跨模型评测）已在 `CROSS-MODEL-RESULT.md` 完成，证明三家模型在扩充集上的差距 ≤ 3pp。本第二层用一份**与扩充集独立来源**的样本作对照集，回答"扩充集是否系统性偏离真实表达分布"。

## 来源与构造方式

**不是从 fixture 抓取的真实用户回答**——`shared-fixtures/data/users.json` 中三个文本字段实际只有 28 条独特模板句（intro_prompt 10 / q19 10 / q20 8），全部为简单陈述、缺少 longtail/boundary/perturbation 类型，无法承担 held-out 的对照使命。

实际构造方式：**Claude 生成候选 + 人工筛选**。Claude 与 GPT-4.1 不同家族，写作风格分布与扩充集不重叠；人工筛选时刻意挑选符合"中国大学生口语 + 网络流行词 + 真实扰动结构"特征的文本。

## 与扩充集的关键差异

| 维度 | 扩充集（256 条） | Held-out 集（80 条） |
|---|---|---|
| 生成模型 | GPT-4.1 | Claude（4.5/4.7） |
| 人工介入 | 10% 抽检（22 条核对） | 100% 人工筛选+标注 |
| category 分布 | 60/20/10/10/0（normal/longtail/boundary/perturbation/empty） | 25/45/16/14/0（刻意拉高 longtail） |
| 文件命名 | `q*_seeds.jsonl` + `q*_expanded.jsonl` | `q*_holdout.jsonl` |
| source 字段 | 无（默认 seed/expanded） | `claude-generated-human-curated` |

**为什么 held-out 把 longtail 拉到 45%**：held-out 的使命就是测"难样本"，longtail（网络词、流行语、新生表达）是扩充集与真实分布最容易出现风格偏差的类目，加重 longtail 占比让对照数字最有信息量。empty 类已由种子集覆盖，不在 held-out 中重复。

## 限制与诚实声明

- 这不是"真实线上 held-out 集"——校园问卷上线前没有真实流量，无法获取真实用户回答
- 与扩充集相比，本集**生成源不同**（Claude vs GPT-4.1）+ **人工干预度不同**（100% 筛选 vs 10% 抽检）+ **分布不同**（拉高 longtail）。三个变量同时变化，差距来源不能完全归因到"风格偏差"
- 但作为周末时间约束下能拿到的最佳对照集，足以为 PPT 提供"换一份分布不同的数据，准确率是否还稳定"的初步证据

## 评测使用

```bash
# 在 held-out 集上跑 baseline #4（零样本）
npx tsx scripts/run-eval.ts --dataset holdout

# 在 held-out 集上跑跨模型对照
npx tsx scripts/run-cross-model-eval.ts --suite default --dataset holdout
```

`scripts/run-eval.ts` 与 `scripts/run-cross-model-eval.ts` 需要支持 `--dataset holdout` 模式（读取 `q*_holdout.jsonl` 而非 `q*_expanded.jsonl + q*_seeds.jsonl`）。该改造尚未完成，列入待办。

## 版本

| 版本 | 日期 | 主要改动 |
|---|---|---|
| v1.0 | 2026-06-06 | 初版 80 条（27+27+26），Claude 生成 + 人工筛选 |
