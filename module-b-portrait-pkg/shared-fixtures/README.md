# shared-fixtures

合成数据生成器，所有作业模块（A-F）共用。

## 数据规模

| 命令 | 用户 | 历史匹配 |
|---|---:|---:|
| `npm run generate:small` | 500 | 2000 |
| `npm run generate` | 5000 | 20000 |
| `npm run generate:large` | 10000 | 50000 |

同 seed 同结果，确定性 PRNG 采样，不映射任何真实用户。

## 输出

```
data/
  users.json        用户（profile 与 answers）
  portraits.json    画像（MBTI 4 轴、11 维 traits、interests）
  matches.json      历史匹配（baseline 打分与 ground-truth 反馈）
  holdout.json      留出 1000 个用户，仅用于评测
  meta.json         生成参数、seed、校验和
```

## 用法

```ts
import { generateUsers, getAvatarUrl, labelFor } from '@coursework/shared-fixtures';
import users from '@coursework/shared-fixtures/data/users.json';
import matches from '@coursework/shared-fixtures/data/matches.json';
// 24 题问卷常量从同包导出，详见 src/index.ts
```

## 改分布

`src/distributions.ts` 是真理来源。改了之后跑 `npm run generate` 重新生成。
