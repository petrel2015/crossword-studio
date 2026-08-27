English | [中文](README.zh-CN.md)

![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)
![Pure Web](https://img.shields.io/badge/Pure%20Web-No%20Build-111111.svg)
![Dependencies](https://img.shields.io/badge/runtime%20dependencies-0-green.svg)
![Tests](https://img.shields.io/badge/tests-5637%20checks-brightgreen.svg)

---

A pure, zero-dependency web application that turns **a list of English words — or a whole English article — into a newspaper-style crossword puzzle**. Generate, solve online, edit clues, print an A4 sheet (with or without an answer key), and share the puzzle as a single link. No server, no account, no build step.

> __💡 Core Goal: paste words or an article, get a printable, shareable broadsheet crossword — everything runs in your browser.__

---

## Input Modes

| Mode | You provide | Where clues come from |
| --- | --- | --- |
| __Word list__ | One word per line, optional clue after `\|` | Your own clues; AI dictionary-style clues; or blank (editable later) |
| __Article__ | A pasted English article | __AI article-anchored clues__ (cite the text's scenes, mimic its tone) or __offline cloze clues__ (`From the text: "…the keeper trimmed the ______ each dusk"`) |

In Article mode, candidate words are extracted **locally** (function words removed, plurals merged, proper nouns recognised, ranked by frequency and prominence), you tick the words you want, and you can add custom words by hand.

## Features

- __Classic crossword generation__: shared-letter weaving under strict placement rules (matching crossings, no parallel overlap, no accidental adjacent runs), standard Across/Down numbering, compact broadsheet-style layouts across many randomised attempts
- __Honest about failures__: words that cannot be placed are listed with a reason — never silently dropped
- __Full solving surface__: click-and-type (desktop keys and mobile keyboards), arrow-key navigation, direction flip, clue-click locating with current-word highlight, Check (red-pencil marks), Hint, Reveal letter / word / puzzle, timer
- __Auto-saved progress__: letters, reveals and elapsed time persist per puzzle in localStorage
- __Editing__: change title, difficulty and any clue; regenerate re-lays-out the grid while keeping your clue edits
- __Print / PDF__: A4 portrait, pure black & white; __editable print-only title__; show / hide / custom date; optional answer-key page; on-screen preview shows the real pages; "Export PDF" = the browser's *Save as PDF*
- __Link sharing__: the entire puzzle is compressed into the URL hash (`#p=…`, gzip + base64url) — anyone opening the link solves the same puzzle, no server involved
- __English / 简体中文__: switched at the top-right, defaults to the browser language
- __Responsive__: desktop two-pane, tablet stacked with two clue columns, phone single column with scrollable toolbar

## Quick Start

No build step. Two ways to run:

```bash
# Option A — just open index.html in a browser (double-click)

# Option B — serve it (recommended; needed for AI clues on CORS-strict providers):
python3 -m http.server 8741
# open http://localhost:8741/
```

Deploying = copying the folder to any static host (GitHub Pages, Netlify, object storage, an internal file share…). There is no backend.

## Configuring AI Clues

Click **AI Settings** (top right) and point the app at any OpenAI-compatible `/chat/completions` endpoint:

| Provider | Base URL |
| --- | --- |
| OpenAI | `https://api.openai.com/v1` |
| Volcengine Ark | `https://ark.cn-beijing.volces.com/api/v3` |
| DeepSeek | `https://api.deepseek.com/v1` |
| Ollama (local) | `http://localhost:11434/v1` |

- The API key is stored only in your browser's localStorage and sent only to the endpoint you configure.
- Only clue-less words (word-list mode) or the article excerpt + selected words (article mode) are transmitted; nothing else leaves the browser.
- No AI configured? Everything still works — clues stay blank and editable, and Article mode falls back to the fully offline cloze style.
- If a provider blocks direct browser calls (CORS), use a CORS-friendly endpoint or keep clues manual.

## Development

### Project structure

```
index.html            Markup only; static texts carry data-i18n keys
css/style.css         Swiss-broadsheet design system + A4 print rules
js/
├── generator.js      ★ Crossword algorithm — pure logic, no DOM, Node-runnable.
│                       Errors are codes (issue.* / reason.*), translated by the UI.
├── extract.js        ★ Article → candidate words + cloze sentences — pure logic,
│                       Node-runnable: tokenising, stopwords, plural merging,
│                       proper-noun detection, ranking, word-boundary blanking.
├── i18n.js           en/zh dictionaries, detection, data-i18n applier
├── codec.js          puzzle ⇄ URL hash (gzip + base64url, CompressionStream)
├── storage.js        localStorage: progress / draft / AI settings
├── ai.js             Optional clue writing — dictionary-style or article-anchored
│                       (article truncation, 20-word batches, progress callback)
├── solve.js          Interactive grid: selection, typing, check/reveal, timer
├── print.js          A4 page builder (screen preview = real print output)
└── app.js            Orchestration: views, toolbar, editor, modals, modes
test/
├── gen-test.js       Algorithm invariants (crossings, runs, numbering,
│                     determinism, stress) — 5,527 checks
├── extract-test.js   Extraction invariants (stopwords, merging, proper nouns,
│                     cloze blanking/trimming) — 29 checks
└── dom-test.js       jsdom end-to-end of the real app — 81 checks
```

### Development workflow

```bash
npm install           # dev-only: jsdom for the DOM test suite
# edit files, refresh the browser — there is nothing to build
```

### Running tests

```bash
node test/gen-test.js       # crossword algorithm suite
node test/extract-test.js   # article extraction + cloze suite
node test/dom-test.js       # full-app end-to-end suite (boots real index.html)
```

`dom-test.js` drives both input modes end-to-end: generation, typing, checking, hinting, revealing, editing, share-link restoration, print title/date overrides, language switching, and progress persistence.

### Architecture notes

__Data flow__:

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

__Key technical points__:

- __Placement engine__: a sparse Map-based grid lets candidate coordinates go negative while the layout grows; every placement is validated against classic crossword rules, scored by `crossings·weight − bounding-box growth − aspect stretch + jitter`, and retried across passes (later placements can unlock earlier failures). Best attempt wins by placed words → intersections → compactness → squareness.
- __Deterministic with variety__: the same seed always yields the same grid; every Generate click rolls a new seed, so Regenerate gives a fresh layout.
- __Tamper-proof share links__: a `#p=` URL is replayed through the same validation engine (`buildLayout`); a corrupted or edited link fails loudly instead of rendering a broken grid.
- __Progress keying__: progress is stored under a hash of the layout + answers, so editing a clue or the title never resets solving history, while a regenerated layout gets a clean slate.
- __Language switching__: one pass re-applies all `data-i18n` texts and rebuilds the dynamic views (clue list, grid aria labels, drawer) while preserving progress and the running timer.
- __Print preview is the print output__: the same A4 DOM is shown scaled inside the modal and moved under `#printRoot` at print time — what you preview is exactly what prints.
- __Cloze safety__: blanks replace only whole-word, case-insensitive matches (`CARE` never blanks inside `CAREFUL`), long sentences are windowed around the blank.

## Tech Stack

- Pure HTML / CSS / JavaScript (ES2017+, classic scripts — works from `file://`)
- Zero runtime dependencies; jsdom (dev-only) for the end-to-end suite
- Modern web platform: `CompressionStream`, `ResizeObserver`, `navigator.share`, `localStorage`

---

## Buy me a coffee · 请我喝杯咖啡

If this little tool saves you a puzzle-making afternoon, buy the author a coffee — use the **☕ Buy me a coffee** entry in the site footer; it opens a dialog with an Alipay / WeChat Pay switch and **generates the QR code live in your browser** (no static images). The codes below are static renditions for this README only:

<p align="center">
  <img src="img/donate/alipay-qr.png" width="180" alt="Alipay QR" />
  <img src="img/donate/wechat-qr.png" width="180" alt="WeChat QR" />
</p>

<p align="center"><em>支付宝 · 微信</em></p>
