# Privacy

What Crossword Studio stores, what it sends, and to where — audited
against the current code (`js/storage.js`, `js/promptgate.js`, `js/ai.js`,
`js/i18n.js`, `js/donation.js`). Claims below are limited to the app's own
behavior; see the caveat at the end.

## Summary

- No account, no analytics, no telemetry, no CDNs, no third-party fonts or
  scripts at runtime; the puzzles themselves never touch a server.
- Everything (your words, articles, puzzles, progress) lives in your
  browser's localStorage.
- The only outbound request the app can make is the AI clue request: by
  default to the built-in AI gateway (PromptGate, `api.fluffyeti.com`), or
  to your own OpenAI-compatible endpoint if you configure one in AI
  Settings. Without AI (manual clues / offline cloze) there is no outbound
  traffic at all.

## Local storage

All persistence is in `localStorage`, written only by `js/storage.js`
plus the language key in `js/i18n.js`:

| Key | Contents | Written when | Lifetime |
| --- | --- | --- | --- |
| `cw-progress:<puzzle-id>` | Your letters, reveal records, elapsed time, solved flag for one puzzle | While solving (debounced autosave) | Until you Reset the puzzle or clear site data |
| `cw-draft` | Builder form state: input mode, word list, article text, settings | As you edit the builder | Overwritten by the next draft; until cleared |
| `cw-current` | The last generated puzzle, so a refresh restores it | On every generate/edit | Overwritten by the next puzzle |
| `cw-ai` | AI provider choice (built-in / custom) plus the custom endpoint's base URL, API key, model name | When you save AI Settings | Until you change or clear it |
| `cw-lang` | Chosen UI language (`en` / `zh-CN`) | When you switch language | Until you change or clear it |

To wipe everything the app knows about you: clear site data for the site
(or open it in a private window and simply close it).

## Network behavior

**Without AI, the app makes no network requests at all** beyond loading
its own static files. When AI clue writing is used (the word-list checkbox,
or the AI/Auto article style), it sends `POST …/chat/completions`
(OpenAI-compatible format) to the current AI service — the built-in
gateway by default, or your configured base URL:

- Sent: one user message containing the writing instruction, plus either
  - word-list mode: only the words whose clue is still empty, or
  - article mode: the article excerpt (windowed automatically to the
    built-in gateway's 2,000-character input cap) and the selected words.
    Batches of 6 words for the built-in service, 20 for custom endpoints.
- The `Authorization: Bearer` header carries the calling credential: for
  the built-in gateway a public caller identifier shipped with the app
  (not a secret — the gateway pins the model and quotas server-side); for
  custom endpoints, your API key.
- Requests are made by `js/promptgate.js` (gateway address) and `js/ai.js`.
  There is no other code path that calls `fetch`.
- Not sent: your solved progress, your other puzzles, browser history,
  or anything else.

The "Test connection" button sends one real AI request for a reachability
check. Failed AI requests are never auto-retried.

Clue-writing can also be avoided entirely: use your own clues or offline
cloze — the app is fully functional offline.

## Third-party interactions

- **Built-in AI gateway (PromptGate)** — the default clue-writing service.
  When used, the words or article excerpt you send reach
  `api.fluffyeti.com:61234`; the gateway rate-limits by IP with a daily
  quota, and pins the model and prompts server-side. Prefer to send
  nothing at all? Point AI Settings at a local model (e.g. Ollama) or skip
  AI entirely.
- **Custom AI endpoint** — the provider you configure in AI Settings; it
  receives the same minimal payload.
- **Donation dialog** — the QR codes are rendered locally by a vendored
  library (`vendor/qrcode.min.js`, lazy-loaded only when the dialog
  opens; no QR API is called). On a mobile device, tapping the Alipay
  tab may navigate your browser to the Alipay payment URL that is
  encoded in the QR (`https://qr.alipay.com/…`). That navigation goes to
  Alipay — it is the payment itself, not tracking.
- **Nothing else.** The app ships no analytics, no error reporting, no
  A/B testing, no embedded fonts or frameworks from CDNs.

## Permissions requested

None. The app never asks for geolocation, notifications, camera,
microphone, clipboard permissions, or service-worker registration.

## Things outside this project's control

- **Hosting provider** — whoever serves the static files sees standard
  access logs (URL, IP, timestamps). The GitHub Pages demo is subject to
  GitHub's logging.
- **AI provider** — if you use AI clues, the provider (built-in gateway or
  your custom endpoint) sees the words or article excerpt you send, and
  your API key (custom endpoints) authenticates you to them.
  Choose a provider you trust; for sensitive texts, use cloze or manual
  clues.
- **Your browser profile** — anyone with access to your computer can
  read your localStorage (puzzles, progress, and the AI key if saved).
  Clear site data before sharing a device, or use a private window.

There is deliberately no "100% private" promise here: the statements
above are the audited behavior of the code, not a guarantee about the
ecosystem around it.
