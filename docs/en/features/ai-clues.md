# AI Clue Writing

## Summary

AI clue writing uses the built-in PromptGate gateway by default — zero
setup — and can be switched to any OpenAI-compatible
`/chat/completions` endpoint: dictionary-style clues in word-list mode,
article-anchored clues in article mode, styled by difficulty, degrading
gracefully with no auto-retry.

## Background

Good clues are the hardest part of a puzzle for non-experts. Blank clues
are honest but require the user to write every one. The v1.2 design let
users bring their own LLM endpoint, but the setup cost (finding a base
URL, obtaining a key) stopped most people. The project owner now operates
a PromptGate gateway (OpenAI-compatible, model and quotas pinned
server-side, public caller identifier), which makes clue writing work out
of the box while the bring-your-own-endpoint option remains as an
override.

## Problem

The project needed clue writing that (a) keeps the front end static with
no self-hosted backend to maintain, (b) never sends anything beyond the
minimum needed for the task, (c) degrades gracefully — the app must be
fully useful with no AI at all, and (d) produces clues in a consistent,
newspaper-like style that never leaks the answer word, while (e) fitting
the gateway's hard limits — ≤ 2,000 characters of message content per
request, ≤ 200 output tokens, 20 requests/min/IP, and a daily
request/token circuit breaker.

## Goals

- Built-in gateway as the default provider: works with zero
  configuration; gateway address and caller identifier centralised in
  `js/promptgate.js` for easy rotation.
- Override: any OpenAI-compatible endpoint (OpenAI, DeepSeek, Volcengine
  Ark, local Ollama…); user enters base URL, key and model.
- Word-list mode: fills only entries whose clue is still empty.
- Article mode: clues anchored in the article — citing scenes, roles and
  phrasing, mimicking its tone.
- Limit-aware batching: 6 words per batch for the built-in service
  (200-token output cap ÷ ~30 tokens per clue) with the article windowed
  to the remaining budget (~60% head + ~40% tail); custom endpoints keep
  20-word batches and the 12,000-character excerpt.
- Pacing: sequential built-in batches are forced ≥ 3.2 s apart, safely
  under the 20 req/min limit.
- Clue style follows difficulty (easy = plain and friendly; medium =
  broadsheet with light wordplay; hard = misdirection and puns).
- Guardrails: never include the answer (or a direct stem) in its clue;
  single-line clues with a word cap; tolerant parsing of model output
  (markdown fences stripped, JSON body extracted).

## Non-Goals

- No bundling or proxying of arbitrary models — the built-in gateway
  serves one fixed crossword persona with fixed quotas; for other models
  use a custom endpoint.
- No `role: "system"` messages from the front end (the gateway strips
  them, wasting character quota) — instructions always fold into the
  user message.
- No auto-retry or exponential backoff — the gateway counts every
  request that enters its pipeline against rate limits and daily quota;
  failures are surfaced to the user, who decides when to retry.
- Generating the puzzle, words, or extraction with AI — generation stays
  local and deterministic ([generation engine](./generation-engine.md)).
- Model choice guidance, quality scoring, or answer validation of clue
  text beyond the guardrails.
- Offline clue generation (that is what
  [cloze](./article-extraction-cloze.md) is for).

## Solution Overview

`js/promptgate.js` centrally defines `BASE_URL` / `API_KEY` (a public
caller identifier — the server pins model, prompts, output cap and
quotas, so leaking it is harmless by design) and the model alias.
`js/ai.js` exposes `CW.AI`:

- `resolveConfig(shape)` — turns a stored shape (`{provider, baseUrl,
  model, apiKey}`; legacy saves are treated as custom) into a full
  provider profile. builtin: 6-word batches, 2,000−100-char input
  budget, 3.2 s pacing, strict request body (`model` + `messages` only);
  custom: 20-word batches, 14,000-char budget, adds `temperature` and
  `response_format`.
- `fillClues(words, difficulty)` / `cluesFromArticle(article, words,
  difficulty, onProgress)` — a shared `runBatches` loop; per-batch
  failures are collected and partial success is kept; only a total
  failure throws.
- `request(cfg, content, timeoutMs)` — POST `<baseUrl>/chat/completions`,
  Bearer auth, non-streaming; an AbortController bounds the wait (125 s
  for chat, above the gateway's 120 s upstream timeout; 20 s for ping);
  errors are normalised into a `kind` (`unavailable` / `unreachable` /
  `daily` / `rate` / `upstream` / `badrequest` / `badresponse` /
  `timeout` / `http`); network failures are detected via
  `err.name === 'TypeError'` (cross-realm safe).
- `friendlyError(err)` — maps `kind` to a UI-language message (built-in
  unreachable/auth failure → "The AI settings are unavailable — please
  check the configuration"; daily quota → "try again tomorrow";
  rate-limited → "wait about a minute"; upstream → "retry later").
- `ping(cfg)` — the single real request behind the settings dialog's
  "Test connection" button.

## Detailed Behavior

- Settings are stored in localStorage `cw-ai` as `{provider: 'builtin'}`
  or `{provider: 'custom', baseUrl, apiKey, model}`; the v1.2 shape
  (bare baseUrl etc.) migrates automatically to custom, so existing
  setups keep working.
- The built-in service always counts as configured; custom needs
  baseUrl + model.
- Word-list mode: an AI failure toasts and generation continues with
  blank, editable clues. Article mode "Auto" style: a total AI failure
  falls back to cloze for all words; "AI article-style" failure leaves
  blank editable clues.
- Requested answers are normalised to uppercase for matching; clues the
  model returned for unrequested words are discarded; parsing tolerates
  fences and surrounding prose.
- Article windowing: budget = input cap − instruction − word list (100
  characters of headroom), split ~60% head + ~40% tail with an `[…]`
  marker between.

## User Experience

**AI Settings** (top right): a radio choice between "Built-in AI service
— works out of the box" and "Custom OpenAI-compatible endpoint" (the
latter reveals base URL / model / key), plus a **Test connection** button
that verifies the current selection inline (✓ on success, the matching
failure message otherwise). The builder status line reads "AI clues:
built-in service" or the model name. Day to day it stays a checkbox
(word-list mode) or a clue-style select with batch progress (article
mode); results land in the clue fields, where every clue remains
hand-editable.

## Compatibility and Historical Impact

- Fresh users with no configuration: AI moves from "unavailable" to
  "works out of the box".
- Users who configured a custom endpoint on v1.2: migrated to the custom
  provider automatically, behavior unchanged.
- AI stays strictly additive: with AI completely down the app behaves
  exactly as if the feature did not exist — blank editable clues and
  offline cloze.

## Data and Privacy Impact

- Adds the app's only outbound request: POST to the built-in gateway
  (default) or the custom endpoint.
- Payload is minimal by design: clue-less words, or a windowed article
  excerpt + selected words, folded into a single user message; no system
  message is sent. Custom API keys are stored in localStorage (`cw-ai`)
  and sent as a Bearer header; the built-in gateway's credential is a
  public identifier shipped with the source.
- Nothing else (progress, other puzzles, history) is transmitted. Full
  audit: [Privacy](../privacy.md).

## Performance Impact

Bounded by the gateway and upstream latency; sequential 6-word batches
with 3.2 s pacing mean a 60-word article set is ~10 requests and ~40
seconds at best — the progress line reports honestly. There is no impact
on page load (the module is passive until invoked).

## Current Limitations

- The built-in gateway's 200-token output cap forces small batches (6
  words) and compresses long articles to a ~1,300-character window, so
  mid-article scenes outside the window are not visible to the model.
- The daily circuit breaker (2,000 requests / 100k tokens, reset at the
  gateway's local midnight) is shared globally, so "today's quota is
  used up" can arrive early at peak times.
- Custom endpoints that disallow browser CORS calls cannot work from any
  hosting — a provider-side restriction, reported honestly by a toast.
- Clue quality depends on the model; the guardrails reduce but do not
  eliminate occasional answer leakage or awkward clues — every clue
  stays editable.

## Release Information

- Introduced: v1.2.0 (bring-your-own endpoint)
- Built-in gateway default: Unreleased (shipping with the next release)
- Status: Stable

## Related Documentation

- [Usage — AI clues](../usage.md#ai-clues)
- [Article extraction & cloze](./article-extraction-cloze.md)
- [Privacy](../privacy.md)

## Feature Changelog

### Unreleased

- Default integration with the PromptGate gateway: zero configuration;
  provider radio + "Test connection"; adaptive 6-word batching within a
  2,000-character input budget; rate-limit pacing; friendly error
  mapping (including "The AI settings are unavailable — please check the
  configuration"); 125 s chat / 20 s ping timeout bounds; "Auto" style
  falls back to cloze on total AI failure; tolerant JSON parsing (fence
  stripping). `test/dom-test.js` covers request shape, batching, error
  mapping and fallbacks end-to-end via a fetch stub.

### v1.2.0

- Initial release: OpenAI-compatible client, dictionary-style and
  article-anchored modes, difficulty-styled prompts, JSON-mode parsing,
  20-word batching with progress, CORS-aware error messages. Exercised
  end-to-end in `test/dom-test.js` (offline paths: unconfigured
  guardrails and fallbacks).
