# Development

Everything needed to work on Crossword Studio itself. Verified commands
only — every command below was executed against this repository at
version 1.2.0.

## Requirements

- **Node.js** (with npm) — needed only for the dev dependencies and the
  test suites. Any modern Node version works; the project itself has no
  build step and no `engines` restriction in `package.json`.
- **A browser** — the app is plain HTML/CSS/JS with no build step.
- **Python 3** (optional) — only for the one-liner static server in the
  examples; any static server works.

## Commands

| Command | What it does | Status |
| --- | --- | --- |
| `npm install` | Installs dev dependencies only (`jsdom` for DOM tests, `qrcode` for the QR generation script) | Verified: succeeds, 0 vulnerabilities |
| `npm test` | Runs all three test suites in sequence | Verified: 5,655 assertions, 0 failures |
| `node test/gen-test.js` | Crossword algorithm invariants alone | Verified: 5,527 passed |
| `node test/extract-test.js` | Article extraction invariants alone | Verified: 29 passed |
| `node test/dom-test.js` | Full-app end-to-end in jsdom alone | Verified: 99 passed |
| `python3 -m http.server 8741` | Serves the app at <http://localhost:8741/> | Verified: HTTP 200 |

There is **no build command**, **no lint configuration**, and **no CI
workflow**. The repository root is the deployable artifact. Editing a
file = refresh the browser.

## Tests — what each suite actually verifies

### `test/gen-test.js` — the placement engine (5,527 assertions)

Pure-logic invariants of `js/generator.js`, runnable in Node because the
generator has no DOM dependencies: crossing letters agree, no parallel
overlap, no accidental adjacent word runs, Across/Down numbering is
standard, the same seed is deterministic, layout scoring picks compact
square grids, and a stress pass generates many random subsets and full
sets without violating the rules.

### `test/extract-test.js` — article extraction (29 assertions)

Invariants of `js/extract.js`: stopword filtering, plural merging,
proper-noun recognition, ranking by frequency/prominence, and cloze
blanking (whole-word, case-insensitive, long sentences windowed around
the blank).

### `test/dom-test.js` — end-to-end (99 assertions)

Boots the real `index.html` inside jsdom and drives it like a user:
builder parsing and issue reporting, language switching, generation in
both modes, typing, check/hint/reveal, progress persistence across a
language switch, clue editing, print title/date overrides and the answer
key page, share modal, regenerate confirmation, restore-from-URL, the
article flow (extract → pick → cloze), and the donation dialog per the
shared spec.

Known noise: jsdom prints a few
`Not implemented: HTMLCanvasElement.getContext()` warnings because the
donation QR is painted on a canvas. They are warnings, not failures; the
assertions still pass.

## Lint status

There is no lint script and no lint configuration in the repository.
`vendor/qrcode.min.js` is a minified third-party file; if you add a
linter, exclude that path.

## Project structure

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
├── donation.js       Footer ☕ entry → dialog → Alipay/WeChat tabs → live QR
└── app.js            Orchestration: views, toolbar, editor, modals, modes
test/
├── gen-test.js       Algorithm invariants — 5,527 checks
├── extract-test.js   Extraction invariants — 29 checks
└── dom-test.js       jsdom end-to-end of the real app — 99 checks
scripts/
└── generate-donate-qr.js  Dev utility that rendered the static README QR PNGs
vendor/
└── qrcode.min.js     Vendored QR library, lazy-loaded by donation.js only
img/donate/           Static QR renditions used by the READMEs only
docs/                 This documentation (en + zh) and screenshots (docs/img/)
```

Module responsibilities and data flow: [Architecture](./architecture.md).

## Local development notes

- No environment variables, no `.env` files, no feature flags. All
  configuration lives in the user's browser (AI settings) — there is
  nothing to configure at development time.
- Scripts are classic (no modules); load order in `index.html` matters:
  `generator` and `extract` first (pure logic), then feature modules,
  with `app.js` last as the orchestrator.
- To verify a "production" deployment locally, serve the repo root and
  exercise the flows: generate → solve → print preview → share link →
  open the link in a fresh tab. [Deployment](./deployment.md) describes
  the hosted case.
- `scripts/generate-donate-qr.js` is a one-off dev utility (it produced
  `img/donate/*.png` for the READMEs); the app itself always generates
  QR codes at runtime.

## Adding a license

The repository currently has **no LICENSE file**. To add one:

1. Pick a license (MIT or Apache-2.0 are common for tools like this) —
   this is the maintainer's decision, not a contributor's.
2. Add the license text at the repository root as `LICENSE`.
3. Mention it in `README.md` (License Notes section), `README.zh.md`
   (许可证说明), and `README_FOR_AI.md` (Project Identity → License).
4. Consider adding a GitHub Release + tag so version badges can become
   dynamic.
