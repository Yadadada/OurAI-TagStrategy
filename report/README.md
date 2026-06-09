# 汇报材料 — 问卷自由文本标签抽取方案

本目录两份产物**内容完全一致**，只是渲染方式不同：

| 文件 | 用途 | 打开方式 |
|---|---|---|
| `report.md` | Marp Markdown 源文档 | VSCode + Marp 插件预览 / `marp` CLI 转 .pptx |
| `report.html` | 自包含单页 HTML | 浏览器双击直接打开（含 Mermaid CDN） |

## 内容大纲（14 页 / 15 分钟）

1. **封面 + 目录**（P1-P2）
2. **问题与方案**（P3-P5）—— 标签体系：背景 / 设计依据 / 总览
3. **抽取实现**（P6-P7）—— 流程图 / 静态 demo
4. **评测体系**（P8-P9）—— 三段式数据集 / 5 类分桶
5. **Prompt 调优**（P10-P11）—— 三轴对比 / 反直觉发现 + 选型矩阵 ⚠️必讲 ①
6. **同分布偏差应对**（P12-P13）—— 跨模型 / held-out ⚠️必讲 ②
7. **未来工作**（P14）

每页底部都有 **演讲词（speaker notes）**：
- HTML 版：可折叠 `<details>`，右下角按钮一键展开/折叠全部
- Marp 版：以 `<!-- ... -->` 形式存为 PPT 备注页

## 把 Marp 转成 .pptx

```bash
# 安装 marp-cli（一次性）
npm install -g @marp-team/marp-cli

# 在 report/ 目录下转换
marp report.md --pptx -o report.pptx           # 输出 PowerPoint
marp report.md --pdf -o report.pdf             # 输出 PDF
marp report.md --html -o report-marp.html      # 输出 Marp 风格 HTML（与本目录的 report.html 不同——后者是定制样式）
```

**或者**：装 VSCode "Marp for VS Code" 插件，打开 `report.md` → 右上角导出按钮一键导出。

## 把 HTML 转成 PDF

直接浏览器 `Ctrl+P` → 另存为 PDF。HTML 已加 `@media print` 样式，每页自动分页。

## 关键素材引用

| 章节 | 引用文件 |
|---|---|
| P3 问题背景 | `decisions/ADR-003-text-tag-design.md`、`eval/BASELINE.md` Baseline #0 |
| P4-P5 标签体系 | `eval/DATASET-DESIGN.md` §3、`src/tagTree.ts` |
| P6-P7 抽取实现 | `src/textTagExtractor.ts` |
| P8 数据集构造 | `decisions/ADR-004`、`eval/DATASET-DESIGN.md` §1-2 |
| P9 分桶 | `decisions/ADR-005`、`eval/DATASET-DESIGN.md` §4 |
| P10-P11 Prompt 调优 | `decisions/ADR-007`、`decisions/ADR-008`、`eval/BASELINE.md` Baseline #2/#3/#4 |
| P12 跨模型 | `eval/CROSS-MODEL-RESULT.md` |
| P13 Held-out | `eval/HOLDOUT-README.md`、`eval/BASELINE.md` Baseline #7 |

## 维护

数据更新（如新增 baseline、补 held-out）后，先改 `report.md`，再把对应改动同步到 `report.html`。两份文件结构是 1:1 对应的，搜索段落标题即可定位。

## 版本

| 版本 | 日期 | 主要内容 |
|---|---|---|
| v1.0 | 2026-06-06 | 初版 14 页，覆盖标签体系 → 评测 → Prompt 调优 → 同分布偏差 |
