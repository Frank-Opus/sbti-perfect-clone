# SBTI Perfect Clone

A local, offline-runnable clone of `https://sbti.unun.dev/`.

## Run locally

From this directory:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Install verification tooling

```bash
npm install
```

The first fidelity run will install the Playwright Chromium binary automatically.

## Verify fidelity

Source-vs-local parity:

```bash
npm run test:fidelity
```

## Publish

Deploy the current directory to Vercel production:

```bash
npm run deploy:prod
```

## Included

- `index.html`: the fully cloned single-page app
- `image/`: all poster assets used by the result page
- `.verify/`: local screenshot verification artifacts
- `scripts/fidelity-check.mjs`: deterministic browser-based parity check

## Notes

- The UI, copy, quiz flow, scoring logic, and result rendering are cloned from the live site as of 2026-04-09.
- Cloudflare analytics was intentionally removed so the local clone does not report events to the original site.
- The analytics removal is the only intentional difference from the live source and does not affect user-visible behavior.
