# Deployment

Crossword Studio is a folder of static files. There is no backend, no
build step, and no environment configuration — deploying means copying
the folder to any static host.

## What to upload

The repository root is the deployable artifact:

```
index.html
css/
js/
vendor/        (needed only for the donation dialog's QR rendering)
img/donate/    (only if you keep the README's static QR section)
docs/          (optional — documentation, not needed by the app)
```

Minimum viable deployment: `index.html`, `css/`, `js/`, `vendor/`. The
app itself references nothing else at runtime (`docs/` and `img/donate/`
are for humans).

## GitHub Pages (current hosting)

The live demo runs on GitHub Pages:
<https://petrel2015.github.io/crossword-studio/>

To publish or update it:

1. Push the files to the `main` branch of the GitHub repository.
2. In the repository: **Settings → Pages** → Source: deploy from a
   branch → `main` / root.
3. First publish takes a minute or two; updates usually propagate in
   under a minute.

No subpath adjustments are needed: every asset in `index.html` is
referenced with a relative path (`css/style.css`, `js/*.js`,
`vendor/qrcode.min.js`), so the app works identically at a domain root
and at a `/repo-name/` subpath.

## Other static hosts

| Host | How |
| --- | --- |
| Netlify / Vercel | Drag-and-drop the folder, or connect the repo; no build command, publish directory = repository root |
| Object storage (S3 / OSS / COS) | Upload the files, enable static website hosting, set `index.html` as the index document |
| Any web server (nginx, Apache, Caddy) | Copy the folder into the served directory — that is all |
| Internal file share | The folder works from a plain file share; users can even open `index.html` directly via `file://` |

No server-side rewrite rules, MIME overrides or SPA fallbacks are
required — it is a single page with relative assets.

## Cache busting

The app is small and has no hashed asset filenames. If your host
aggressively caches, either set a short TTL for `index.html` or bump the
version query on the stylesheet link (the repository uses
`css/style.css?v=20260827` during development for exactly this reason).

## After-deploy checklist

- [ ] Open the site — the masthead renders and no console errors appear.
- [ ] Load the sample → **Generate crossword** → the grid appears.
- [ ] Type a letter, run **Check**, refresh the page — progress returns.
- [ ] **Share** → open the copied link in a private window — the same
      puzzle loads.
- [ ] **Print / PDF** → the preview renders → the print dialog opens.
- [ ] Footer ☕ → the donation dialog opens and the QR renders (this
      verifies `vendor/qrcode.min.js` uploaded correctly).

## HTTPS and AI clues

AI clue writing calls your configured endpoint directly from the browser.
If you configure an `https://` AI endpoint, the page should also be
served over HTTPS (mixed-content requests from an HTTP page are
blocked). The GitHub Pages demo is HTTPS by default. Providers that
disallow browser CORS calls cannot be reached from any hosting — that is
a provider-side restriction, not a deployment issue.
