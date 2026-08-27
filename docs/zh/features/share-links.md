# 分享链接

## Summary

整套拼图——标题、难度、每条带线索的条目、以及未放置词——压缩进
URL 哈希（`#p=…`），一条链接就是整个拼图，无需任何服务器。

## Background

拼图是结构化且紧凑的对象，但把网格贴进聊天会丢掉交互性；把拼图托管
在服务器上则需要账号、存储与审核。URL 是唯一一种所有渠道（聊天、
邮件、LMS、印刷二维码）都天然携带的格式。

## Problem

项目需要的分享方式要：(a) 零基础设施；(b) 在 URL 能到达的任何渠道
存活；(c) 负载损坏时绝不静默渲染坏盘；(d) URL 尽量短——30+ 条目加
长线索的拼图仍有几 KB 的 JSON。

## Goals

- 一条链接 = 一套拼图；打开即恢复为完整可玩的拼图。
- 压缩：平台支持时用 gzip。
- 构造上 URL 安全（base64url，无保留字符）。
- 防篡改：损坏或手改的链接带清晰报错地失败，而不是渲染坏盘。
- 在没有 `CompressionStream` 的引擎上优雅降级。

## Non-Goals

- 短链接、拼图 ID 或跳转服务（那需要服务器）。
- 把作答进度存进链接——进度在各自浏览器本地
  （[使用指南](../usage.md#作答拼图)）。
- 对负载签名或加密——哈希不是安全边界；校验为了发现损坏，不是为了
  保密（答案本来就在负载里）。
- 一条链接多套拼图。

## Solution Overview

`js/codec.js` 暴露 `CW.Codec`：

1. **负载** —— 最小 JSON 结构，带版本（`v: 1`）：
   `{t: 标题, d: 难度, e: [[行, 列, "a"|"d", 答案, 线索]…],
   u: [[答案, 线索]…]}`。
2. **编码** —— JSON → UTF-8 → gzip（`CompressionStream`）→
   base64url，前缀 `G`；无 `CompressionStream` 时用普通 base64url，
   前缀 `R`。
3. **解码** —— 标记决定 gzip 或普通；JSON 解析错误与版本/结构不符
   抛出可读错误（"Not a valid puzzle link"、"Corrupted puzzle
   data"）。
4. **校验** —— 解码出的拼图经生成器同一个 `buildLayout` 校验引擎
   回放；只有一致的拼图才能上屏。

## Detailed Behavior

- 每次生成与编辑后，应用把 URL 哈希保持同步（异步、gzip 之后）；
  **分享**显示当前 URL，或在有系统分享面板时交给 `navigator.share`。
- 打开链接时应用直接进入作答视图。
- 未放置词随负载一起走，接收方看到同一份如实的失败清单。
- 编辑线索/标题会改变哈希；旧链接继续有效（只是旧布局）。

## User Experience

作答 → **分享** → 发送。手机上弹出系统分享面板；桌面是带可复制
URL 的弹窗。接收者点开即玩——无需账号、无需安装，发送者事后可删掉
自己的本地副本。

## Compatibility and Historical Impact

- 依赖渠道保留完整 URL 哈希（部分聊天应用会截断长 URL——见
  [故障排查](../troubleshooting.md)）。
- 负载版本字段（`v: 1`）的存在使未来格式变更能被识别并以清晰报错
  拒绝，而不是解码出错误结果。
- 不影响任何历史行为。

## Data and Privacy Impact

- 负载包含拼图与**全部答案**——只分享给可以看到答案的人（或打印时
  不带答案页）。
- 链接经由承载它的服务（聊天、邮件）传输；那部分不受应用控制。
- 不新增存储与网络：编码是纯计算，打开链接除加载页面本身外不发任何
  请求。

## Performance Impact

gzip + base64url 把典型拼图链接控制在几百到几千字符；编解码毫秒级。
条目多、线索长的拼图链接更长——无服务器分享的固有代价。

## Current Limitations

- 链接长度受渠道而非应用限制。
- 无法吊销或过期已分享的拼图——拿到链接的人永远可用。
- 答案对有心人可见（就在 URL 里）。

## Release Information

- Introduced: v1.2.0
- Status: Stable

## Related Documentation

- [使用指南——分享拼图](../usage.md#分享拼图)
- [架构说明——分享链接编解码](../architecture.md#分享链接编解码)
- [生成引擎](./generation-engine.md)（`buildLayout` 校验）

## Feature Changelog

### v1.2.0

- 首发：带版本的 JSON 负载、经 `CompressionStream` 的 gzip 与普通
  base64url 回落、`buildLayout` 回放校验、原生分享集成。
  `test/dom-test.js` 覆盖往返（分享 → 新窗口还原）。
