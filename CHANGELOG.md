# Changelog

All notable changes to this project are documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

> **Note on versioning.** This repository has no Git tags and no GitHub
> Releases (verified via `git tag` and `gh release list` on 2026-08-27);
> the only version source is `package.json` (`1.2.0`). v1.2.0 below is an
> **aggregated entry**: the project was first published on 2026-08-22 and
> this entry summarizes the complete current feature set rather than
> inventing a fake 0.x history. For fine-grained history, see the
> [Git log](https://github.com/petrel2015/crossword-studio/commits/main).
> Once the maintainer cuts the first tag, new changes will be tracked
> under [Unreleased].

## [Unreleased]

Nothing yet.

## [1.2.0] - 2026-08-22 (aggregated; first published 2026-08-22, summarizes the full feature set through 2026-08-27)

### Added

- Classic crossword generation: strict placement rules (matching
  crossings, no parallel overlap, no accidental adjacent word runs),
  standard Across/Down numbering, best-of-N randomised layouts scored by
  placed words → crossings → compactness → squareness; honest failure
  reporting for words that cannot be placed.
- Two input modes: word list (one word per line, optional clue after
  `|`) and article mode with fully local candidate-word extraction
  (stopwords, plural merging, proper-noun recognition,
  frequency/prominence ranking) plus Top-10/All/None selection and manual
  word additions.
- Clue sources: your own clues, blank (editable later), offline cloze
  clues (`From the text: "…the ______ each dusk"`), or optional AI clues
  against any OpenAI-compatible `/chat/completions` endpoint —
  dictionary-style (word-list) or article-anchored (article mode), styled
  by difficulty, batched 20 words per request with a progress callback.
- Interactive solve surface: click-and-type (desktop and mobile
  keyboards), arrow-key navigation, direction flip, clue-click locating
  with current-word highlight, Check with red-pencil marks, Hint, Reveal
  letter/word/puzzle, timer, solved banner.
- Auto-saved progress: letters, reveals and elapsed time persist per
  puzzle in localStorage, keyed by layout+answers so clue edits never
  reset history.
- Puzzle editing: title, difficulty (applies on regenerate), and every
  clue via the edit drawer.
- Print / PDF: A4 portrait in pure black & white, print-only editable
  title, show/hide/custom date, optional answer-key page, on-screen
  preview identical to the printed pages.
- Serverless share links: the whole puzzle compressed into the URL hash
  (`#p=`, gzip + base64url via `CompressionStream`, plain base64url
  fallback) and re-validated on load so corrupted links fail loudly.
- Bilingual interface: English / 简体中文, detected from the browser and
  switchable at the top right; responsive layout for desktop, tablet and
  phone.
- "Buy me a coffee" footer entry: dialog with an Alipay / WeChat Pay
  switch whose QR codes are generated live in the browser (vendored
  library, lazy-loaded; no static images, no third-party API); on mobile
  the Alipay tab can jump straight into the payment app with a QR
  fallback on return.

[Unreleased]: https://github.com/petrel2015/crossword-studio/compare/main...HEAD
[1.2.0]: https://github.com/petrel2015/crossword-studio/commit/b93cd4b
