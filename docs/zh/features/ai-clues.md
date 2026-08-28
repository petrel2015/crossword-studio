# AI 线索撰写

## Summary

AI 线索撰写默认接入内置 PromptGate 网关，开箱即用；也可切换为任意
OpenAI 兼容接口：词表模式写词典式线索，文章模式写文章式线索，风格随
难度调整，失败时优雅降级、绝不自动重试。

## Background

对非高手来说，好线索是拼图里最难的部分。空线索很诚实，但要求用户
每条都自己写。v1.2 的方案是让用户自带 LLM 接口，但配置门槛（找
Base URL、申请密钥）挡住了大多数人。项目所有者部署了 PromptGate
网关（OpenAI 兼容、服务端钉死模型与限额、公开调用方标识），让线索
撰写默认可用，同时保留自带接口作为覆盖项。

## Problem

项目需要的线索撰写要：(a) 前端纯静态、无自建后端可维护负担；
(b) 除任务所需的最小内容外什么都不发；(c) 优雅降级——AI 完全不可用时
应用必须依然完整可用；(d) 产出风格一致、报纸味的线索，且绝不泄露
答案词；(e) 适配网关的硬限额——全部消息内容 ≤ 2,000 字符、单次输出
≤ 200 token、20 次/分钟/IP、每日请求与 token 熔断。

## Goals

- 内置网关为默认 provider：零配置开箱即用；网关地址与调用方标识集中
  在 `js/promptgate.js`，便于轮换。
- 覆盖项：任意 OpenAI 兼容接口（OpenAI、DeepSeek、火山方舟、本地
  Ollama……）；用户填 Base URL、密钥与模型。
- 词表模式：只补写仍为空的线索。
- 文章模式：锚定文章的线索——引用情节、角色与措辞，模仿其语气。
- 限额自适应分批：内置服务每批 6 词（输出 200 token 上限 ÷ 每条约
  30 token）、文章按剩余预算窗口化（约前 60% + 后 40%）；自定义接口
  沿用每批 20 词与 12,000 字符节选。
- 限速节流：内置服务顺序批次间强制 ≥ 3.2 秒间隔，稳定低于 20 次/分钟。
- 线索风格随难度（简单=平实友好；中等=报纸风带轻巧文字游戏；困难=
  误导与双关）。
- 护栏：绝不在线索里出现答案（或其直接词干）；线索单行、有词数上限；
  宽容解析模型输出（剥离 markdown 围栏、截取 JSON 主体）。

## Non-Goals

- 不内置或代理"任意模型"——内置网关只有固定的 crossword 人设与限额，
  换模型请走自定义接口。
- 不在前端发送 `role: "system"` 消息（网关会剥离，白白占用字符配额），
  指令一律折进 user 消息。
- 不做自动重试/指数退避——网关对进入管线的每次请求都计限额与额度，
  失败只提示用户，由用户决定何时重试。
- 用 AI 生成拼图、单词或提取——生成保持本地且确定
  （[生成引擎](./generation-engine.md)）。
- 模型选型指导、质量评分，或护栏之外的线索文本答案校验。
- 离线线索生成（那是[挖空](./article-extraction-cloze.md)的职责）。

## Solution Overview

`js/promptgate.js` 集中定义 `BASE_URL` / `API_KEY`（公开调用方标识，
服务端钉死模型、提示词、输出上限与限额，泄露无风险）与模型别名。
`js/ai.js` 暴露 `CW.AI`：

- `resolveConfig(shape)` —— 把存储形状（`{provider, baseUrl, model,
  apiKey}`，旧格式自动视为 custom）解析为完整 provider profile；
  builtin：批 6 词、输入上限 2,000−100 字符、批间 3.2s、严格请求体
  （只发 `model` + `messages`）；custom：批 20 词、14,000 字符上限、
  附加 `temperature` 与 `response_format`。
- `fillClues(words, difficulty)` / `cluesFromArticle(article, words,
  difficulty, onProgress)` —— 统一 `runBatches` 顺序分批；单批失败被
  收集，部分成功保留；整轮全失败才抛错。
- `request(cfg, content, timeoutMs)` —— POST `<baseUrl>/chat/completions`，
  Bearer 鉴权、非流式；AbortController 兜底超时（对话 125s ≥ 网关上游
  120s；ping 20s）；错误规范化为 `kind`（`unavailable` / `unreachable`
  / `daily` / `rate` / `upstream` / `badrequest` / `badresponse` /
  `timeout` / `http`），网络失败按 `err.name === 'TypeError'` 判定
  （跨 realm 安全）。
- `friendlyError(err)` —— 按 `kind` 映射为界面语言的提示（内置服务
  不可达/鉴权失败 →「当前 AI 设置不可用，请检查配置」；每日额度 →
  「明天再试」；限流 →「约一分钟后再试」；上游 →「稍后重试」）。
- `ping(cfg)` —— 设置弹窗「测试连接」用的一次真实请求。

## Detailed Behavior

- 设置存入 localStorage `cw-ai`：`{provider: 'builtin'}` 或
  `{provider: 'custom', baseUrl, apiKey, model}`；v1.2 的旧格式（只有
  baseUrl 等）自动视为 custom，老用户配置不丢。
- 内置服务视为始终已配置；custom 需 baseUrl + model。
- 词表模式 AI 失败 → toast 提示后继续生成（空线索可编辑）；文章模式
  「自动」风格 AI 整体失败 → 全部回落挖空；「AI 文章式」失败 → 空线索
  可编辑。
- 请求的答案统一为大写后匹配；模型为未请求单词返回的线索一律丢弃；
  解析容忍围栏与前后缀文本。
- 文章窗口：预算 = 输入上限 − 指令 − 词表（预留 100 字符余量），
  截取前 60% + 后 40%，中间以 `[…]\n` 标记。

## User Experience

右上角 **AI 设置**：单选「内置 AI 服务（开箱即用）」/「自定义 OpenAI
兼容接口」，后者展开 Base URL / 模型 / 密钥；「测试连接」立即验证当前
选择并内联显示结果（成功 ✓ / 失败给出对应文案）。构建页状态行显示
「AI 线索：内置服务」或模型名。使用上仍是词表模式的一个勾选框、文章
模式的一个线索风格下拉 + 批次进度；结果落入线索输入框，每条可手工编辑。

## Compatibility and Historical Impact

- 不配置任何东西的全新用户：AI 从「不可用」变为「开箱即用」。
- v1.2 已配置自定义接口的用户：自动迁移为 custom provider，行为不变。
- AI 严格增量：AI 全挂时应用表现得就像这个功能不存在——空线索可
  编辑、离线挖空。

## Data and Privacy Impact

- 应用唯一的外呼：POST 到内置网关（默认）或自定义接口。
- 负载刻意最小：空线索的词，或文章窗口节选 + 选定词，折入单条 user
  消息；不再发送 system 消息。API 密钥（自定义）存于 localStorage
  （`cw-ai`），以 Bearer 头发送；内置网关凭据是随源码分发的公开标识。
- 其他一切（进度、别的拼图、历史）都不传输。完整审计：
  [隐私说明](../privacy.md)。

## Performance Impact

受网关与上游延迟制约；顺序批次（6 词/批）+ 3.2s 节流意味着 60 词的
文章集合约 10 次请求、最快约 40 秒，慢时更久——进度条如实显示。页面
加载不受影响（模块在被调用前完全被动）。

## Current Limitations

- 内置网关输出上限 200 token/次：批次必须小（6 词），长文章窗口被
  压缩到约 1,300 字符，窗口外的中段情节模型看不到。
- 每日熔断（2,000 次 / 100k token，网关本地午夜重置）是全局共享的，
  高峰期可能提前遇到「今日额度已用完」。
- 禁止浏览器 CORS 直连的自定义服务商在任何托管下都无法使用——
  服务商侧限制，toast 如实报告。
- 线索质量取决于模型；护栏能减少但不能根除偶发的答案泄露或别扭
  线索——每条线索都保持可编辑。

## Release Information

- Introduced: v1.2.0（用户自带接口）
- Built-in gateway default: Unreleased（即将随下一版本发布）
- Status: Stable

## Related Documentation

- [使用指南——AI 线索](../usage.md#ai-线索)
- [文章提取与挖空](./article-extraction-cloze.md)
- [隐私说明](../privacy.md)

## Feature Changelog

### Unreleased

- 默认接入 PromptGate 网关：零配置开箱即用；provider 单选 +
  「测试连接」；6 词小批与 2,000 字符输入预算自适应；限速节流；
  友好错误映射（含「当前 AI 设置不可用，请检查配置」）；对话请求
  125s / ping 20s 超时兜底；「自动」风格整体失败回落挖空；宽容 JSON
  解析（围栏剥离）。`test/dom-test.js` 以 fetch 桩端到端覆盖请求形状、
  分批、错误映射与回落。

### v1.2.0

- 首发：OpenAI 兼容客户端、词典式与文章式两种模式、随难度的提示词、
  JSON 模式解析、20 词分批带进度、感知 CORS 的错误提示。
  `test/dom-test.js` 端到端覆盖离线路径（未配置护栏与回落）。
