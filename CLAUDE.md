# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

```
module-b-portrait-pkg/
  shared-fixtures/      # Standalone data-generation package (@coursework/shared-fixtures)
  module-b-portrait/    # Vite + React frontend + Express API backend
```

`module-b-portrait` depends on `shared-fixtures` via a local file path (`"file:../shared-fixtures"`).

## Commands

All commands run from `module-b-portrait-pkg/module-b-portrait/`:

```bash
# Start both Vite (port 5173) and Express API (port 3010) simultaneously
npm run dev

# Start individually
npm run dev:web      # Vite frontend only
npm run dev:api      # Express API only (tsx watch)

# Build
npm run build        # tsc + vite build → dist/web/

# Tests
npm test             # vitest run (all tests)
npm run test:watch   # vitest interactive watch
npm run test:contract  # run only contracts/

# Regenerate fixture data (needed before first run)
npm run fixtures:gen   # delegates to shared-fixtures → data/*.json
```

For `shared-fixtures` package regeneration directly:

```bash
cd module-b-portrait-pkg/shared-fixtures
npm run generate:small   # produces data/{users,portraits,matches,holdout}.json
```

## Architecture

### Data flow

1. `shared-fixtures` generates JSON fixture files in `shared-fixtures/data/` (users, portraits, matches). These are loaded at API startup.
2. The Express server (`src/server/index.ts`) reads those files and serves them via `/api/portrait/*`.
3. Vite proxies `/api` → `localhost:3010` during development.
4. The React frontend (`src/App.tsx`) has three tabs:
   - **画像可视化**: MBTI radar, traits radar, interest word cloud from fixture portrait data
   - **问卷流程**: 24-question flow (18 Likert + 6 profile/text fields)
   - **人格卡片**: ECBTI persona card computed client-side from `buildUserVector`

### Core algorithm: ECBTI persona card

The personality-card algorithm lives entirely in two files:

- **`src/personaCardTypes.ts`** — Type definitions + the full type library:
  - 25 standard types (`ECBTI_TYPES`), 1 fallback (`FALLBACK_HHHH` / `HALO`), 4 hidden trigger types (`HIDDEN_TYPES`)
  - Each type has a 15-character `pattern` string of `L`/`M`/`H` values
  - `STANDARD_TYPE_LIBRARY = ECBTI_TYPES` (hidden types excluded from standard matching)

- **`src/personaCard.ts`** — The scoring engine:
  1. `buildUserVector(answers, profile)` → maps 18 Likert answers + profile fields + 3 text fields into 15 `L`/`M`/`H` dimension values (`DIM_ORDER`)
  2. L1 distance matching against all 25 standard type patterns → best match
  3. Hidden trigger detection via keyword scan on `intro_prompt`, `q19`, `q20`
  4. If `matchPercent < 60` → forced `HALO` fallback
  5. LLM call to Dashscope (`QWEN_API_KEY`) to generate unique copy; falls back to preset text if LLM fails
  6. Result cached in DB by SHA1 hash of `(versionKey, answers, profile)`

The **15 dimensions** (`DIM_ORDER`) must stay in sync between `personaCardTypes.ts` and `personaCard.ts`. The pattern string index position is the contract.

### The 24 questionnaire answer keys

The `buildUserVector` algorithm depends on exactly 24 answer keys:
- `q01`–`q18`: Likert scale 1–7
- `q19`, `q20`: free-text fields
- `relationship_goal`, `relationship_role`, `relationship_needs`, `intro_prompt`: profile fields collected during onboarding

### Contract tests

`contracts/` contains three vitest suites that pin the public API surface:
- `persona-card.contract.test.ts`: 25 standard types, 15-dim vector shape, `PersonaCardPayload` key presence
- `questionnaire.contract.test.ts`: exactly 24 answer keys, 18 Likert defaults 1–7
- `text-tags.contract.test.ts`: tag tree stability (Q22=5, Q23=5, Q24=7 main tags), extraction output shape

These must pass before any PR merges back to the upstream Ourai repo.

### Text tag extraction

`src/tagTree.ts` + `src/textTagExtractor.ts` 实现"固定主标签 + 半开放子标签"的文本标签抽取：
- Q22 (intro_prompt): 5 场景主标签 + 强/弱互动横切维度
- Q23 (q19): 5 个关系雷区主标签
- Q24 (q20): 7 个补充要求主标签
- 调用 OpenAI 兼容协议 LLM，输出带 weight + quote 的结构化标签
- 无 API Key 时自动降级为关键词匹配

### Stubs

`src/stubs/` contains stub implementations of `logger`, `auth`, `agent-client`, `model`, and `database`. In the coursework context these are never wired to real services — the Express demo server uses `pool` (stub database) and `datingModel` (stub ORM) that are no-ops.

### Environment variables (for full persona card server path)

- `QWEN_API_KEY` — Dashscope API key for LLM generation
- `QWEN_BASE_URL` — optional, defaults to `https://dashscope.aliyuncs.com/compatible-mode/v1`
- `DATING_PERSONA_CARD_MODEL_ID` / `DATING_RELATIONSHIP_SUMMARY_MODEL_ID` — model override (default: `qwen-plus`)
- `DATING_TAG_MODEL_ID` — text tag extraction model override (default: `qwen-plus`)
- `PERSONA_FALLBACK_MODEL_ID` — fallback model if primary fails (default: `qwen-turbo`)
- `CAMPUS_REVIEW_TOKEN` — allows unauthenticated preview via `x-campus-review-token` header

## 本地运行（使用非 Dashscope 的 LLM proxy）

项目默认使用通义千问 Dashscope API。如果本地有 OpenAI 兼容协议的 proxy（如 LiteLLM、OneAPI 等），需要：

1. 在 `module-b-portrait-pkg/module-b-portrait/` 下创建 `.env` 文件（已被 .gitignore 忽略）：

```
QWEN_API_KEY=你的API_Key
QWEN_BASE_URL=http://你的proxy地址/openai/v1
DATING_TAG_MODEL_ID=你的模型名
```

2. 运行测试脚本验证标签抽取：

```powershell
cd module-b-portrait-pkg/module-b-portrait
npx tsx scripts/test-tag-extraction.ts
```

3. 启动 dev server 需要在 shell 中先设置环境变量再启动：

```powershell
# PowerShell
$env:QWEN_API_KEY="你的API_Key"
$env:QWEN_BASE_URL="http://你的proxy地址/openai/v1"
$env:DATING_TAG_MODEL_ID="你的模型名"
npm run dev
```

```bash
# Bash / Git Bash
QWEN_API_KEY=你的API_Key QWEN_BASE_URL=http://你的proxy地址/openai/v1 DATING_TAG_MODEL_ID=你的模型名 npm run dev
```

**注意**：`.env` 文件仅被测试脚本 (`scripts/test-tag-extraction.ts`) 自动加载。`npm run dev` 启动的 server 不会自动读 `.env`，需要手动设置环境变量或使用 `cross-env` 等工具。

## 项目推进计划（汇报 + 代码仓库）

最终产出：**PPT 汇报 + 提交代码仓库**。

### 阶段一（必做）：评测框架 + Prompt 调优

**方向 1：评测数据集与指标**
- 构造模拟样本（覆盖正常、长尾、扰动、边界，每字段约 80-100 条，共约 250 条）
- 标注格式：`{ rawText, expected_main, expected_sub_contains, should_skip }`
- 评测脚本运行 `extractQ22Tags` / `extractQ23Q24Tags`，输出主标签准确率、空判召回率
- 数据集放在 `eval/` 目录，脚本放在 `scripts/run-eval.ts`

**方向 3：Prompt 调优**
- 基线：当前零样本 prompt（`textTagExtractor.ts`）
- 实验变体：加 few-shot（2-3 例）、加轻量 CoT 提示
- 用评测脚本对比各变体，记录准确率 vs token 数，选 Pareto 最优
- 结论写入 PPT 的"实验结果"章节

### 阶段二（有时间再做）：跨领域迁移

**方向 2：领域无关配置化**
- 将 `tagTree.ts` 改为 `DomainConfig` 注入模式
- 演示至少一个跨领域场景（如电商评论）
- 在同一评测框架上跑迁移后的准确率，说明泛化能力

### PPT 章节规划

| 章节 | 内容来源 |
|---|---|
| 问题背景 | 自由文本不可计算，需要结构化 |
| 方法设计 | 固定主标签 + 半开放子标签 + 降级机制（已有代码） |
| 实验结果 | 方向 1 评测数字 + 方向 3 prompt 变体对比 |
| 跨领域迁移（可选） | 方向 2 演示 |
| 工程优化思路 | 方向 4：请求队列、熔断、可观测性（分析为主，不写代码） |
| 拓展应用价值 | 方向 5：匹配推荐赋能、冷启动对话、安全过滤（定性+定量分析） |
| 未来工作 | 方向 4+5 的实现路径 |
