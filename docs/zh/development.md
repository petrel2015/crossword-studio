# 开发指南

参与开发 Crossword Studio 所需的一切。只收录已验证的命令——以下每条
命令都在本仓库 v1.2.0 上真实执行过。

## 环境要求

- **Node.js**（含 npm）——仅开发依赖与测试套件需要。现代 Node 版本
  均可；项目本身没有构建步骤，`package.json` 也没有 `engines` 限制。
- **浏览器**——应用就是纯 HTML/CSS/JS，没有任何构建步骤。
- **Python 3**（可选）——仅用于示例中的一行静态服务命令；任意静态
  服务器都可以。

## 命令

| 命令 | 作用 | 状态 |
| --- | --- | --- |
| `npm install` | 只装开发依赖（`jsdom` 用于 DOM 测试，`qrcode` 用于二维码脚本） | 已验证：成功，0 漏洞 |
| `npm test` | 依次运行全部三个测试套件 | 已验证：5,655 项断言，0 失败 |
| `node test/gen-test.js` | 仅填字算法不变量 | 已验证：5,527 通过 |
| `node test/extract-test.js` | 仅文章提取不变量 | 已验证：29 通过 |
| `node test/dom-test.js` | 仅 jsdom 全应用端到端 | 已验证：99 通过 |
| `python3 -m http.server 8741` | 在 <http://localhost:8741/> 伺服应用 | 已验证：HTTP 200 |

**没有构建命令**、**没有 lint 配置**、**没有 CI workflow**。仓库根
目录就是可部署产物。改完文件刷新浏览器即可。

## 测试——每个套件到底测什么

### `test/gen-test.js` —— 放置引擎（5,527 项断言）

`js/generator.js` 的纯逻辑不变量，因其无 DOM 依赖而可在 Node 运行：
交叉字母一致、无并行重叠、无意外相邻串词、Across/Down 编号符合标准、
同种子确定性、布局评分选出紧凑方正的网格，以及压力测试——随机子集与
全量词表的多次生成均不违反规则。

### `test/extract-test.js` —— 文章提取（29 项断言）

`js/extract.js` 的不变量：停用词过滤、复数归并、专有名词识别、按词频
与位置评分排序，以及挖空替换（整词、忽略大小写、长句围绕空格窗口化）。

### `test/dom-test.js` —— 端到端（99 项断言）

在 jsdom 里启动真实 `index.html` 并像用户一样驱动它：构建页解析与
问题报告、语言切换、两种模式生成、输入、检查/提示/揭示、语言切换后的
进度持久化、线索编辑、打印标题/日期覆盖与答案页、分享弹窗、重新生成
确认、URL 还原、文章流程（提取 → 选词 → 挖空）、以及按统一规范实现的
赞赏弹窗。

已知噪音：jsdom 会打印若干
`Not implemented: HTMLCanvasElement.getContext()` 警告，因为赞赏二维码
画在 canvas 上。它们是警告不是失败，断言照常通过。

## Lint 现状

仓库没有 lint 脚本，也没有 lint 配置。`vendor/qrcode.min.js` 是第三方
压缩文件；如果你要引入 linter，请排除该路径。

## 目录结构

```
index.html            纯标记；静态文案带 data-i18n 键
css/style.css         瑞士报纸风设计系统 + A4 打印规则
js/
├── generator.js      ★ 填字算法——纯逻辑、无 DOM、可在 Node 运行。
│                       错误以错误码表示（issue.* / reason.*），由 UI 翻译。
├── extract.js        ★ 文章 → 候选词 + 挖空句——纯逻辑、可在 Node 运行：
│                       分词、停用词、复数归并、专有名词识别、评分、
│                       带词边界的挖空替换。
├── i18n.js           中英字典、语言检测、data-i18n 应用器
├── codec.js          拼图 ⇄ URL 哈希（gzip + base64url，CompressionStream）
├── storage.js        localStorage：进度 / 草稿 / AI 设置
├── ai.js             可选的线索撰写——词典式或文章式
│                       （文章截断、每批 20 词、进度回调）
├── solve.js          交互棋盘：选择、输入、检查/揭示、计时
├── print.js          A4 页面构建器（屏幕预览 = 真实打印输出）
├── donation.js       页脚 ☕ 入口 → 弹窗 → 支付宝/微信切换 → 实时二维码
└── app.js            编排：视图、工具栏、编辑抽屉、弹窗、输入模式
test/
├── gen-test.js       算法不变量 —— 5,527 项断言
├── extract-test.js   提取不变量 —— 29 项断言
└── dom-test.js       jsdom 全应用端到端 —— 99 项断言
scripts/
└── generate-donate-qr.js  开发工具，用于生成 README 的静态二维码 PNG
vendor/
└── qrcode.min.js     内置二维码库，仅由 donation.js 懒加载
img/donate/           仅 README 使用的静态二维码呈现
docs/                 本文档体系（中英双语）与截图（docs/img/）
```

模块职责与数据流：[架构说明](./architecture.md)。

## 本地开发注意事项

- 没有环境变量、没有 `.env`、没有特性开关。所有配置都在用户浏览器里
  （AI 设置）——开发期无需配置任何东西。
- 脚本为经典写法（非 ES 模块）；`index.html` 的加载顺序有讲究：
  `generator`、`extract` 先行（纯逻辑），随后是各功能模块，`app.js`
  最后作为编排者。
- 本地验证「生产」部署形态：伺服仓库根目录，走一遍核心流程——生成 →
  作答 → 打印预览 → 分享链接 → 新标签页打开链接。
  [部署指南](./deployment.md)讲托管场景。
- `scripts/generate-donate-qr.js` 是一次性的开发工具（生成了 README 用
  的 `img/donate/*.png`）；应用本身始终在运行时实时生成二维码。

## 添加许可证

仓库目前**没有 LICENSE 文件**。如需添加：

1. 选定许可证（此类工具常用 MIT 或 Apache-2.0）——这是维护者的决定，
   不是贡献者的。
2. 将许可证文本放在仓库根目录 `LICENSE`。
3. 在 `README.md`（License Notes）、`README.zh.md`（许可证说明）与
   `README_FOR_AI.md`（Project Identity → License）中同步提及。
4. 建议同时打首个 Git Tag 并发布 GitHub Release，让版本徽章变为动态。
