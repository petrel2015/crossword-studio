# Architecture

How Crossword Studio is put together. This is a client-only static app —
no backend, no build pipeline — so "architecture" means module
responsibilities, the data flow between them, and the algorithms at the
core. For commands and project layout, see [Development](./development.md).

## High-level view

```
                     ┌────────────────────────────────────────────┐
                     │                  index.html                │
                     │   static markup, all texts via data-i18n   │
                     └───────────────────┬────────────────────────┘
                                         │ boot
                     ┌───────────────────▼────────────────────────┐
                     │                  app.js                    │
                     │  views · toolbar · editor drawer · modals  │
                     └──┬─────────┬─────────┬─────────┬───────────┘
        word list or    │         │         │         │
        article ──┐     │         │         │         │
                  ▼     ▼         ▼         ▼         ▼
            extract.js  generator.js  ai.js   print.js   codec.js
            (local      (pure,       (fetch,  (A4 DOM)   (hash ⇄
             NLP)        seeded)      optional)           puzzle)
                  └──────┴────┬──────┴────────┼──────────┘
                              ▼               ▼
                          solve.js        storage.js
                          (grid UI)   (localStorage, 5 keys)
```

Scripts are classic (no ES modules); `index.html` loads pure logic first
(`generator`, `extract`), then feature modules (`storage`, `codec`,
`promptgate`, `ai`, `i18n`, `solve`, `print`, `donation`), and `app.js`
last. Everything hangs off a single global namespace: `CW`.

## Module responsibilities

| File | Responsibility | DOM? | Node-runnable? |
| --- | --- | --- | --- |
| `js/generator.js` | Placement engine, numbering, seeded randomness (`CW.Generator`) | No | Yes |
| `js/extract.js` | Tokenising, stopwords, plural merging, proper nouns, ranking, cloze blanking (`CW.Extract`) | No | Yes |
| `js/codec.js` | Puzzle ⇄ `#p=` hash: JSON payload → gzip → base64url (`CW.Codec`) | No | No (needs `CompressionStream`) |
| `js/storage.js` | The only code touching localStorage — 5 keys (`CW.Store`) | localStorage | No |
| `js/promptgate.js` | Central config for the built-in AI gateway: base URL, public caller identifier, model alias (`CW.PromptGate`) | No | Yes |
| `js/ai.js` | Clue writer — built-in gateway (default) or custom OpenAI-compatible endpoints; limit-aware batching, error normalisation (`CW.AI`) | fetch | No |
| `js/i18n.js` | en/zh dictionaries, language detection, `data-i18n` applier (`CW.t`) | Yes | No |
| `js/solve.js` | Grid interaction: selection, typing, check/reveal, timer (`CW.Solve`) | Yes | No |
| `js/print.js` | A4 page builder shared by preview and print (`CW.Print`) | Yes | No |
| `js/donation.js` | Footer ☕ entry → dialog → Alipay/WeChat tabs → live canvas QR (`CW.Donation`) | Yes | No |
| `js/app.js` | Orchestration: views, toolbar, editor drawer, modals, toast, modes | Yes | No |

The pure modules report problems as **error codes** (`issue.*`,
`reason.*`); the UI translates them via i18n. That is why the algorithm
suites can run in Node with zero mocks.

## Data flow

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

A **layout** is the central data structure: grid dimensions, the
solution grid, numbered entries (row, col, direction, answer, clue), and
the unplaced words with reason codes. Everything downstream — solving,
printing, sharing, progress keying — consumes that one shape.

## The placement engine

`js/generator.js`, exposed as `CW.Generator` with `buildLayout` as the
main entry point.

1. **Grid model** — a sparse `Map` keyed by `"r,c"`, so candidate
   coordinates may go negative while the layout grows; the bounding box
   is computed at the end.
2. **Placement rules** — every candidate placement is validated against
   classic crossword rules: crossing letters must match, no parallel
   overlapping lines, no accidental adjacent letter runs that would form
   fake words.
3. **Scoring** — each valid placement is scored
   `crossings·weight − bounding-box growth − aspect stretch + jitter`;
   higher is placed first among candidates.
4. **Passes** — the generator retries failed words across multiple
   passes, because later placements can unlock earlier failures.
5. **Selection** — many randomised attempts run; the winner is chosen by
   placed words → intersections → compactness → squareness.
6. **Determinism** — randomness comes from a seeded PRNG (mulberry32, an
   FNV-1a string hash feeds it). The same seed always yields the same
   grid; every Generate click rolls a new seed, which is why Regenerate
   produces a fresh layout while staying reproducible in tests.
7. **Numbering** — standard crossword numbering is applied to the final
   grid: a cell starts an Across entry if it has no letter to its left
   and letters to its right; Down is symmetric.

Difficulty shapes geometry: Easy uses tighter density targets, Hard
allows sprawling sparse grids (and a larger grid-size limit, which is
also what the `tooLongGrid` unplaced reason reports against).

## Share-link codec

`js/codec.js`. The payload (`{v:1, title, difficulty, entries[[row, col,
dir, answer, clue]…], unplaced[[answer, clue]…]}`) is JSON-serialised,
gzipped via `CompressionStream`, and base64url-encoded behind a `G`
marker; without `CompressionStream` it falls back to a plain base64url
`R` marker. On load the hash is replayed through the same
`buildLayout` validation engine, so a corrupted or hand-edited link
fails loudly instead of rendering a broken grid. Details:
[Share links](./features/share-links.md).

## Progress keying

Progress is stored under a hash of layout + answers
(`cw-progress:<id>`). Consequence: editing a clue or the title never
resets solving history, while a regenerated layout gets a clean slate.
See `js/storage.js` for the five keys the app may write.

## Language switching

`js/i18n.js` holds the en/zh dictionaries. Static markup carries
`data-i18n` / `data-i18n-placeholder` / `data-i18n-title` keys; dynamic
strings go through `CW.t(key, params)`. A switch is one pass that
re-applies all static texts and rebuilds the dynamic views (clue lists,
grid ARIA labels, drawer) while preserving progress and the running
timer.

## Print pipeline

`js/print.js` builds the A4 pages as real DOM (pure black on white,
cell sizes computed in mm from the grid dimensions). The **same** DOM is
shown scaled inside the print modal and moved under `#printRoot` at
print time — what you preview is exactly what prints.

## Testing strategy

Because the core is pure logic, the two algorithm suites run in Node
without any browser. The third suite (`test/dom-test.js`) boots the real
`index.html` in jsdom and drives both input modes end-to-end —
generation, solving, editing, printing, sharing, language switching,
persistence and the donation dialog. Totals: 5,527 + 29 + 99 = 5,655
assertions, all green at v1.2.0.
