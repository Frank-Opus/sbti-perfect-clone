# Cyber Meltdown Labels

A local, offline-runnable `赛博发疯标签系统` remake based on the original `https://sbti.unun.dev/`.

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

The first E2E run will install the Playwright Chromium binary automatically.

## Verify E2E

Run the local browser-based verification:

```bash
npm run test:fidelity
```

Direct script entry:

```bash
npm run test:e2e
```

## Publish

Deploy the current directory to Vercel production:

```bash
npm run deploy:prod
```

## Included

- `index.html`: the single-page cyber label quiz app
- `image/`: all poster assets used by the result page
- `.verify/`: local verification artifacts
- `scripts/viral-results-check.mjs`: deterministic browser-based E2E check
- `scripts/fidelity-check.mjs`: compatibility entry that forwards to the E2E check

## Notes

- This repo no longer targets source-vs-source visual parity.
- It now ships the rewritten 28-question `赛博发疯标签系统`, custom result logic, stage popups, and generated poster assets.
- Original author credit is preserved in the app, and Frank is listed as the remake maintainer.
