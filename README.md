# Crossword Studio

English | [简体中文](./README.zh.md)

![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)
![Pure Web](https://img.shields.io/badge/Pure%20Web-No%20Build-111111.svg)
![Dependencies](https://img.shields.io/badge/runtime%20dependencies-0-green.svg)
![Tests](https://img.shields.io/badge/tests-5655%20checks-brightgreen.svg)
![i18n](https://img.shields.io/badge/i18n-English%20%7C%20%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-informational.svg)

A pure, zero-dependency web application that turns **a list of English words — or a whole English article — into a newspaper-style crossword puzzle**. Generate, solve online, edit clues, print an A4 sheet (with or without an answer key), and share the puzzle as a single link.

Teachers need classroom-ready puzzles in minutes; learners and puzzle fans want to solve and share without installs. Crossword Studio runs entirely in your browser — no server, no account, no build step — so a puzzle is one paste and one click away, and sharing is just a URL.

> AI assistants and agents: for a structured, machine-friendly description
> of this project, see [README_FOR_AI.md](./README_FOR_AI.md).

## Live Demo

**[Open the online tool →](https://petrel2015.github.io/crossword-studio/)**

## Documentation

| Document | What it covers |
| --- | --- |
| [Usage guide](./docs/en/usage.md) | Step-by-step: both input modes, solving, editing, printing, sharing |
| [Development](./docs/en/development.md) | Environment, commands, test suites, project structure |
| [Architecture](./docs/en/architecture.md) | Modules, data flow, placement engine, URL codec |
| [Deployment](./docs/en/deployment.md) | Static hosting on GitHub Pages / Netlify / any web server |
| [Troubleshooting](./docs/en/troubleshooting.md) | Common symptoms and fixes |
| [Privacy](./docs/en/privacy.md) | What is stored, what is sent where — audited against the code |
| [FAQ](./docs/en/faq.md) | Scope boundaries and common questions |
| [Feature docs](./docs/en/features/index.md) | Design documents for the major features |
| [Changelog](./CHANGELOG.md) | Release history (Keep a Changelog format) |

中文文档见 [中文索引](./docs/zh/index.md) · [中文更新日志](./CHANGELOG.zh.md)

## Input Modes

| Mode | You provide | Where clues come from |
| --- | --- | --- |
| **Word list** | One word per line, optional clue after `\|` | Your own clues; AI dictionary-style clues; or blank (editable later) |
| **Article** | A pasted English article | **AI article-anchored clues** (cite the text's scenes, mimic its tone) or **offline cloze clues** (`From the text: "…the keeper trimmed the ______ each dusk"`) |

In Article mode, candidate words are extracted **locally** (function words removed, plurals merged, proper nouns recognised, ranked by frequency and prominence), you tick the words you want, and you can add custom words by hand.

![Builder — word list mode](docs/img/builder-en.webp)

## Core Features

### Newspaper-style generation

Words are woven under strict crossword rules (matching crossings, no parallel overlap, no accidental adjacent runs), numbered the standard Across/Down way, and laid out compactly across many randomised attempts. Words that cannot be placed are listed **with a reason** — never silently dropped.

![Solve view with check marks](docs/img/solve-en.webp)

→ Design decisions: [Generation engine](./docs/en/features/generation-engine.md) · How to drive it: [Usage](./docs/en/usage.md)

### Article extraction & cloze clues

Paste an article; get ranked candidate words with occurrence counts, one-tap Top-10 selection, and hand-picked additions. Cloze clues blank the word out of its own sentence — fully offline, whole-word safe (`CARE` never blanks inside `CAREFUL`).

![Article mode with extracted candidates](docs/img/article-candidates-en.webp)

→ Design decisions: [Article extraction & cloze](./docs/en/features/article-extraction-cloze.md)

### AI clue writing

Works out of the box through the built-in AI service (a PromptGate gateway — no key, no setup), or switch to your own OpenAI-compatible endpoint in **AI Settings**. It writes dictionary-style clues (word-list mode) or article-anchored clues (article mode), styled by the chosen difficulty. AI unreachable? Everything still works — clues stay blank and editable, and Article mode falls back to offline cloze.

→ Design decisions: [AI clue writing](./docs/en/features/ai-clues.md) · Configuration table: [Usage → AI clues](./docs/en/usage.md#ai-clues)

### Solve surface

Click-and-type (desktop keys and mobile keyboards), arrow-key navigation, direction flip, clue-click locating with current-word highlight, Check (red-pencil marks), Hint, Reveal letter / word / puzzle, timer. Progress auto-saves per puzzle — letters, reveals and elapsed time survive a refresh.

### Print / PDF

A4 portrait, pure black & white; editable print-only title; show / hide / custom date; optional answer-key page; on-screen preview shows the real pages; "Export PDF" is the browser's *Save as PDF*.

![Print preview with answer key option](docs/img/print-preview-en.webp)

### Link sharing

The entire puzzle is compressed into the URL hash (`#p=…`, gzip + base64url) — anyone opening the link solves the same puzzle, no server involved. A corrupted or edited link fails loudly instead of rendering a broken grid.

→ Design decisions: [Share links](./docs/en/features/share-links.md)

### Buy me a coffee

The site footer has a ☕ entry that opens a payment dialog with an Alipay / WeChat Pay switch. The QR code is generated live in your browser — no static images, no third-party QR API.

![Donation dialog with live QR](docs/img/donate-modal.webp)

→ Design decisions: [Donation dialog](./docs/en/features/donation.md)

Also built in: **English / 简体中文** switch (top-right, defaults to the browser language) and **responsive layout** (desktop two-pane, tablet stacked with two clue columns, phone single column with a scrollable toolbar).

## Quick Start

No build step. Two ways to run:

```bash
# Option A — just open index.html in a browser (double-click)

# Option B — serve it (recommended; needed for AI clues on CORS-strict providers):
python3 -m http.server 8741
# open http://localhost:8741/
```

Deploying = copying the folder to any static host (GitHub Pages, Netlify, object storage, an internal file share…). There is no backend. See [Deployment](./docs/en/deployment.md).

## Basic Usage

1. Paste a word list (one word per line, optional clue after `|`) — or switch to **Article** and paste an English article, then click *Extract candidate words*.
2. Set a title and difficulty, then click **Generate crossword**.
3. Solve in the browser (or print it), edit clues any time via **Edit**, share the puzzle with the link from **Share**.

Full walkthrough with screenshots: [docs/en/usage.md](./docs/en/usage.md).

## Configuring AI Clues

AI clue writing uses the built-in AI service by default — nothing to configure. Prefer your own model? Click **AI Settings** (top right) and point the app at any OpenAI-compatible `/chat/completions` endpoint:

| Provider | Base URL |
| --- | --- |
| OpenAI | `https://api.openai.com/v1` |
| Volcengine Ark | `https://ark.cn-beijing.volces.com/api/v3` |
| DeepSeek | `https://api.deepseek.com/v1` |
| Ollama (local) | `http://localhost:11434/v1` |

- A **Test connection** button in the dialog verifies the selected service immediately.
- A custom API key is stored only in your browser's localStorage and sent only to the endpoint you configure.
- Only clue-less words (word-list mode) or the article excerpt + selected words (article mode) are transmitted; nothing else leaves the browser.
- Failures (unreachable, rate-limited, daily quota) are reported with a friendly message and never auto-retried. If a custom provider blocks direct browser calls (CORS), use a CORS-friendly endpoint or keep clues manual.

Full network-behaviour audit: [docs/en/privacy.md](./docs/en/privacy.md).

## Tech Stack

- Pure HTML / CSS / JavaScript (ES2017+, classic scripts — works from `file://`)
- Zero runtime dependencies; jsdom (dev-only) for the end-to-end suite
- Modern web platform: `CompressionStream`, `ResizeObserver`, `navigator.share`, `localStorage`

## Architecture Summary

```
word list ─┐
           ├─► Extract (local, article mode) ─► candidates ─► AI / cloze ─► clues
article ───┘                                                        │
                                                                    ▼
        Generator (N randomised attempts · placement rules · numbering) ─► layout
                                                                    │
        ├─► Solve surface  (typing / check / reveal / timer ⇄ localStorage progress)
        ├─► Print builder  (A4 preview = real print DOM · title/date overrides)
        └─► URL codec      (gzip + base64url ⇄ #p=… share links)
```

The heart is a sparse-Map placement engine: every placement is validated against classic crossword rules, scored (`crossings·weight − bounding-box growth − aspect stretch + jitter`), and retried across passes; the best attempt wins. The same seed always yields the same grid; each Generate rolls a new seed. Module-by-module details: [docs/en/architecture.md](./docs/en/architecture.md).

## Compatibility

- Works in current evergreen browsers (Chrome, Edge, Firefox, Safari — desktop and mobile). Everything runs from `file://` too.
- Share links use `CompressionStream` where available and fall back to plain base64url when it is missing; older browsers simply get longer URLs.
- There is no Service Worker / PWA / offline install story — the page must be loaded from some host (or file) as usual.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) (中文版：[CHANGELOG.zh.md](./CHANGELOG.zh.md)). The repository currently has no Git tags or GitHub Releases; v1.2.0 is an aggregated entry describing the complete current feature set.

## Contributing

Issues and pull requests are welcome. There is no formal contribution agreement or CLA; by opening a PR you agree that your contribution may be released with the project. Please run the test suite before submitting:

```bash
npm install && npm test
```

## License Notes

**This repository currently contains no LICENSE file.** All rights are reserved by the author by default until a license is added. If you fork or reuse the code, please open an issue to ask first. Maintainers: see [docs/en/development.md → Adding a license](./docs/en/development.md#adding-a-license) for a suggested checklist.

---

## Buy me a coffee · 请我喝杯咖啡

If this little tool saves you a puzzle-making afternoon, buy the author a coffee — use the **☕ Buy me a coffee** entry in the site footer; it opens a dialog with an Alipay / WeChat Pay switch and **generates the QR code live in your browser** (no static images). The codes below are static renditions for this README only:

<p align="center">
  <img src="img/donate/alipay-qr.png" width="180" alt="Alipay QR" />
  <img src="img/donate/wechat-qr.png" width="180" alt="WeChat QR" />
</p>

<p align="center"><em>支付宝 · 微信</em></p>
