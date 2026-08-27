# Share Links

## Summary

The entire puzzle — title, difficulty, every entry with its clue, and
the unplaced words — is compressed into the URL hash (`#p=…`), so a
single link carries the whole puzzle with no server involved.

## Background

A crossword is a structured, compact object, but pasting a grid into
chat loses the interactivity; hosting puzzles on a server would require
accounts, storage and moderation. A URL is the one format every channel
(chat, email, LMS, printed QR) already carries.

## Problem

The project needed puzzle sharing that (a) requires zero infrastructure,
(b) survives every channel a URL can travel through, (c) cannot render a
silently broken grid if the payload is damaged, and (d) keeps URLs as
short as possible, because puzzles with 30+ entries and long clues are
still kilobytes of JSON.

## Goals

- One link = one puzzle; opening it restores a fully playable puzzle.
- Compression: gzip when the platform provides it.
- URL-safe by construction (base64url, no reserved characters).
- Tamper-evident: corrupted or hand-edited links fail loudly with a
  clear message instead of rendering a broken grid.
- Graceful degradation on engines without `CompressionStream`.

## Non-Goals

- Short URLs, puzzle IDs, or a redirect service (that would need a
  server).
- Storing solve progress in the link — progress is local per browser
  ([usage](../usage.md#solve-the-puzzle)).
- Signing or encrypting the payload — the hash is not a security
  boundary; validation exists to detect damage, not to enforce
  confidentiality (answers are inherently in the payload).
- Multiple puzzles per link.

## Solution Overview

`js/codec.js` exposes `CW.Codec`:

1. **Payload** — a minimal JSON shape, versioned (`v: 1`):
   `{t: title, d: difficulty, e: [[row, col, "a"|"d", answer, clue]…],
   u: [[answer, clue]…]}`.
2. **Encode** — JSON → UTF-8 → gzip (`CompressionStream`) → base64url,
   prefixed `G`; without `CompressionStream`, plain base64url prefixed
   `R`.
3. **Decode** — marker selects gzip or plain; JSON parse errors and
   version/shape violations throw readable errors ("Not a valid puzzle
   link", "Corrupted puzzle data").
4. **Validate** — the decoded puzzle is replayed through the same
   `buildLayout` validation engine the generator uses; only a consistent
   puzzle reaches the screen.

## Detailed Behavior

- The app keeps the URL hash in sync after every generation and edit
  (async, post-gzip); **Share** shows the current URL, or hands it to
  `navigator.share` where a native share sheet exists.
- Opening a link boots the app straight into the solve view.
- Unplaced words ride along in the payload, so the recipient sees the
  same honest failure list.
- Editing clues/title changes the hash; old links keep working (they are
  just older layouts).

## User Experience

Solve → **Share** → send. On phones the system share sheet appears;
on desktop a modal with the URL to copy. Recipients click and solve —
no account, no install, and the sender can delete their local copy
afterwards.

## Compatibility and Historical Impact

- Requires a channel that preserves the full URL hash (some chat apps
  truncate long URLs — see [troubleshooting](../troubleshooting.md)).
- The payload version field (`v: 1`) exists so future format changes can
  be detected and rejected with a clear message rather than mis-decoded.
- No historical behavior is affected.

## Data and Privacy Impact

- The payload contains the puzzle including **all answers** — share only
  with people who may see the solution (or print without the key).
- The link travels through whatever service carries it (chat providers,
  email); that transport is outside the app's control.
- No additional storage or network: encoding is pure computation, and
  opening a link makes no request beyond loading the page itself.

## Performance Impact

gzip + base64url keeps typical puzzle links at a few hundred to a few
thousand characters; encoding/decoding is milliseconds. Very dense
puzzles with long clues produce long links — inherent to serverless
sharing.

## Current Limitations

- Link length is bounded by whatever channel carries it, not by the app.
- No way to revoke or expire a shared puzzle — anyone with the link
  keeps it working.
- Answers are visible to a determined recipient (they are in the URL).

## Release Information

- Introduced: v1.2.0
- Status: Stable

## Related Documentation

- [Usage — share a puzzle](../usage.md#share-a-puzzle)
- [Architecture — share-link codec](../architecture.md#share-link-codec)
- [Generation engine](./generation-engine.md) (`buildLayout` validation)

## Feature Changelog

### v1.2.0

- Initial release: versioned JSON payload, gzip via
  `CompressionStream` with plain-base64url fallback, `buildLayout`
  replay validation, native-share integration. Round-trip covered in
  `test/dom-test.js` (share → fresh-window restore).
