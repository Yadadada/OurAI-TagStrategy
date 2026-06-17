# 问卷文本标签抽取方案

面向校园交友场景的问卷自由文本结构化标签抽取方案，包含完整的核心算法实现、评测框架与 Prompt 调优实验记录。

## 项目背景

交友问卷中存在 3 个开放文本回答字段：

| 字段 | 含义 | 示例输入 |
|---|---|---|
| Q22 (`intro_prompt`) | 期望一起做什么 | "一起探店或者在咖啡馆坐坐" |
| Q23 (`q19`) | 关系雷区 | "受不了中央空调式的暧昧" |
| Q24 (`q20`) | 对对方的补充要求 | "不喜欢爹味重的男的" |

原有方案仅将文本密度转为 L/M/H 三级，语义信息损失极大。本项目提出"**固定主标签 + 半开放子标签**"方案，通过单次 LLM 调用将上述文本结构化为带 `weight` 与 `quote` 的标签列表，并在 256 条评测集上完成零样本 / few-shot / CoT 三组 Prompt 对比实验，最终达到 97.5% 主标签准确率。

## 目录结构

```
.
├── module-b-portrait-pkg/
│   ├── module-b-portrait/          # 主工程（Vite + React 前端 + Express API）
│   │   ├── src/
│   │   │   ├── tagTree.ts              # 主标签体系定义（Q22/Q23/Q24 标签树）
│   │   │   ├── textTagExtractor.ts     # LLM 标签抽取引擎（含 few-shot / CoT 开关）
│   │   │   ├── personaCard.ts          # ECBTI 人格卡片评分引擎
│   │   │   ├── personaCardTypes.ts     # 25 种人格类型定义 + 15 维度模式串
│   │   │   ├── server/index.ts         # Express API 服务
│   │   │   └── components/             # React 可视化组件
│   │   ├── eval/
│   │   │   ├── q22_seeds.jsonl         # Q22 人工种子样本（15 条）
│   │   │   ├── q23_seeds.jsonl         # Q23 人工种子样本（15 条）
│   │   │   ├── q24_seeds.jsonl         # Q24 人工种子样本（16 条）
│   │   │   ├── q22_expanded.jsonl      # Q22 GPT-4.1 扩充样本（70 条）
│   │   │   ├── q23_expanded.jsonl      # Q23 GPT-4.1 扩充样本（72 条）
│   │   │   ├── q24_expanded.jsonl      # Q24 GPT-4.1 扩充样本（68 条）
│   │   │   ├── q{22,23,24}_holdout.jsonl  # held-out 验证集（27+27+26=80 条，异源生成）
│   │   │   ├── BASELINE.md             # 全部评测基线数字（Baseline #0~#7）
│   │   │   ├── DATASET-DESIGN.md       # 数据集构造原则与决策依据
│   │   │   ├── HOLDOUT-README.md       # Held-out 集构造说明
│   │   │   ├── audit/                  # 10% 人工抽检记录
│   │   │   ├── expansion-log/          # 扩充脚本运行日志（每次扩充的原始输出）
│   │   │   └── results/                # 每次评测的原始 JSON 报告
│   │   ├── scripts/
│   │   │   ├── run-eval.ts             # 主评测脚本（支持 --dataset / --exclude-few-shot 等参数）
│   │   │   ├── expand-dataset.ts       # 数据集扩充脚本（网格调度 + 去重）
│   │   │   ├── run-cross-model-eval.ts # 跨模型对比评测脚本
│   │   │   └── test-tag-extraction.ts  # 快速冒烟测试脚本
│   │   ├── contracts/                  # Contract 测试（锁定公共 API 接口形状）
│   │   └── vendored/                   # 上游原版文件备份（用于 merge-back patch）
│   └── shared-fixtures/            # 独立 npm 包：生成 JSON Fixture 数据
│       ├── src/                        # 用户/画像/匹配数据生成器
│       └── data/                       # 生成产物（users / portraits / matches / holdout）
├── decisions/
│   ├── ADR-001 ~ ADR-008.md            # 8 份架构决策记录
├── ai-conversations/
│   ├── 01-initial-analysis.md          # 初始需求分析对话
│   ├── 02-text-tag-design.md           # 标签方案设计对话
│   └── 03-eval-and-prompt-tuning.md    # 评测框架与 Prompt 调优对话
└── report/
    └── 20260618信息技术前沿创新汇报.pptx   # 最终汇报 PPT
```

## 核心方案：标签体系设计

### 主标签结构

| 字段 | 主标签 | 横切维度 |
|---|---|---|
| Q22 | `food_social` / `entertainment` / `sports_outdoor` / `stroll` / `study_together` | 互动强度 `strong` / `weak` |
| Q23 | `communication_breakdown` / `dishonesty` / `emotional_neglect` / `boundary_violation` / `over_demanding` | — |
| Q24 | `personality` / `lifestyle` / `relationship_pace` / `independence` / `location_conditions` / `appearance` / `values` | — |

每条标签输出格式：`{ main, sub, weight, quote }`，子标签半开放（有预设参考，允许 LLM 生成新值）。

无 API Key 时自动降级为关键词匹配。

## 实验结果

### Prompt 对比（三维：精度 × 速度 × 成本）

在 244 条评测集（256 条总集 - 12 条 few-shot 样本）上，以 gpt-4.1 为基准模型：

| 方法 | 主标签准确率 | 平均耗时 | Token/样本 | 相对成本 |
|---|---|---|---|---|
| **#4 零样本** | **97.5%** | 1464ms | 732 | 基线 |
| **#2 +few-shot** | 96.7% | 1603ms | 1036 | +41% |
| **#3 +few-shot+CoT** | **97.5%** | 1573ms | 1154 | +58% |

**关键发现**：零样本不是最贵的——它最便宜，且与 +CoT 并列精度最高。few-shot 的主要价值在子标签命中率（Q22 +19.2pp），而非主标签准确率。

### 工程选型矩阵

| 场景 | 推荐方法 |
|---|---|
| 成本敏感 / 批量离线打标 | **#4 零样本** |
| 生产平衡（推荐） | **#2 +few-shot** |
| Q22 网络词密集字段 | **按字段开 CoT**（仅 Q22） |
| 高预算 + 可解释性需求 | **#3 +CoT** |

### 基线对比（Baseline #0 vs #1）

| 方法 | 主标签准确率 |
|---|---|
| 关键词降级（无 LLM） | 53.3% |
| LLM 零样本 | 95.7% |
| **LLM 零样本（256 条扩充集）** | **97.5%** |

### Held-out 验证（同分布偏差检验）

在 80 条异源 held-out 集（Claude 生成 + 100% 人工筛选，longtail 比例刻意拉高至 45%）上：

| 数据集 | 准确率 |
|---|---|
| 扩充集（#4） | 97.5% |
| **Held-out 集** | **92.5%** |

差距 5pp 可解释：held-out longtail 比例为扩充集的 2 倍，且全部错误均集中在 longtail 桶，normal / boundary / perturbation 三类全部 100%。

## 快速上手

### 环境要求

- Node.js ≥ 18
- 一个 OpenAI 兼容协议的 API Key（支持 Dashscope / LiteLLM / OneAPI 等）

### 安装依赖

```bash
cd module-b-portrait-pkg/module-b-portrait
npm install
```

### 配置环境变量

在 `module-b-portrait-pkg/module-b-portrait/` 下创建 `.env`（已被 .gitignore 忽略）：

```
QWEN_API_KEY=你的API_Key
QWEN_BASE_URL=http://你的proxy地址/openai/v1
DATING_TAG_MODEL_ID=你的模型名
```

### 生成 Fixture 数据（首次运行必须）

```bash
npm run fixtures:gen
```

### 启动 Dev Server

```bash
# Bash / Git Bash
QWEN_API_KEY=你的Key QWEN_BASE_URL=http://proxy/openai/v1 DATING_TAG_MODEL_ID=gpt-4o npm run dev

# PowerShell
$env:QWEN_API_KEY="你的Key"; $env:QWEN_BASE_URL="http://proxy/openai/v1"; npm run dev
```

前端访问 `http://localhost:5173`，API 服务在 `http://localhost:3010`。

### 快速冒烟测试（标签抽取）

```bash
npx tsx scripts/test-tag-extraction.ts
```

## 复现评测实验

所有评测命令在 `module-b-portrait-pkg/module-b-portrait/` 下执行，需先配置 `.env`。

```bash
# Baseline #4：零样本，256 条完整集
npx tsx scripts/run-eval.ts --dataset all

# Baseline #2：+few-shot（公平对比，剔除 12 条 few-shot 样本）
DATING_TAG_FEW_SHOT=1 npx tsx scripts/run-eval.ts --dataset all --exclude-few-shot

# Baseline #3：+few-shot +CoT
DATING_TAG_FEW_SHOT=1 DATING_TAG_COT=1 npx tsx scripts/run-eval.ts --dataset all --exclude-few-shot

# Baseline #7：held-out 验证集
npx tsx scripts/run-eval.ts --dataset holdout

# 跨模型对比
npx tsx scripts/run-cross-model-eval.ts --suite default --dataset holdout
```

评测报告输出在 `eval/results/`，基线汇总见 `eval/BASELINE.md`。

### 运行 Contract 测试

```bash
npm run test:contract
```

## 决策记录（ADR）

| 编号 | 主题 |
|---|---|
| ADR-001 | ECBTI 人格类型系统设计 |
| ADR-002 | LLM 文本生成与降级策略 |
| ADR-003 | 文本标签抽取方案选型（固定主标签 + 半开放子标签） |
| ADR-004 | 评测数据集构造方法（三段式：人工种子 + GPT 扩充 + 抽检） |
| ADR-005 | 评测 category 分桶设计 |
| ADR-006 | 互动维度标注规则收紧（双人对打运动 = strong） |
| ADR-007 | Few-shot 样本选取与评测公平性保障 |
| ADR-008 | 三轴选型矩阵（精度 × 速度 × 成本） |
