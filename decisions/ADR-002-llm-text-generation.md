# ADR-002: 用 LLM 生成个性化人格卡片文案，preset 降级兜底

**状态**：已采纳  
**日期**：2026-05-15  
**背景**：模块 B 初始架构设计

---

## 背景

每个 ECBTI 类型有固定的 `fallbackSummary` 和 `fallbackHighlights`，但所有匹配到同一类型的用户会看到完全相同的文案，体验差。

## 决策

为每个用户调用 LLM（通义千问 / Dashscope）生成专属文案：

- **输入**：主类型、次类型、15 维用户向量、用户三段自写文本（intro_prompt / q19 / q20）、基础档案信息
- **输出 JSON**：`nickname`（2–5字原创昵称）、`catchphrase`（10–20字标语）、`summary`（250–350字深度解读）、`highlights`（3条亮点）、`references`（3条引用用户原文）、`hidden_tagline`
- **风格约束**（硬规则写入 prompt）：必须有"嘴上 vs 手上"对比句、至少一个夸张比喻、允许互联网梗但每段不超过 2 个、禁止心理学诊断词
- **降级策略**：
  1. 首选 `DATING_PERSONA_CARD_MODEL_ID`（默认 qwen-plus）
  2. 失败 → 重试 `PERSONA_FALLBACK_MODEL_ID`（默认 qwen-turbo，温度更低）
  3. 再失败 → 使用 preset 文案（`degraded: true`）

## 缓存策略

结果按 `SHA1(versionKey + answers + profile)` 缓存到 DB（`dating_persona_card_cache` 表）。只要输入不变，不重复调 LLM。

## 后果

**正面：**
- 每个用户看到的卡片都引用了自己的原始回答，认同感强
- nickname 每次都原创，有传播性

**负面：**
- LLM 调用增加延迟（≤30s timeout），需要 loading 态
- LLM 输出格式不稳定，需要健壮的 JSON 解析（`tryParseLlmJson` 同时兼容 flat / nested 两种结构）
- 开发/测试环境无 `QWEN_API_KEY` 时全部走降级路径，前端演示不受影响

## 文件位置

- LLM 调用逻辑：`src/personaCard.ts` → `callDashscope` / `callLlm`
- Prompt 构造：`src/personaCard.ts` → `buildPrompt`
- JSON 解析：`src/personaCard.ts` → `tryParseLlmJson`
