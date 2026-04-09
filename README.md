# SBTI Perfect Clone

A local, offline-runnable clone of `https://sbti.unun.dev/`.

## Run locally

From this directory:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Included

- `index.html`: the fully cloned single-page app
- `image/`: all poster assets used by the result page
- `.verify/`: local screenshot verification artifacts

## Notes

- The UI, copy, quiz flow, scoring logic, and result rendering are cloned from the live site as of 2026-04-09.
- Cloudflare analytics was intentionally removed so the local clone does not report events to the original site.
