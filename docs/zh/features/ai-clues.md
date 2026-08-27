# AI 线索撰写

## Summary

可选的填字线索撰写，对接任意 OpenAI 兼容的 `/chat/completions` 接口：
词表模式写词典式线索，文章模式写文章式线索，风格随难度调整。

## Background

对非高手来说，好线索是拼图里最难的部分。空线索很诚实，但要求用户
每条都自己写。很多用户已经有 LLM 接口；自然的设计是让他们自带接口
与密钥，而不是内置一个（要花钱、又复杂化隐私的）代理。

## Problem

项目需要的线索撰写要：(a) 自身不需要任何服务器；(b) 除任务所需的
最小内容外什么都不发；(c) 优雅降级——完全没有 AI 时应用必须依然
完整可用；(d) 产出风格一致、报纸味的线索，且绝不泄露答案词。

## Goals

- 兼容任意 OpenAI 兼容接口（OpenAI、DeepSeek、火山方舟、本地
  Ollama……）；用户填 Base URL、密钥与模型。
- 词表模式：只补写仍为空的线索。
- 文章模式：锚定文章的线索——引用情节、角色与措辞，模仿其语气。
- 线索风格随难度（简单=平实友好；中等=报纸风带轻巧文字游戏；困难=
  误导与双关）。
- 分批执行带进度反馈；单批失败不拖垮其他批。
- 护栏：绝不在线索里出现答案（或其直接词干）；线索单行、有词数上限；
  严格 JSON 响应。

## Non-Goals

- 内置或代理任何服务商，或预置默认接口/密钥——永远由用户自己配置。
- 用 AI 生成拼图、单词或提取——生成保持本地且确定
  （[生成引擎](./generation-engine.md)）。
- 模型选型指导、质量评分，或护栏之外的线索文本答案校验。
- 离线线索生成（那是[挖空](./article-extraction-cloze.md)的职责）。

## Solution Overview

`js/ai.js` 暴露 `CW.AI`：

- `fillClues(words, difficulty)` —— 词表模式；只发送空线索的词，一行
  一个；期望严格 JSON `{"clues":{"WORD":"clue",…}}`。
- `cluesFromArticle(article, words, difficulty, onProgress)` —— 文章
  模式；发送（截断的）文章与每批单词；每批 20 词顺序执行，带进度
  回调；单批失败被收集而不是中断。
- `chatJSON` —— POST `<baseUrl>/chat/completions`，带
  `response_format: {type: "json_object"}`；传输/鉴权失败转为可读
  错误（HTTP 状态码、服务商报错、CORS 提示）。
- 文章节选上限 12,000 字符（前 9,000 + 后 3,000）。

## Detailed Behavior

- 设置（Base URL、密钥、模型）存入 localStorage `cw-ai`，只发给该
  接口。
- 「用 AI 补写缺失的线索」只在词表模式出现；文章模式由线索风格下拉
  决定。
- 请求的答案统一为大写后匹配；模型为未请求单词返回的线索一律丢弃。
- 未配置就选 **AI 文章式**会以 toast 阻止生成；**自动**则静默回落
  到挖空。
- 整轮全失败（所有批次）时报错；部分成功则保留部分结果。

## User Experience

经**AI 设置**（右上角）一次性配置：Base URL、密钥、模型，保存。之后
就是一个勾选框（「用 AI 补写缺失的线索」）或一个线索风格；文章模式下
有进度条显示批次完成。结果落入线索输入框，且每条都保持可手工编辑。

## Compatibility and Historical Impact

不影响任何历史行为。AI 严格增量：不配置时应用表现得就像这个功能
不存在——空线索可编辑、离线挖空。

## Data and Privacy Impact

- 增加了应用唯一的外呼请求：POST 到用户配置的接口。
- 负载刻意最小：空线索的词，或文章节选 + 选定词。API 密钥存于
  localStorage（`cw-ai`），以 Bearer 头发送。
- 其他一切（进度、别的拼图、历史）都不传输。完整审计：
  [隐私说明](../privacy.md)。

## Performance Impact

受服务商延迟制约；批次顺序执行，60 词的文章集合最多 3 次请求。页面
加载不受影响（模块在被调用前完全被动）。

## Current Limitations

- 禁止浏览器 CORS 直连的服务商在任何托管下都无法使用——服务商侧
  限制，toast 如实报告。
- 线索质量取决于模型；护栏能减少但不能根除偶发的答案泄露或别扭
  线索——每条线索都保持可编辑。
- 20 词批次与 12,000 字符上限为固定值；超长文章会被窗口化，窗口外
  的中段情节模型看不到。

## Release Information

- Introduced: v1.2.0
- Status: Stable

## Related Documentation

- [使用指南——AI 线索](../usage.md#ai-线索)
- [文章提取与挖空](./article-extraction-cloze.md)
- [隐私说明](../privacy.md)

## Feature Changelog

### v1.2.0

- 首发：OpenAI 兼容客户端、词典式与文章式两种模式、随难度的提示词、
  JSON 模式解析、20 词分批带进度、感知 CORS 的错误提示。
  `test/dom-test.js` 端到端覆盖离线路径（未配置护栏与回落）。
