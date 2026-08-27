# Troubleshooting

Real failure modes in Crossword Studio, with what to check in order.
Anything not covered here →
[open an issue](https://github.com/petrel2015/crossword-studio/issues).

## Builder / generation

### "My words were ignored"

Look directly under the word-list box: each problem is listed with a
reason.

1. **"minimum 3"** — the word has fewer than 3 letters (after stripping
   non-A–Z characters).
2. **Duplicate** — the word appears more than once; only the first
   counts.
3. **Spaces issue** — the entry contains internal spaces.
4. Check the counter below the box: "12 words · 8 with clues" style
   feedback shows what was actually parsed.

Fix: one word per line, 3–12 A–Z letters, no duplicates.

### "Generate does nothing in Article mode"

1. You must select at least one candidate word (checkboxes or
   **Top 10 / All**). Generating with zero selected is blocked by design.
2. Very short articles are rejected at extraction; paste a longer text
   (a paragraph or more).
3. If you picked **AI article-style** without configuring AI, a toast
   explains the problem and you stay in the builder — switch clue style
   to **Cloze from the text (offline)** or **Auto**.

### "Some words are listed under the grid and missing from it"

That is honest failure reporting, not a bug. The reasons mean:

| Reason | Meaning | What to do |
| --- | --- | --- |
| *Shares no letters with the placed words* | No crossing is possible | Add connecting words, or drop the word |
| *No valid position — every crossing conflicts* | Crossings exist but all collide | Click **Regenerate** (new seed), or remove/replace a word |
| *Longer than the N×N grid limit for this difficulty* | The word exceeds this difficulty's grid cap | Switch difficulty (Hard allows bigger grids) |

## Solving

### "Typing does nothing"

1. Click a cell first — the app needs a selected cell (the current word
   and cell are highlighted).
2. On touch devices the on-screen keyboard should appear; if it does
   not, tap a cell again.
3. `file://` usage can interact badly with some browser extensions —
   try a served copy (`python3 -m http.server 8741`).

### "My progress disappeared"

Progress is stored per browser profile in localStorage, keyed by the
puzzle's layout+answers. It does not survive:

- clearing site data / private-browsing sessions,
- **regenerating** the puzzle (new layout = fresh progress),
- opening the puzzle from a *different* link layout.

Editing clues or the title never resets progress.

### "The timer kept running while I was away"

The timer measures elapsed time since first entry, not active time. Use
**Reset** to start over.

## Printing / PDF

### "The print output doesn't match the preview"

It should — the preview is the exact print DOM. If your browser's print
dialog shows something else:

1. Make sure scale is set to **100 % / Default margins** in the print
   dialog.
2. Disable headers/footers (browser-added URL/date) if you want the pure
   sheet look.
3. Only the A4 pages built by the modal are printed; the app UI is
   hidden by print CSS. If UI elements leak into the preview, you have an
   old cached `style.css` — hard-refresh (Ctrl/Cmd+Shift+R).

### "Export PDF" is greyed out or missing

"Export PDF" is your browser's *Save as PDF* destination in the print
dialog — Chrome/Edge call it "Save as PDF". The app does not bundle a
PDF renderer.

## Sharing

### "The link opens an error instead of the puzzle"

The `#p=` payload failed validation. Causes:

1. The link was truncated by a chat/messaging app — copy the full URL.
2. Someone edited the hash by hand — any change breaks the gzip stream.
3. The sharer regenerated the puzzle after copying the link; each layout
   is its own link.

Ask for a fresh link via **Share**.

### "The link works for me but shows an older puzzle for a friend"

You shared a link from a previous generate/edit step. Copy a fresh one —
the hash changes with every edit.

## AI clues

### "AI request failed (HTTP 401/403/404)"

1. **401/403** — wrong or unauthorized API key; check the key and its
   quota/permissions.
2. **404** — wrong base URL. The app appends `/chat/completions` to your
   Base URL, so the Base URL must end *before* that path (e.g.
   `https://api.openai.com/v1`).
3. **"Could not reach the AI endpoint"** — network failure or CORS. Some
   providers block browser calls entirely; use a CORS-friendly endpoint
   or keep clues manual. This is a provider-side restriction — nothing in
   the app (or the hosting) can bypass it.

### "AI clues only filled some words"

Batching is 20 words per request and a failed batch never aborts the
others — partial results are kept. Click generate/AI-fill again to retry
the remainder, or write those clues by hand.

## Donation dialog

### "The QR code doesn't appear"

The dialog lazy-loads `vendor/qrcode.min.js`. If the QR area stays empty:

1. Verify `vendor/` was uploaded with the rest of the files.
2. Check the browser console for a script 404.
3. On mobile, the Alipay tab may have jumped to the payment app — coming
   back shows the QR fallback.

## Language / display

### "The interface is in the wrong language"

Switch at the top right (EN / 中文). The default is: your saved choice,
then your browser language. If the buttons don't respond, hard-refresh —
an old cached `i18n.js` with a new `index.html` (or vice versa) can
desynchronize the dictionaries.

## Reporting a bug

Include: browser and OS, the steps to reproduce, what you expected, a
screenshot, and (for generation bugs) the exact word list or article.
Console errors (F12 → Console) are almost always decisive.
