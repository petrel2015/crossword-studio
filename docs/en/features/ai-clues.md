# AI Clue Writing

## Summary

Optional crossword-clue writing against any OpenAI-compatible
`/chat/completions` endpoint: dictionary-style clues in word-list mode,
article-anchored clues in article mode, styled by difficulty.

## Background

Good clues are the hardest part of a puzzle for non-experts. Blank clues
are honest but require the user to write every one. Many users already
have access to an LLM endpoint; the natural design is to let them bring
their own endpoint and key, rather than shipping a bundled (and
billable, and privacy-complicating) proxy.

## Problem

The project needed clue writing that (a) requires no server of its own,
(b) never sends anything beyond the minimum needed for the task,
(c) degrades gracefully — the app must be fully useful with no AI at
all, and (d) produces clues in a consistent, newspaper-like style that
never leaks the answer word.

## Goals

- Works with any OpenAI-compatible endpoint (OpenAI, DeepSeek, Volcengine
  Ark, local Ollama…); user enters base URL, key and model.
- Word-list mode: fills only entries whose clue is still empty.
- Article mode: clues anchored in the article — citing scenes, roles and
  phrasing, mimicking its tone.
- Clue style follows difficulty (easy = plain and friendly; medium =
  broadsheet with light wordplay; hard = misdirection and puns).
- Batching with progress feedback; a failed batch never aborts others.
- Guardrails: never include the answer (or a direct stem) in its clue;
  single-line clues with a word cap; strict JSON responses.

## Non-Goals

- Bundling or proxying any provider, or shipping a default endpoint/key —
  the user always configures their own.
- Generating the puzzle, words, or extraction with AI — generation stays
  local and deterministic ([generation engine](./generation-engine.md)).
- Model choice guidance, quality scoring, or answer validation of clue
  text beyond the guardrails.
- Offline clue generation (that is what
  [cloze](./article-extraction-cloze.md) is for).

## Solution Overview

`js/ai.js` exposes `CW.AI`:

- `fillClues(words, difficulty)` — word-list mode; sends only the
  clue-less words, one per line; expects strict JSON
  `{"clues":{"WORD":"clue",…}}`.
- `cluesFromArticle(article, words, difficulty, onProgress)` — article
  mode; sends the (truncated) article plus each batch of words; batches
  of 20 run sequentially with a progress callback; per-batch failures
  are collected, not fatal.
- `chatJSON` — POST `<baseUrl>/chat/completions` with
  `response_format: {type: "json_object"}`; transport/auth failures are
  surfaced as readable errors (HTTP status, provider message, CORS
  hint).
- The article excerpt is capped at 12,000 characters (first 9,000 + last
  3,000).

## Detailed Behavior

- Settings (base URL, key, model) are saved to localStorage `cw-ai` and
  sent only to that endpoint.
- "Write missing clues with AI" appears only in word-list mode; in
  article mode the clue-style select governs.
- Requested answers are normalised to uppercase for matching; clues the
  model returned for unrequested words are discarded.
- Selecting **AI article-style** without configuration blocks generation
  with a toast; **Auto** falls back to cloze silently.
- If a whole run fails (all batches), the error is surfaced; partial
  success keeps the partial results.

## User Experience

Configure once via **AI Settings** (top right): base URL, key, model,
Save. Then it is a checkbox ("Write missing clues with AI") or a clue
style; a progress line shows batches completing in article mode. Results
land in the clue fields, where every clue remains hand-editable.

## Compatibility and Historical Impact

No historical behavior is affected. AI is strictly additive: with no
configuration the app behaves exactly as if the feature did not exist —
blank editable clues and offline cloze.

## Data and Privacy Impact

- Adds the app's only outbound request: POST to the user-configured
  endpoint.
- Payload is minimal by design: clue-less words, or article excerpt +
  selected words. The API key is stored in localStorage (`cw-ai`) and
  sent as a Bearer header.
- Nothing else (progress, other puzzles, history) is transmitted. Full
  audit: [Privacy](../privacy.md).

## Performance Impact

Bounded by the provider's latency; batches run sequentially so a 60-word
article set makes at most 3 requests. There is no impact on page load
(the module is passive until invoked).

## Current Limitations

- Endpoints that disallow browser CORS calls cannot work from any
  hosting — a provider-side restriction, reported honestly by a toast.
- Clue quality depends on the model; the guardrails reduce but do not
  eliminate occasional answer leakage or awkward clues — every clue
  stays editable.
- The 20-word batch and 12,000-character caps are fixed; very long
  articles are windowed, so mid-article scenes outside the window are
  not visible to the model.

## Release Information

- Introduced: v1.2.0
- Status: Stable

## Related Documentation

- [Usage — AI clues](../usage.md#ai-clues)
- [Article extraction & cloze](./article-extraction-cloze.md)
- [Privacy](../privacy.md)

## Feature Changelog

### v1.2.0

- Initial release: OpenAI-compatible client, dictionary-style and
  article-anchored modes, difficulty-styled prompts, JSON-mode parsing,
  20-word batching with progress, CORS-aware error messages. Exercised
  end-to-end in `test/dom-test.js` (offline paths: unconfigured
  guardrails and fallbacks).
