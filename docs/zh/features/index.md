# 功能设计文档

大功能的设计决策记录。每篇记录一个功能的问题、目标、非目标、行为与
演进；操作方法见[使用指南](../usage.md)。

> **版本说明。** 仓库还没有 Git Tag 与 GitHub Release（见
> [CHANGELOG](../../../CHANGELOG.zh.md)）。以下功能均随汇总条目
> **v1.2.0** 首次发布；只有该条目之后新增的功能才会标注更晚的版本。

| 功能 | 引入版本 | 状态 | 简介 |
| --- | --- | --- | --- |
| [生成引擎](./generation-engine.md) | v1.2.0 | Stable | 带种子的规则化填字布局，多轮尝试择优 |
| [文章提取与挖空](./article-extraction-cloze.md) | v1.2.0 | Stable | 本地把文章变成候选词排行 + 离线挖空线索 |
| [AI 线索撰写](./ai-clues.md) | v1.2.0 | Stable | 可选线索，对接任意 OpenAI 兼容接口 |
| [分享链接](./share-links.md) | v1.2.0 | Stable | 整套拼图装进 gzip 压缩的 URL 哈希 |
| [赞赏弹窗](./donation.md) | v1.2.0 | Stable | 页脚 ☕ → 支付宝/微信弹窗，浏览器实时生成二维码 |
