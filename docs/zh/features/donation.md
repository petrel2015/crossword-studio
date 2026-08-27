# 赞赏弹窗

## Summary

页脚 ☕「请作者喝杯咖啡」入口：点开是支付宝 / 微信支付切换的弹窗，
支付二维码由浏览器实时生成——没有静态图片，也没有第三方二维码 API。

## Background

作者想要一个对中文支付 App（支付宝 / 微信）好使的赞赏入口。静态
二维码图片跨页面难维护、不能适配主题与屏幕；第三方二维码 Web 服务
会给这个本来零网络的应用增加网络依赖和追踪面。

## Problem

项目需要的赞赏入口要：(a) 保持应用的零网络属性；(b) 在任何像素密度
下渲染清晰可扫的码；(c) 在真正发生支付的移动端好用；(d) 遵循同一份
交互规范，让本作者的每个工具站行为一致。

## Goals

- 页脚 ☕ → 弹窗 → 支付宝 | 微信支付页签 → 二维码，符合跨站统一
  规范。
- 二维码在首次打开时由客户端生成；二维码库只在弹窗打开那一刻懒加载。
- 可扫性优先于主题一致性：无论配色如何，浅色卡片 + 深色码点；纠错
  级别 M；约 220 px 码面 + ≥4 模块静区。
- 移动端贴心设计：点支付宝可直跳支付 App；返回页面时展示二维码
  兜底。
- 文案完全双语（EN/zh），走标准 i18n 键。

## Non-Goals

- 支付处理、金额选择或收款回执——二维码编码的是个人收款码，剩下的
  交给支付 App。
- 国际卡支付、PayPal、加密货币或「赞助」链接。
- 围绕弹窗的统计（打开次数在任何地方都不被记录）。
- 二维码 canvas 跨弹窗缓存（按规范每次打开重建）。

## Solution Overview

`js/donation.js` 暴露 `CW.Donation`：

- **配置** —— 两个支付负载集中在一个 `CONFIG` 对象（支付宝：一个
  `https://qr.alipay.com/…` URL；微信：一个 `wxp://` 负载）。
- **懒加载库** —— 首次打开时注入 `vendor/qrcode.min.js`
  （`QRCodeLib`）；弹窗先渲染结构并显示「生成中」提示，库就绪后绘制
  canvas。
- **渲染** —— 码点绘制到 `<canvas>`，按 devicePixelRatio 缩放；
  `aria-label` 与说明文字描述当前渠道（「Scan with Alipay」/
  「Scan with WeChat」）。
- **移动跳转** —— 移动端支付宝场景，原始二维码内容（普通 https
  URL）经 `location.href` 打开；`visibilitychange` / `pageshow`
  处理器在用户返回时展示二维码兜底（带宽限窗口，跳转期间兜底不闪烁）。
- 微信永不深链（其负载无法从浏览器可靠打开）——始终直接展示二维码。

## Detailed Behavior

- 打开时重置到支付宝页签，清空缓存与跳转标记。
- 切换页签重新渲染对应 canvas（单次打开内缓存）。
- ESC、✕ 按钮、遮罩层均可关闭弹窗。
- 二维码库加载失败时，弹窗保持可用并停留提示，不会崩坏。
- 该组件只做三件事：展示一个入口、可能在移动端尝试一次支付宝 URL
  跳转、渲染一个二维码——不上传任何东西，不追踪任何东西。

## User Experience

桌面：点页脚 ☕ → 带页签和大二维码的弹窗 → 用支付 App 扫码。移动端：
同一个弹窗；支付宝可直接跳转 App，返回后看到码。

![赞赏弹窗与实时二维码](../../img/donate-modal.webp)

## Compatibility and Historical Impact

最早的赞赏实现是页脚静态二维码图片；后按跨站统一规范重建为本弹窗
（实时 canvas 二维码、懒加载内置库、移动跳转 + 兜底）。静态图片仅
作为 README 呈现保留（`img/donate/*.png`）。应用其他行为不受影响。

## Data and Privacy Impact

- 不新增存储键；弹窗不写任何 localStorage。
- 除一次性加载本地脚本 `vendor/qrcode.min.js` 外无任何网络。
- 唯一的外部交互是移动端可选跳转到支付宝 URL——那是支付本身，不是
  追踪。

## Performance Impact

页面加载零开销：库懒加载且仅一次；canvas 每次弹窗打开时毫秒级绘制。

## Current Limitations

- 支付负载硬编码在 `js/donation.js`（`CONFIG`）；更换是代码修改，
  不是设置项。
- 微信码只能扫——浏览器内没有可靠的深链。
- 桌面浏览器无法跳转支付 App；扫码是唯一路径。

## Release Information

- Introduced: v1.2.0
- Status: Stable

## Related Documentation

- [隐私说明——第三方交互](../privacy.md#第三方交互)
- [部署指南——发布后验证清单](../deployment.md#发布后验证清单)
  （验证 `vendor/` 已上传）

## Feature Changelog

### v1.2.0

- 以页脚静态图首次发布，随后按跨站统一规范重建：支付宝/微信页签
  弹窗、懒加载内置二维码库、实时 canvas 渲染、移动端支付宝跳转与
  返回兜底。`test/dom-test.js` 的赞赏小节覆盖（入口、页签、实时
  canvas、无静态图片、ESC 关闭、中文文案）。
