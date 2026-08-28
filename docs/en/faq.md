# FAQ

Short answers to questions about what Crossword Studio does and does not
do. Deeper context: [Usage](./usage.md) ·
[features](./features/index.md) · [Privacy](./privacy.md).

**Can I use it completely offline?**
Yes — it is a static page with zero runtime dependencies. Open
`index.html` from disk and generate, solve and print puzzles with no
network at all. Only AI clue writing needs connectivity (see
[AI clues](./usage.md#ai-clues)).

**Does my data go to a server?**
Puzzle data does not. There are no accounts and no server-side storage:
words, articles, puzzles, progress and AI settings live in your browser's
localStorage; the audited network behavior is documented in
[Privacy](./privacy.md). The only outbound call the app can make is the
AI clue request — to the built-in AI gateway by default, or to an
endpoint you configure. Skip AI and there is no outbound traffic at all.

**Can I make crosswords in other languages (Chinese, German…)?**
The grid and clues are English-centric: words are sanitized to A–Z
letters (3–12), and extraction/AI clue writing assume English text. The
*interface* is bilingual (English/简体中文), but puzzle content should be
English.

**Why are some of my words missing from the puzzle?**
They could not be placed under real crossword rules. They are listed
under the grid with a reason (no shared letters / every crossing
conflicts / exceeds the difficulty's grid limit) — never silently
dropped. Regenerate rolls a new seed, which often places them.

**Can I share a puzzle without a website?**
Yes. **Share** copies a `#p=` link that contains the entire puzzle;
anyone opening it solves the same puzzle. No server or account is
involved on either side. See
[Share links](./features/share-links.md).

**Can several people collaborate on one puzzle, or track each other's
progress?**
No. There are no accounts and no server; progress lives in one browser
profile. Collaboration would require hosting something — a deliberate
non-goal.

**Is there a mobile app / can I install it as an app (PWA)?**
There is no app-store app and no PWA/service-worker install. The site is
responsive and works well in mobile browsers; bookmark it instead.

**Which browsers are supported?**
Current evergreen browsers (Chrome, Edge, Firefox, Safari), desktop and
mobile. Share links prefer `CompressionStream` and fall back to plain
base64url in older engines — older browsers just get longer URLs.

**Do I need an OpenAI account? AI key?**
No — AI clue writing works out of the box through the built-in AI
service, with no account or key of any kind. To use your own model
instead, any OpenAI-compatible endpoint works (OpenAI, DeepSeek,
Volcengine Ark, local Ollama…), and your key stays in your browser. When
AI is unavailable, clues stay blank and editable and article mode falls
back to offline cloze clues. See
[AI clues](./usage.md#ai-clues).

**Why does "Export PDF" open the print dialog?**
Because the browser's *Save as PDF* destination *is* the PDF export.
Crossword Studio builds the exact A4 pages; the browser renders them to
PDF. There is no bundled PDF library.

**Can I put this on my school's intranet / my own site?**
Yes — deployment is copying a folder of static files; see
[Deployment](./deployment.md). Note the licensing situation: the
repository has no LICENSE file yet, so ask the maintainer before
redistributing ([License Notes](../../README.md#license-notes)).

**Is there a changelog?**
[CHANGELOG.md](../../CHANGELOG.md) (中文:
[CHANGELOG.zh.md](../../CHANGELOG.zh.md)). The repository has no tags or
releases yet; v1.2.0 is an aggregated entry describing the complete
current feature set.
