# 架构说明

Crossword Studio 如何组织。这是纯客户端静态应用——没有后端、没有构建
管线——所以「架构」指模块职责、模块间数据流与核心算法。命令与目录见
[开发指南](./development.md)。

## 高层视图

```
                     ┌────────────────────────────────────────────┐
                     │                  index.html                │
                     │         纯标记，文案全部走 data-i18n         │
                     └───────────────────┬────────────────────────┘
                                         │ 启动
                     ┌───────────────────▼────────────────────────┐
                     │                  app.js                    │
                     │    视图 · 工具栏 · 编辑抽屉 · 弹窗 · 模式     │
                     └──┬─────────┬─────────┬─────────┬───────────┘
        词表或文章 ──┐    │         │         │         │
                    ▼    ▼         ▼         ▼         ▼
              extract.js  generator.js  ai.js   print.js   codec.js
              （本地      （纯逻辑、     （fetch、 （A4 DOM） （哈希⇄
                NLP）       带种子）      可选）              拼图）
                  └──────┴────┬──────┴────────┼──────────┘
                              ▼               ▼
                          solve.js        storage.js
                          （棋盘 UI）  （localStorage，5 个键）
```

脚本为经典写法（非 ES 模块）；`index.html` 先加载纯逻辑
（`generator`、`extract`），再加载功能模块（`storage`、`codec`、
`ai`、`i18n`、`solve`、`print`、`donation`），最后 `app.js`。一切都挂
在唯一的全局命名空间 `CW` 上。

## 模块职责

| 文件 | 职责 | DOM？ | Node 可运行？ |
| --- | --- | --- | --- |
| `js/generator.js` | 放置引擎、编号、带种子的随机数（`CW.Generator`） | 否 | 是 |
| `js/extract.js` | 分词、停用词、复数归并、专有名词、评分、挖空（`CW.Extract`） | 否 | 是 |
| `js/codec.js` | 拼图 ⇄ `#p=` 哈希：JSON → gzip → base64url（`CW.Codec`） | 否 | 否（需 `CompressionStream`） |
| `js/storage.js` | 唯一接触 localStorage 的代码——5 个键（`CW.Store`） | localStorage | 否 |
| `js/ai.js` | 对接 OpenAI 兼容接口的可选线索撰写（`CW.AI`） | fetch | 否 |
| `js/i18n.js` | 中英字典、语言检测、`data-i18n` 应用器（`CW.t`） | 是 | 否 |
| `js/solve.js` | 棋盘交互：选择、输入、检查/揭示、计时（`CW.Solve`） | 是 | 否 |
| `js/print.js` | 预览与打印共用的 A4 页面构建器（`CW.Print`） | 是 | 否 |
| `js/donation.js` | 页脚 ☕ → 弹窗 → 支付宝/微信切换 → 实时 canvas 二维码（`CW.Donation`） | 是 | 否 |
| `js/app.js` | 编排：视图、工具栏、编辑抽屉、弹窗、toast、模式 | 是 | 否 |

纯逻辑模块以**错误码**（`issue.*`、`reason.*`）报告问题，由 UI 经 i18n
翻译。这正是算法测试套件能零 mock 跑在 Node 里的原因。

## 数据流

```
词表 ─────┐
          ├─► Extract（本地，文章模式）─► 候选词 ─► AI / 挖空 ─► 线索
文章 ─────┘                                                  │
                                                             ▼
        Generator（N 轮随机尝试 · 放置规则 · 编号）──────► layout
                                                             │
        ├─► 作答界面（输入 / 检查 / 揭示 / 计时 ⇄ localStorage 进度）
        ├─► 打印构建器（A4 预览 = 真实打印 DOM · 标题/日期覆盖）
        └─► URL 编解码（gzip + base64url ⇄ #p=… 分享链接）
```

**layout（布局）** 是中心数据结构：网格尺寸、答案网格、带编号的条目
（行、列、方向、答案、线索）以及带原因码的未放置词。下游的一切——
作答、打印、进度键控、分享——都消费这一种形状。

## 放置引擎

`js/generator.js`，暴露为 `CW.Generator`，主入口 `buildLayout`：

1. **稀疏网格** —— 以 `"r,c"` 为键的 `Map`，允许布局生长期间坐标为
   负，包围盒最后推导。
2. **规则校验** —— 每个候选放置都按经典填字规则校验：交叉字母必须
   一致、禁止并行重叠、禁止拼出意外单词的相邻字母串。
3. **评分** —— 合法放置按 `交叉数×权重 − 包围盒增长 − 长宽拉伸 +
   抖动` 评分，最优者先放置。
4. **多轮重试** —— 失败的词在后续轮次重试，因为后续放置可能解锁此前
   的失败。
5. **择优** —— 运行多次带种子的尝试，按 放置数 → 交叉数 → 紧凑度 →
   方正度 选出赢家。
6. **编号** —— 对最终网格应用标准填字编号。

难度预设调整密度与网格上限（简单紧凑、困难开阔；`tooLongGrid` 这个
未放置原因对应的正是该上限）。

## 分享链接编解码

`js/codec.js`。负载（`{v:1, title, difficulty,
entries[[row, col, dir, answer, clue]…], unplaced[[answer, clue]…]}`）
经 JSON 序列化、`CompressionStream` gzip、base64url 编码，前缀 `G`；
没有 `CompressionStream` 时回落普通 base64url，前缀 `R`。载入时哈希
会经生成器同一个 `buildLayout` 校验引擎回放，损坏或被改动的链接明确
报错，而不是渲染坏盘。详见[分享链接](./features/share-links.md)。

## 进度键控

进度以「布局 + 答案」的哈希为键存储（`cw-progress:<id>`）。结果：
改线索或标题不会清空作答记录，重新生成的布局自然全新开始。应用可能
写入的 5 个键见 `js/storage.js`。

## 语言切换

`js/i18n.js` 持有中英字典。静态标记携带 `data-i18n` /
`data-i18n-placeholder` / `data-i18n-title` 键；动态字符串走
`CW.t(key, params)`。切换是一次遍历：重套所有静态文案并重建动态视图
（线索列表、棋盘无障碍标签、编辑抽屉），同时保留进度与运行中的计时器。

## 打印管线

`js/print.js` 以真实 DOM 构建 A4 页面（纯黑白，格子尺寸由网格维度以
毫米计算）。**同一份** DOM 在打印弹窗内缩放展示，打印时移入
`#printRoot`——预览所见即打印所得。

## 测试策略

因为核心是纯逻辑，两个算法套件无需浏览器即可在 Node 运行。第三个
套件（`test/dom-test.js`）在 jsdom 中启动真实 `index.html`，端到端
驱动两种输入模式——生成、作答、编辑、打印、分享、语言切换、持久化与
赞赏弹窗。合计：5,527 + 29 + 99 = 5,655 项断言，v1.2.0 全绿。
