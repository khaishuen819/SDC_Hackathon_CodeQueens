# Frontend (M1)

Plain HTML, CSS and JavaScript (ES modules). No build step and no dependencies.
Design and decisions: [DESIGN.md](DESIGN.md). API shapes: `src/server/contracts/examples.ts` (M2).

## Files

| Path | What it is |
|---|---|
| `public/index.html` | Page shell: header, step bar, `#app` |
| `public/styles.css` | Metro-map theme (colour tokens at the top) |
| `public/js/app.js` | Screens, state and events |
| `public/js/api.js` | Calls to the backend and the error type |
| `public/js/profile.js` | Builds the confirmed profile from the review choices (pure) |
| `public/js/roadmap.js` | Stations and the winding map layout (pure) |
| `public/samples/` | Copies of the two FICTIONAL sample CVs from `docs/sample-cvs/` |
| `dev-server.mjs` | Local server: serves `public/`, forwards `/api` to the backend |
| `checks/` | Checks for `profile.js` and `roadmap.js` |

## Run locally

```
cd frontend
npm run dev        # http://localhost:5173, API = deployed Replit backend
npm test           # 10 checks, no network
```

Use a local backend instead: `API_TARGET=http://localhost:3000 npm run dev`.
The checks are named `*.check.mjs` so the backend's root `npm test` does not run them.

## Production (Option A)

Express serves `frontend/public` from the same Replit app, so the browser calls `/api/...` on the same
address and no CORS is needed. M2 adds one line to `server.ts`, after `app.use(apiRouter);`:

```ts
app.use(express.static("frontend/public"));
```

After pushing frontend changes: pull in Replit, then republish.
