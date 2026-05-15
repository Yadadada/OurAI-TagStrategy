# 模块 B — 问卷与用户画像

## 写在前面

下面写的"必做、进阶、自由发挥"是起点，不是终点。做的过程里若发现一个更值得做的方向、想对某个默认设定提出疑问、想把题目重新理解一遍——按自己的判断走，把理由写下来。


## 题目

题目是给社区里这一份结构化问卷设计并实现一条评分管线。用户答完 24 道题（Likert 量表、几道选项题、一段自由文本），输出一张人格卡片：MBTI 四个字母、一组 11 维特征向量、一份兴趣标签词云，最后在 Web 端渲染。这张卡片是社区里很核心的一块，社交推荐、首页 feed、群组撮合都依赖它。

baseline 已经放在 `vendored/` 下了，走的是 ECBTI 这条路：18 道 Likert 加 profile 推出 15 维向量，每一维量化成 L、M、H 三档，再用 L1 距离去匹配 30 类的预设类型库。算法本身不是最先进的，直接拿 1-7 的原始数值进匹配未必更差，但当时做量化是为了 30 类型的查找效率与可解释性。是否推翻这个设计，自由发挥那一节正合适。一个硬性请求是契约测试要继续过——这样即使把算法改得很激进，仓库还能随时换回 baseline，回流补丁也才生成得出来。

## 快速开始

```bash
# 一次性
npm install
npm run fixtures:gen          # 等价于 npm --prefix ../shared-fixtures run generate:small

# 同时起 Vite (5173) 与 Express (3010)
npm run dev

# 或者分开起
npm run dev:web               # 只启 Vite
npm run dev:api               # 只启 Express

# 测试与构建
npm run test:contract         # 契约测试，要全绿
npm run test
npm run build
```

打开 <http://localhost:5173>，左上角挑一个 fixture 用户，把画像可视化、问卷流程、人格卡片三个 tab 各点一遍。如果三处都能看到东西，环境就算齐了。

## 代码结构

```
                   ┌────────────────────────┐
                   │ shared-fixtures        │  500 用户、portraits、24 题问卷
                   │ data/*.json            │
                   └──────────┬─────────────┘
                              │
                     ┌────────┴─────────┐
                     │                  │
              Express :3010        Vite React :5173
              src/server/index.ts   src/App.tsx
                     │                  │
                     ▼                  │
              src/personaCard.ts        │  ← ECBTI 算法核心
             (buildUserVector,          │
              buildConsolidatedScores)  │
                                        ▼
                                src/components/
                                  ├── PersonaCardView.tsx    Tailwind 人格卡 UI
                                  ├── MbtiRadar.tsx          4 轴 ECharts 雷达
                                  ├── TraitsRadar.tsx        11 轴 ECharts 雷达
                                  ├── InterestCloud.tsx      兴趣词云
                                  └── QuestionnaireFlow.tsx  24 题问卷流程
```

算法都在 `src/personaCard.ts` 里——`buildUserVector` 把答题转成向量，`buildConsolidatedScores` 折出可视化用的几个综合分，`rankAllStandardTypes` 匹配 30 类型库，`detectHiddenTrigger` 是隐藏人格的触发逻辑。这几个名字记一下，后面会反复用到。

UI 部分，`PersonaCardView.tsx` 有 full、compact、inline 三个 variant，结构上请保持 `PersonaCardPayload` 兼容，否则其它模块拿不到正确字段。`MbtiRadar.tsx` 用四个 0-100 的分数画 4 轴雷达，`TraitsRadar.tsx` 是 11 轴的那张，`InterestCloud.tsx` 现在使用 graph force layout 模拟出的伪词云，`QuestionnaireFlow.tsx` 是 24 题问卷主体，其中 `buildDefaultAnswers` 必须能给出 24 个 key——契约测试在校验这一点。

后端在 `src/server/index.ts`，读 shared-fixtures，对外暴露 `/api/portrait/*` 这一组路由，后续要往里加。

有一些地方请不要动：`contracts/` 是契约测试，它们保证实现还能换回上游；`vendored/*.original` 是基线对照，回流补丁靠它生成；`src/stubs/*` 是接口对齐用的桩；`src/services/datingService.ts` 与 `src/lib/utils.ts` 是兼容层；`shared-fixtures/` 是几个模块共用的数据源，本模块里别动它。

## 必做

### B1

把脚手架在自己机器上跑起来。`npm install` 装好依赖，`npm run fixtures:gen` 生成数据，`npm run dev` 同时起 Vite 与 Express，浏览器打开 <http://localhost:5173>，三个 tab 各点一遍。最后跑 `npm run test:contract` 确认全绿、`npm run build` 没有 TS 错误。三个 tab 各截一张图就算过。

### B2

读懂 vendored 那一份 `personaCard.ts`，在仓库根开一份笔记，用自己的话说三件事——

第一，`buildUserVector` 的 15 个维度，分别是怎么从 18 道 Likert 题加 profile 里推出来的。哪几道题打到哪一维，反向计分（比如 `(8-q04) + (8-q08)` 这种）有没有道理。

第二，为什么要把分数量化成 L、M、H 三档而不是直接拿 1-7 的数值参与匹配。这件事得失各是什么。

第三——这条最重要——ECBTI 这套读下来至少能指出哪两处值得怀疑。可以是算法层面的（量化损失、距离度量选择），也可以是问卷层面的（题目覆盖、社会期望偏差）。前提是基于实际阅读得出的判断。

笔记不少于 600 字。

### B3

`src/components/MbtiRadar.tsx` 这块是入口最低的练手，谁都能画一个 4 轴雷达出来——但能不能让用户一眼看明白为什么是这个类型，差别就在这。先把现在的版本看明白，再做至少一项有意义的改动：加一条人群均值的对比线、画一圈置信度、让 4 个字母按强度依次点亮，或者自己想到的别的角度都行。

挑 5 个类型差异比较大的用户分别截图，在 LEARNINGS.md 里把改进前后并排放，配 50 字左右说明这么改的原因。

### B4

让从提交问卷到拿到画像这条链路真的连起来。`QuestionnaireFlow` 提交后调 `POST /api/portrait/build-card`，拿回 vector 与 consolidatedScores。前端把 6 个 consolidatedScores 用条形图画出来，请自行实现，不要直接复用 vendored 的 `DimensionGrid`——直接复用学不到什么。再把人格 code 显示在页面上（提示：在 server 端加一个路由跑 `rankAllStandardTypes`）。整条链路打通的同时，契约测试保持全绿。

联调过程里大概会反复在数据格式、错误处理、UI 取舍这几件事上做权衡。把至少 2 次值得记录的对比写进 EXPERIMENTS.md 或 LEARNINGS.md——不是流水账，是形如"本来想 X、后来改成 Y、原因是 Z"这种粒度。

交一段录屏，从空问卷开始，提交后能看到自己的人格代号。

### B5

实现 `POST /api/portrait/build` 这个 REST 端点，body 收 `{ answers, profile }`，返回 `PersonaCardPayload`。命名上提醒一句：URL 是名词（资源），HTTP 方法才是动词（操作）。`POST /api/portrait/build` 是对的，`GET /api/buildPortrait` 是错的。

再写一个 vitest 测试：构造一组 answers 与 profile，断言返回的 payload 含 `vector`、`consolidatedScores`、`mbti` 这些关键字段。最后命令行 curl 一次，把请求体与响应体一起贴到 LEARNINGS.md 里。测试通过、附一张 curl 截图，这一条就过了。

## 进阶

下面这五条做几条算几条，不要求全做。挑自己最好奇的那条。

**设计新的问卷维度。** 现有 24 题躺在 `shared-fixtures/src/questionnaire.ts` 里，那个文件不要动。自行新建一个 `src/questionnaire-extension.ts`，加 2-3 道新题——依恋类型（参考 Bartholomew & Horowitz 1991 的四象限）、冲突回避、原生家庭等等，方向自行挑选。把新题接进 `QuestionnaireFlow`，再想清楚它们要怎么参与 personaCard 的 15 维（或者干脆新增一两个维度）。在仓库根的笔记里写清楚为什么这几个维度对这个社区有信息量，配一张在 fixture 用户上跑出来的新维度分布图。

**兴趣词云的产品级打磨。** 把 `InterestCloud.tsx` 从 echarts graph force layout 升级成真正的 wordcloud 布局，echarts-wordcloud 插件可以直接用。再往上加点交互——分类筛选、hover 高亮、点击进入同好用户列表。录屏配截图。

**服务端人格卡片 API。** 在 `src/server/index.ts` 加 `POST /api/portrait/persona-card`，body 收 `{ userId }`，走完 `personaCard.generatePersonaCardForUser`。本模块的 DB 是 stub，缓存路径会落空；LLM 也是 stub，会走 preset 兜底文案——这两件都是预期行为，不用去改桩。配一个 vitest 覆盖这条路由。

**问卷 A、B 文案对比。** 挑 1-2 道关键题（建议从 q07、q08 这两道依恋题里选，参考 Mickelson et al. 1997 的几种典型表述方式），同一意思写两套措辞。前端做一个简单的 50、50 分流，localStorage 记住用户被分到哪一版。然后写脚本，在 fixture 用户上跑 50 次以上的模拟答题，加点合理扰动，看看两套措辞最后推出来的人格类型稳不稳。不要求结果一定显著——没显著很正常，关键是把没显著的原因想清楚，把下一步假设写下来。交实验脚本配 200 字结论。

**画像页设计走查。** 在 `decisions/` 下写一份 PersonaCard 的 UI spec，覆盖视觉、交互、状态三块。然后照着 spec 回头看 `PersonaCardView`，列出当下与 spec 不一致的 3 处，挑其中 1 处修掉。before、after 对比截图配 200 字说明。

## 自由发挥

不限范围，几个方向供参考：

- 把 500 用户的 11 维特征做 UMAP 或 t-SNE 投影，按 MBTI 上色，看类型在低维空间是否可分。
- 模拟同一用户多次答题，观察画像随时间漂移的轨迹。
- 给定 user A，从 fixtures 里挑出和这个人最像的 3 个，并解释相似性来自哪些维度（推荐系统的可解释性，做得好能接到首页 feed）。
- 现有 `detectHiddenTrigger` 用 2+ 关键词当阈值，用真实关键词分布检验是过松还是过紧。
- 给所有 ECharts 图补键盘导航与 ARIA 标签。可访问性受益面比一般人想象的大。

只有一条要求：把做了什么、为什么这件事值得做写清楚，并且有能重跑的脚本——不能只有一句"手动跑了一遍"就完事。

## 评分维度

没有死板的分数表。粗略来说看这五件事：

- **能跑、能演示、契约绿。** 端到端跑通：从问卷到画像，再到渲染。
- **代码读着像那么回事。** 算法层与组件层解耦、类型完整、错误处理合理。
- **过程看得出思考。** AI 怎么用的、为什么选这个量化方式、踩过什么坑、改过什么决定。
- **有自己的想法。** 这条最关键。把用户画像重新理解一遍、加一个原本不在题目里的维度（依恋、冲突回避等）、做一种没出现过的可视化、对 ECBTI 的某个判定提出有理由的怀疑——都可以拿到高分。
- **诚实记录。** 跑不动、走错路、数字不好看都没关系——前提是把假设、做法、观察、下一步写下来。

跑出漂亮的画像不是硬门槛。重点是别人看到这张卡片能复述出这个类型从何而来。

不要把这份 README 当 checklist。如果有更好的方向，跟自己的判断走，把理由写下来。

## 提交物

代码当然要交——`src/`、`tests/`、`scripts/`，契约测试得通过。除此之外：

- `README.md` 写清楚做了什么、怎么跑，附一张自己画的架构图（不是把上面那张抄一遍）
- `ai-conversations/` 留一些跟 AI 的关键讨论痕迹，不需要全部，挑自己觉得对决策有影响的那几段
- `decisions/` 写几条 ADR，背景、决策、理由、后果四件事说清楚
- `LEARNINGS.md` 踩坑笔记与迭代日志
- `EXPERIMENTS.md` scorer、文案、维度这些迭代的对比
- `SELF-EVAL.md` 对照上面五条（能跑、代码、过程、想法、诚实记录）给自己写一份自评，每条说一两句自己怎么看


## 提交方式

拿到的压缩包解压后，整个目录就是本组的代码库。

操作流程大致这样：组里推一个人当主仓库 owner，在 GitHub（或 Gitee）开一个新仓库，把目录作为初始 commit 推上去；其他成员加成 collaborator 或 fork 后 PR，按 branch 加 pull request 协作；code review 自行安排，重要决策记进 `decisions/` 下的 ADR。最终交付时把仓库链接（含访问权限）发到群里。

如果做完之后想把改动整理成一份回流补丁，看 `scripts/make-merge-back-patch.sh`，会把核心改动打成 patch，方便 reviewer 直接 `git apply`。不强求。

## 数据

`../shared-fixtures` 里，别在本模块改它：

- `../shared-fixtures/data/users.json` 是 500 个用户与完整问卷答案
- `../shared-fixtures/data/portraits.json` 是对应的 MBTI、11 维特征、兴趣标签
- 字段分布在 `../DATA-DISTRIBUTION.md`

## 参考实现

`./sample/` 下放了一份参考实现，必做全做、进阶做了三条（依恋子量表、词云升级、LLM 人格叙事），契约测试 9/9 全绿。这只是一条可行路径，不是标准答案——尤其不要把它当成 ceiling。更想看到的是有同学去打破 ECBTI 的某个默认设定，做出 sample 里没有的东西。

最后两句实操提醒：PersonaCardView 用 Tailwind 写的，但 `index.html` 里已经用 Tailwind Play CDN 加载好了，本地不用单独装；`personaCard.ts` 里那个 `personaCardRouter` 在本模块跑不通完整流程（DB 是 stub 会抛 missing relation），但导出的算法函数比如 `buildUserVector`、`buildConsolidatedScores` 是能跑的，B2 看代码就靠这个。`src/personaCard.ts` 本身可以改，但改完记得跑一遍契约测试。要接 LLM 直连就在 `.env` 里把 provider key 配好，vendored 的代码会自己走对应链路。
