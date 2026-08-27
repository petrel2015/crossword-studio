# Article Extraction & Cloze Clues

## Summary

Fully local analysis of a pasted English article: it ranks candidate
crossword words with occurrence counts and produces offline cloze clues
that blank the word out of its own sentence.

## Background

Teachers and learners usually have a *text* (a story, a news item, a
chapter), not a prepared word list. Retyping words into a list tool is
tedious, and outsourcing the analysis to a server would leak the text
and require connectivity.

## Problem

The project needed a "paste an article, get a puzzle" path that works
offline, keeps the text in the browser, picks words that make good
crossword entries (content words, not "the" or "said"), and can supply
clues without any AI: a clue a solver can actually answer from context.

## Goals

- Candidate extraction runs entirely in the browser, with no network.
- Function words and weak verbs are filtered; plurals merge into one
  entry (`ships`/`ship` count together); proper nouns are recognised.
- Ranking favors frequency and prominence (position in the text).
- Cloze clues are answerable: the word's own sentence, with the word
  blanked.
- Blank replacement is whole-word and case-insensitive — `CARE` never
  blanks inside `CAREFUL`.
- Usable in Node for testing (pure logic, no DOM).

## Non-Goals

- Understanding the text semantically (no NLP models, no embeddings).
- Summarisation, translation, or grammar-aware clue writing — that is
  the optional [AI clue writer](./ai-clues.md)'s job.
- Multi-language article support (English only).
- Automatic word selection without user review — the user always picks
  from a ranked list.

## Solution Overview

`js/extract.js` exposes `CW.Extract`:

1. **Normalise & split** — whitespace is collapsed; text is split into
   sentences with a punctuation-aware scanner.
2. **Tokenise** — words are uppercased A–Z tokens (3–12 letters).
3. **Filter** — a stopword list removes function words and weak
   verbs/nouns that would otherwise dominate any article.
4. **Merge** — plural surface forms (`-s`, `-es`, `ies→y`) fold into one
   entry with a combined count.
5. **Recognise proper nouns** — capitalised tokens that are not sentence
   starters are kept distinct.
6. **Rank** — by occurrence count and first-appearance prominence; the
   list is capped (60 candidates).
7. **Cloze** — for each chosen word, its sentence is located; the word
   is blanked with a word-boundary-safe, case-insensitive replacement;
   long sentences are windowed around the blank.

## Detailed Behavior

- The article panel shows a live "N words · M sentences" counter; very
  short texts are rejected at extraction.
- Candidate chips display occurrence counts (×3 etc.); selection tools
  are **Top 10 / All / None**, plus a hand-entry box for custom words
  (max 12 letters).
- Clue style select: **Auto** (AI when configured, else cloze), **Cloze
  from the text (offline)**, **AI article-style**.
- Cloze clues render as `From the text: "…the keeper trimmed the ______
  each dusk"`, with the surrounding text windowed for very long
  sentences.
- Selecting zero candidates blocks generation.

## User Experience

![Article mode with candidates](../../img/article-candidates-en.webp)

Paste → counter updates → click **Extract candidate words** → tick
words → optionally add custom words → choose clue style → **Generate
crossword**. The whole flow is a few seconds and works with the network
cable unplugged.

## Compatibility and Historical Impact

No historical behavior is affected. Article mode was introduced together
with the builder's word-list mode; the word-list path is unchanged by
this feature.

## Data and Privacy Impact

The pasted article is stored locally (localStorage `cw-draft` while
editing) and processed in-memory. No extraction-related request is ever
sent. Only if the user explicitly selects **AI article-style** clues
does an excerpt leave the browser — see
[AI clue writing](./ai-clues.md) and [Privacy](../privacy.md).

## Performance Impact

Extraction of a multi-thousand-word article is effectively instantaneous
(single pass over tokens, no models). No impact on page load.

## Current Limitations

- English morphology only; irregular plurals and inflections beyond the
  `-s/-es/-ies` rules are treated as distinct words.
- Proper-noun detection is heuristic.
- Cloze clues answer themselves by design (the sentence is the context);
  they are practice material, not competition-grade clues.
- The stopword list is curated; some borderline words may pass or be
  filtered unexpectedly.

## Release Information

- Introduced: v1.2.0
- Status: Stable

## Related Documentation

- [Usage — build from an article](../usage.md#build-a-puzzle-from-an-article)
- [AI clue writing](./ai-clues.md)
- [Generation engine](./generation-engine.md)
- [Privacy](../privacy.md)

## Feature Changelog

### v1.2.0

- Initial release: local extraction (stopwords, plural merging, proper
  nouns, ranking, 60-candidate cap) and offline cloze clues with
  whole-word-safe blanking; covered by 29 assertions in
  `test/extract-test.js` and the article flow in `test/dom-test.js`.
