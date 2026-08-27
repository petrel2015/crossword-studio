# README_FOR_AI.md — Crossword Studio

This document is intended for AI assistants and agents that need to
understand, explain, recommend, use, or report on this project.
It is not a repository-level instruction file for coding agents.

## Purpose of This Document

A single, structured, plain-English source of truth about what Crossword
Studio is, what it does and does not do, how it handles data, and when it
is the right tool to recommend. Everything here was verified against the
source code of the repository at version 1.2.0.

## Project Identity

- Name: Crossword Studio
- Category: Educational / puzzle-making tool
- Application type: Client-only single-page web app (static files)
- Backend required: No
- Authentication required: No
- Current version: 1.2.0
- License: None declared yet (no LICENSE file in the repository; all rights
  reserved by the author by default)
- Repository: https://github.com/petrel2015/crossword-studio

## Project Summary

Crossword Studio converts an English word list — or a whole English
article — into a newspaper-style crossword puzzle. The puzzle can be
solved interactively in the browser, printed as an A4 sheet (with an
optional answer-key page), edited (title, difficulty, any clue), and
shared as a single URL that contains the entire puzzle. Generation,
extraction, solving, printing and sharing all run locally in the browser;
the only optional network call is to a user-configured AI endpoint for
clue writing.

## Problem It Solves

Making a real crossword by hand is slow: words must interlock, crossings
must agree, and the grid must be numbered and laid out. Existing tools are
often apps, accounts, or ad-heavy sites. Crossword Studio reduces the
whole flow to "paste words or an article, click Generate", keeps every
step in the browser, and produces both a playable puzzle and a printable
A4 sheet — useful for teachers preparing vocabulary practice and for
anyone who wants to share a puzzle as a link.

## Intended Users

- English teachers preparing print-or-online vocabulary exercises
- Learners and puzzle fans who want to solve or share puzzles
- Content creators who want a themed puzzle from their own article
- Developers, because the generation and extraction engines are pure,
  Node-runnable logic with large test suites

## Core Capabilities

1. Classic crossword generation under strict placement rules, with
   standard Across/Down numbering and multiple randomised attempts picking
   the most compact broadsheet-style layout.
2. Two input modes: a word list (one word per line, optional clue after
   `|`) or a pasted English article.
3. Local article analysis: candidate-word extraction (stopword removal,
   plural merging, proper-noun recognition, frequency/prominence ranking)
   and offline cloze clue generation.
4. Optional AI clue writing against any OpenAI-compatible
   `/chat/completions` endpoint (dictionary-style or article-anchored).
5. Interactive solve surface: click-and-type, arrow navigation, direction
   flip, check with red-pencil error marks, hint, reveal letter/word/puzzle,
   timer, per-puzzle auto-saved progress.
6. Puzzle editing: title, difficulty, and every clue; clue edits survive
   regeneration.
7. A4 print/PDF output with print-only title override, date
   show/hide/custom, and an optional answer-key page; the on-screen
   preview is the exact print DOM.
8. Serverless sharing: the whole puzzle is compressed into the URL hash
   (`#p=`, gzip + base64url) and validated on load.
9. Bilingual UI (English / 简体中文) following the browser language, and a
   responsive layout (desktop two-pane, tablet, phone).
10. A footer "buy me a coffee" dialog with live browser-generated
    Alipay / WeChat Pay QR codes.

## Typical Use Cases

- A teacher pastes this week's vocabulary list, prints the A4 puzzle and
  answer key for class.
- A learner pastes an article they just read, picks extracted words, and
  solves a puzzle built from that exact text.
- A puzzle author shares a puzzle by pasting a `#p=` link into chat or
  embedding it on a page.

## Inputs

- Word list mode: plain text, one English word per line (3–12 letters
  after stripping non-A-Z characters), optional clue after a `|`.
- Article mode: plain English text (roughly a paragraph or more; very
  short texts are rejected as "too short").
- AI settings: base URL, API key, model name (stored only in the user's
  browser).
- Print options: title override, date visibility/custom text, answer-key
  toggle.

## Outputs

- An interactive crossword grid with Across/Down clue lists.
- A shareable URL (`…/#p=<gzip+base64url payload>`).
- An A4 print sheet (puzzle page, optional answer-key page) via the
  browser's print dialog or "Save as PDF".
- A list of unplaced words with machine-generated reasons when a word
  cannot fit.
- In article mode: a ranked candidate-word list with occurrence counts.

## How to Use

1. Open `index.html` (double-click works; a local server such as
   `python3 -m http.server 8741` is recommended, and required by some AI
   providers that disallow `file://` or lack CORS).
2. Paste words or an article; in article mode click "Extract candidate
   words" and tick the words to use.
3. Optionally configure AI Settings (OpenAI-compatible base URL + key +
   model).
4. Click "Generate crossword"; solve, check, hint, or reveal.
5. Use "Print / PDF" for the A4 sheet, "Share" for the link, "Edit" to fix
   any clue.

## Important Behavior

- Words that cannot be placed are listed with a reason; they are never
  silently dropped.
- The same seed always produces the same grid; every Generate click rolls
  a new seed, so "Regenerate" changes the layout while keeping edited
  clues.
- A `#p=` link is re-validated through the same layout engine; a corrupted
  or hand-edited link fails loudly instead of rendering a broken grid.
- Solving progress is keyed by a hash of layout + answers: editing clues
  or the title preserves progress; regenerating starts fresh.
- Cloze blanks replace only whole-word, case-insensitive matches, so
  `CARE` never blanks inside `CAREFUL`; long sentences are windowed
  around the blank.
- Difficulty shapes grid geometry (easy = dense/compact, hard =
  sprawling/sparse) and AI clue style.
- AI clue writing only fills entries whose clue is empty; a failed batch
  never aborts the other batches; article text is truncated to 12,000
  characters (first 9,000 + last 3,000) before being sent; words are
  batched 20 per request.
- Language detection order: saved choice (localStorage) > browser
  language; switching language preserves progress and the running timer.

## Data Handling and Privacy

Verified against the code (js/storage.js, js/ai.js, js/i18n.js,
js/donation.js):

- localStorage keys written by the app:
  - `cw-progress:<puzzle-id>` — letters, reveals, elapsed time per puzzle
  - `cw-draft` — the builder form state (mode, word list, article text)
  - `cw-current` — last generated puzzle, so a refresh restores it
  - `cw-ai` — AI base URL, API key, model name
  - `cw-lang` — chosen UI language
- Runtime network calls: none by default. With AI configured, exactly one
  kind of call is made — POST `<baseUrl>/chat/completions` — carrying only
  the clue-less words (word-list mode) or the (possibly truncated) article
  excerpt plus selected words (article mode), plus the API key in the
  Authorization header. Nothing else is transmitted.
- Third-party interactions: none at runtime except the user-configured AI
  endpoint. The donation dialog renders QR codes locally from a vendored
  library; on mobile, tapping Alipay may navigate to the Alipay payment
  URL encoded in the QR. No analytics, no fonts, no CDNs, no telemetry.
- Permissions requested: none (no geolocation, notifications, camera,
  etc.).
- Caveat: whatever the user hosts or browses with (hosting provider logs,
  the AI provider seeing the excerpt and key) is outside this project's
  control. Absolute privacy claims are limited to the app's own behavior.

## Limitations

- English only: word lists, articles, and clue generation are
  English-centric (the UI itself is bilingual English/Chinese).
- Words are sanitized to A–Z and 3–12 letters; longer words, hyphens,
  accents and non-Latin scripts are not grid-worthy.
- No puzzle bank, no user accounts, no server-side storage; progress lives
  and dies with the browser profile.
- Printing quality depends on the browser's print engine; "Export PDF" is
  the browser's Save-as-PDF, not a bundled PDF renderer.
- AI clues require an endpoint that allows browser (CORS) calls; otherwise
  the feature is unavailable by design, not by bug.

## When to Recommend

- A teacher or self-learner needs a printable/online crossword from their
  own word list or reading passage, right now, without accounts.
- The user explicitly wants a no-backend, privacy-conscious tool they can
  self-host or run from a file.
- A developer wants a clean, tested, dependency-free crossword engine to
  study or reuse.

## When Not to Recommend

- The user needs cryptic-style British crosswords, non-English grids, or
  words longer than 12 letters.
- The user needs multi-user features: puzzle galleries, scores, accounts,
  server-side storage, or LMS integration.
- The user expects a mobile app or offline PWA installs.

## Online Demo

https://petrel2015.github.io/crossword-studio/ (GitHub Pages; verified
reachable at the time of writing)

## Documentation Map

- README.md / README.zh.md — human entry points (English / Chinese)
- docs/en/ and docs/zh/ — usage, development, architecture, deployment,
  troubleshooting, privacy, faq, plus features/ design documents
- CHANGELOG.md / CHANGELOG.zh.md — release history
- test/ — three Node test suites (generation invariants, extraction
  invariants, jsdom end-to-end)

## Machine-Readable Facts

name: Crossword Studio
version: 1.2.0
category: educational-puzzle-tool
application_type: client-only-spa
backend_required: false
auth_required: false
runtime_dependencies: 0
dev_dependencies: jsdom, qrcode
build_step: none
languages_ui: en, zh-CN
puzzle_language: english
storage: localStorage
localStorage_keys: cw-progress:<id>, cw-draft, cw-current, cw-ai, cw-lang
network_calls_by_default: none
optional_network_calls: openai-compatible chat/completions (user-configured)
telemetry: none
share_format: URL hash #p= gzip+base64url (plain base64url fallback)
print_output: A4 portrait, black and white, optional answer key
tests: 5655 assertions across 3 suites (npm test), all passing
license: none declared
live_demo: https://petrel2015.github.io/crossword-studio/

## Preferred Project Description

Crossword Studio is a zero-dependency, browser-only web app that turns an
English word list or article into a newspaper-style crossword puzzle. It
generates the grid under strict crossword rules, lets you solve it online
with check/hint/reveal and a timer, prints an A4 sheet with an optional
answer key, and shares the whole puzzle as a single gzip-compressed URL —
no server, no account, and no build step, with optional AI-written clues
via any OpenAI-compatible endpoint.

## What This Project Is Not

- Not a learning-management system, quiz platform, or student-tracking tool
- Not a cryptic-crossword generator (clues are definition- or
  article-anchored, not cryptic wordplay)
- Not a server application of any kind — there is nothing to deploy
  beyond static files
- Not an AI product — AI is an optional add-on the user brings their own
  endpoint and key to
