# 对话记录 01 — 项目初始分析与架构梳理

**日期**：2026-05-15  
**参与方**：用户 + Claude Code（claude-sonnet-latest）  
**主题**：理解项目结构，生成 CLAUDE.md，推送到 GitHub

---

## 关键讨论节选

### 1. 用中文解释项目做了什么

**用户**：用中文给我解释一下目前这个项目做了什么

**Claude**：

> 这是一个**华东师大校园恋爱 App（Ourai/欧睿）的课程作业模块 B**，专注于**问卷收集与用户人格画像**功能。
>
> 核心是 ECBTI（ECNU Behavioral Type Indicator）人格卡片算法：
> 1. 18 道 Likert 量表 + profile 字段 + 3 道文本题 → 15 维 L/M/H 用户向量
> 2. 与 25 个标准类型做 L1 距离匹配
> 3. 匹配度 < 60% → 强制 HALO 兜底
> 4. 文本命中关键词 → 触发隐藏人格（NIGHT/GHST/CHILL/GRIND）
> 5. 调 LLM（通义千问）生成专属文案，失败降级为 preset

**关键判断**：这套体系的设计中心是"让每个用户看到引用了自己原始回答的专属解读"，算法本身（buildUserVector + L1 匹配）是纯确定性的，LLM 只负责文案个性化，所以演示可以完全离线运行。

---

### 2. 项目协作规范确认

**用户**：帮我 push 到这个空仓库里，备注"原始项目文件上传"，接下来每一次做完一个决策和完整的改动都要你主动进行 push 并写明每一次的改动点，牢记：重要技术决策记进仓库的 decisions/ 目录里写 ADR，每一次和你协作的关键讨论挑几段保存到 ai-conversations/。

**达成约定**：
- 每次改动后主动 push，commit message 写明改动点
- 技术决策 → `decisions/ADR-NNN-*.md`（本次写了 ADR-001 ECBTI 体系、ADR-002 LLM 文案生成）
- 关键对话 → `ai-conversations/NN-*.md`

---

## 本次建立的理解

| 模块 | 文件 | 作用 |
|------|------|------|
| 类型库 | `src/personaCardTypes.ts` | 25 标准型 + 1 兜底 + 4 隐藏型的完整定义 |
| 算法核心 | `src/personaCard.ts` | buildUserVector / 匹配 / 隐藏触发 / LLM / 缓存 |
| 合约测试 | `contracts/persona-card.contract.test.ts` | 锁住下游依赖的接口形状 |
| API | `src/server/index.ts` | 4 个路由，读 fixture JSON 供前端消费 |
| 数据生成 | `shared-fixtures/` | 合成用户/画像/匹配数据的独立包 |
