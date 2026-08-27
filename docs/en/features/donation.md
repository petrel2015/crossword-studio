# Donation Dialog

## Summary

A footer ☕ "Buy me a coffee" entry that opens a dialog with an
Alipay / WeChat Pay switch and renders the payment QR code live in the
browser — no static images, no third-party QR API.

## Background

The author wanted a tip jar that works for Chinese payment apps
(Alipay / WeChat Pay). Static QR images age badly across pages and can't
adapt to theme or screen, and third-party QR web services add a network
dependency and a tracking vector to an otherwise zero-network app.

## Problem

The project needed a donation entry that (a) keeps the app's
zero-network property, (b) renders crisp, scannable codes at any pixel
density, (c) works on mobile where people actually pay, and (d) follows
one interaction spec so every tool site by this author behaves the same
way.

## Goals

- Footer entry ☕ → dialog → Alipay | WeChat Pay tabs → QR, per the
  shared cross-site spec.
- QR generated client-side at first open; the QR library is lazy-loaded
  only when the dialog opens.
- Scannability beats theming: light card + dark modules regardless of
  color scheme; error correction level M; ~220 px code with a ≥4-module
  quiet zone.
- Mobile affordance: tapping Alipay may jump straight into the payment
  app; returning to the page shows the QR fallback.
- Fully bilingual labels (EN/zh) via the standard i18n keys.

## Non-Goals

- Payment processing, amount selection, or receipts — the QR encodes a
  personal payment code; the payment apps handle the rest.
- International card payments, PayPal, crypto, or "sponsor" links.
- Analytics around the dialog (opens are not tracked, anywhere).
- Caching the QR canvases across dialog opens (rebuilt per open, per
  spec).

## Solution Overview

`js/donation.js` exposes `CW.Donation`:

- **Config** — the two payment payloads live in one `CONFIG` object
  (Alipay: an `https://qr.alipay.com/…` URL; WeChat: a `wxp://` payload).
- **Lazy library** — `vendor/qrcode.min.js` is injected on first open
  (`QRCodeLib`); the dialog renders structure immediately with a
  "generating…" note and paints the canvas when the library arrives.
- **Rendering** — modules are painted onto a `<canvas>` with
  devicePixelRatio-aware scaling; `aria-label` and caption describe the
  active channel ("Scan with Alipay" / "Scan with WeChat").
- **Mobile jump** — on mobile Alipay, the raw QR content (a normal
  https URL) is opened via `location.href`; `visibilitychange` /
  `pageshow` handlers show the QR fallback when the user returns (with a
  grace window so the fallback doesn't flash during the jump).
- WeChat never deep-links (its payload can't be opened reliably from a
  browser) — always straight to the QR.

## Detailed Behavior

- Opening resets to the Alipay tab, clears caches and jump markers.
- Tab switch re-renders the corresponding canvas (cached per open).
- ESC, the ✕ button, and the backdrop close the dialog.
- If the QR library fails to load, the dialog stays usable with the
  loading note instead of breaking.
- The component only ever shows an entry, may attempt one Alipay URL
  jump on mobile, and renders a QR — nothing is uploaded, nothing is
  tracked.

## User Experience

Desktop: click ☕ in the footer → dialog with tabs and a large scannable
code → scan with the payment app. Mobile: same dialog; Alipay can hand
off straight to the app, and coming back shows the code.

![Donation dialog with live QR](../../img/donate-modal.webp)

## Compatibility and Historical Impact

The first donation attempt used static QR images in the footer; it was
rebuilt into this dialog per the unified cross-site spec (live canvas QR,
lazy vendor load, mobile jump + fallback). The static images survive only
as README renditions (`img/donate/*.png`). No other app behavior is
affected.

## Data and Privacy Impact

- No storage keys are added; the dialog writes nothing to localStorage.
- No network beyond the one-time load of the local `vendor/qrcode.min.js`
  script file.
- The only external interaction is the optional mobile navigation to the
  Alipay URL — that is the payment itself, not tracking.

## Performance Impact

Zero at page load: the library is loaded lazily and only once; canvases
are painted per dialog open in a few milliseconds.

## Current Limitations

- The payment payloads are hard-coded in `js/donation.js` (`CONFIG`);
  changing them is a code edit, not a settings change.
- WeChat codes must be scanned — no reliable in-browser deep link exists.
- Desktop browsers cannot jump into payment apps; scanning is the only
  path there.

## Release Information

- Introduced: v1.2.0
- Status: Stable

## Related Documentation

- [Privacy — third-party interactions](../privacy.md#third-party-interactions)
- [Deployment — after-deploy checklist](../deployment.md#after-deploy-checklist)
  (verify `vendor/` uploaded)

## Feature Changelog

### v1.2.0

- Initial release as a static footer image set, then rebuilt per the
  unified cross-site spec: dialog with Alipay/WeChat tabs, lazy vendored
  QR library, live canvas rendering, mobile Alipay jump with return
  fallback. Covered by the donation section of `test/dom-test.js`
  (entry, tabs, live canvas, no static images, ESC close, zh labels).
