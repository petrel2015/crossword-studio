# Generation Engine

## Summary

A seeded, deterministic crossword layout engine that weaves a word list
into a newspaper-style grid under classic placement rules and picks the
best of many randomised attempts.

## Background

Hand-making a crossword means finding interlocking words, matching every
crossing letter, avoiding accidental words, and numbering the grid —
hours of trial and error for a teacher who just wants a vocabulary
sheet. Existing generators are often apps, accounts, or produce loose
"word-search-like" grids that violate crossword conventions.

## Problem

The project needed generation that is (a) correct by construction —
crossings always agree, no fake adjacent words; (b) honest — words that
cannot fit are reported with a reason, never dropped silently; (c) fast
enough to feel instant in a browser; and (d) reproducible in tests, so
algorithm changes can be verified without a human eyeballing grids.

## Goals

- Every placed word obeys classic crossword rules (matching crossings,
  no parallel overlap, no accidental adjacent letter runs).
- Standard Across/Down numbering on the final grid.
- Compact, broadsheet-like layouts across a wide range of word counts.
- Same seed → same grid (determinism); every Generate click → new seed
  (variety).
- Unplaced words reported with a machine-readable reason code.
- Pure logic with zero DOM dependencies, runnable in Node for testing.

## Non-Goals

- Cryptic-crossword semantics or clue generation (clues are a separate
  concern; see [AI clue writing](./ai-clues.md)).
- Free-form "word search" or "fill-in" puzzle types.
- Supporting words longer than 12 letters or non-A–Z scripts.
- Guaranteeing that *every* word list is fully placeable — some sets
  genuinely cannot interlock, and that must be reported, not forced.
- Multi-word phrases (internal spaces are rejected at parsing).

## Solution Overview

`js/generator.js` exposes `CW.Generator.buildLayout(words, options)`:

1. **Sparse grid** — a `Map` keyed `"r,c"` lets coordinates go negative
   while the layout grows; the bounding box is derived at the end.
2. **Rules validation** — each candidate placement checks crossings
   (letters must match), forbids parallel overlap, and forbids adjacent
   letter runs that would spell unintended words.
3. **Scoring** — valid placements score
   `crossings·weight − bounding-box growth − aspect stretch + jitter`;
   the best candidate is placed next.
4. **Passes** — failed words are retried in later passes, because later
   placements can unlock earlier failures.
5. **Selection** — many seeded attempts run; the winner maximises placed
   words → intersections → compactness → squareness.
6. **Numbering** — standard crossword numbering is applied to the chosen
   grid.

Difficulty presets tune density and the grid-size cap (Easy dense and
compact, Hard sprawling and sparse).

## Detailed Behavior

- Words are sanitized to uppercase A–Z before layout; 3–12 letters.
- Randomness comes from mulberry32 seeded by an FNV-1a hash of a seed
  string — fully deterministic per seed.
- The result carries `entries` (row, col, direction, answer, clue) and
  `unplaced` (answer, clue, `reasonCode` + params):
  - `noShared` — shares no letters with the placed words;
  - `conflicts` — crossings existed but every position collided;
  - `tooLongGrid` — exceeds this difficulty's grid-size limit;
  - `default` — legacy/unknown provenance.
- The same layout (seeded) always numbers and renders identically.

## User Experience

The user only sees two controls: **Generate crossword** and
**Regenerate**. Regenerate rolls a new seed while re-applying the user's
edited clues, so "one more layout" is always one click. Unplaced words
appear in a panel under the grid with a human-readable reason (the UI
translates the reason codes).

## Compatibility and Historical Impact

No historical behavior is affected. The engine's output shape (layout
with entries + unplaced) is the contract consumed by solving, printing,
progress keying and share links; it has been stable since first release.

## Data and Privacy Impact

None. Generation is pure computation: no storage writes, no network
calls, no user data touched.

## Performance Impact

Generation of typical classroom sets (12–30 words) completes in
milliseconds to a few tens of milliseconds on commodity hardware; the
stress suite generates 24 puzzles from random subsets in ~77 ms on the
development machine. No measurable impact on page load (the module is a
single classic script).

## Current Limitations

- Non-English and hyphenated/accented words are out (A–Z only).
- Very large word sets can exceed the grid caps and report unplaced
  words.
- Layout quality is heuristic: a specific aesthetic ideal (e.g. maximum
  interlock density like NYT themes) is not a goal.

## Release Information

- Introduced: v1.2.0
- Status: Stable

## Related Documentation

- [Usage — build a puzzle](../usage.md#build-a-puzzle-from-a-word-list)
- [Architecture — the placement engine](../architecture.md#the-placement-engine)
- [Share links](./share-links.md) (consumes the same layout via
  `buildLayout` validation)
- [AI clue writing](./ai-clues.md)

## Feature Changelog

### v1.2.0

- Initial release: sparse-grid placement engine, passes, seeded
  determinism, best-of-N selection, reason-coded unplaced words; covered
  by 5,527 assertions in `test/gen-test.js`.
