# Privacy

What Crossword Studio stores, what it sends, and to where — audited
against the code at v1.2.0 (`js/storage.js`, `js/ai.js`, `js/i18n.js`,
`js/donation.js`). Claims below are limited to the app's own behavior;
see the caveat at the end.

## Summary

- No server, no account, no analytics, no telemetry, no CDNs, no
  third-party fonts or scripts at runtime.
- Everything (your words, articles, puzzles, progress) lives in your
  browser's localStorage.
- The only outbound request the app can make is the optional AI clue
  request to the endpoint you configure yourself.

## Local storage

All persistence is in `localStorage`, written only by `js/storage.js`
plus the language key in `js/i18n.js`:

| Key | Contents | Written when | Lifetime |
| --- | --- | --- | --- |
| `cw-progress:<puzzle-id>` | Your letters, reveal records, elapsed time, solved flag for one puzzle | While solving (debounced autosave) | Until you Reset the puzzle or clear site data |
| `cw-draft` | Builder form state: input mode, word list, article text, settings | As you edit the builder | Overwritten by the next draft; until cleared |
| `cw-current` | The last generated puzzle, so a refresh restores it | On every generate/edit | Overwritten by the next puzzle |
| `cw-ai` | AI base URL, API key, model name | When you save AI Settings | Until you change or clear it |
| `cw-lang` | Chosen UI language (`en` / `zh-CN`) | When you switch language | Until you change or clear it |

To wipe everything the app knows about you: clear site data for the site
(or open it in a private window and simply close it).

## Network behavior

**By default the app makes no network requests at all** beyond loading
its own static files. With AI configured, exactly one request type is
added:

- `POST <your-base-url>/chat/completions` (OpenAI-compatible format)
- Sent: the system prompt, plus either
  - word-list mode: only the words whose clue is still empty, or
  - article mode: the article excerpt (truncated to the first 9,000 +
    last 3,000 characters if longer than 12,000) and the selected words,
    in batches of 20 words.
- The `Authorization: Bearer` header carries your API key.
- Not sent: your solved progress, your other puzzles, browser history,
  or anything else. There is no other code path that calls `fetch`.

Clue-writing can also be avoided entirely: leave AI unconfigured and use
your own clues or offline cloze — the app is fully functional offline.

## Third-party interactions

- **AI endpoint** — the one described above; you choose the provider.
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
- **AI provider** — if you use AI clues, the provider sees the words or
  article excerpt you send, and your API key authenticates you to them.
  Choose a provider you trust; for sensitive texts, use cloze or manual
  clues.
- **Your browser profile** — anyone with access to your computer can
  read your localStorage (puzzles, progress, and the AI key if saved).
  Clear site data before sharing a device, or use a private window.

There is deliberately no "100% private" promise here: the statements
above are the audited behavior of the code, not a guarantee about the
ecosystem around it.
