# ADR-001: 采用 ECBTI 原创人格类型体系替代 MBTI

**状态**：已采纳  
**日期**：2026-05-15  
**背景**：模块 B 初始架构设计

---

## 背景

校园恋爱 App 需要一套人格测评体系，帮助用户了解自己的恋爱风格，并为匹配算法提供结构化特征向量。

直接使用 MBTI 有几个问题：
1. MBTI 4 个维度无法捕捉恋爱场景特有的行为偏好（如破冰主动度、异地接受度、关系雷区）
2. MBTI 类型与恋爱匹配的相关性学术上存疑
3. 版权与商标问题

## 决策

设计原创的 **ECBTI（ECNU Behavioral Type Indicator）** 体系：

- **15 个维度**（L/M/H 三档）代替 MBTI 的 4 个二元维度
  - 9 个来自 18 道 Likert 量表（q01–q18）
  - 3 个来自 profile 单选字段（关系节奏、异地接受度、生活习惯）
  - 3 个来自文本分析（见面场景、关系雷区、破冰方式）
- **25 个标准类型** + 1 个兜底（HALO）+ 4 个隐藏触发类型
- 匹配算法：L1 距离（最大距离 30），`matchPercent = (1 - distance/30) * 100`
- 匹配度 < 60% 时强制归入 HALO（"标准库对你集体罢工"）
- 文本字段命中关键词时触发隐藏人格（完全覆盖标准匹配结果）

## 后果

**正面：**
- 维度语义直接对应恋爱行为，用户认同度高
- 隐藏人格机制增加趣味性和传播性
- 15 维向量可直接作为模块 A 匹配算法的特征输入

**负面：**
- 25 个类型的 pattern 字符串需要人工标定，维护成本高
- 没有外部效度验证（纯定性设计）
- 文本关键词触发逻辑脆弱，存在误触发风险（已通过否定前缀检测部分缓解）

## 文件位置

- 类型库：`module-b-portrait-pkg/module-b-portrait/src/personaCardTypes.ts`
- 算法：`module-b-portrait-pkg/module-b-portrait/src/personaCard.ts`
- 合约测试：`module-b-portrait-pkg/module-b-portrait/contracts/persona-card.contract.test.ts`
