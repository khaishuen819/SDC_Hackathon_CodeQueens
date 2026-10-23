# M2 technical notes (backend and deployment)

Owner: M2. Scope: features 1 (CV extraction + profile confirmation), 3 (role matching),
4 (learning pathway), 5 (SDG mapping), plus the API slot for feature 2 (trend evidence, M3/M4).

## Stack and versions

Installed today (from `package.json` / `package-lock.json`):

| Package | Range in package.json | Locked version |
|---|---|---|
| Node.js | `engines: >=24` (Replit module `nodejs-24`) | local: v24.14.1 |
| express | ^5.3.0 | 5.3.0 |
| typescript | ^7.0.2 | 7.0.2 |
| @types/express | ^5.0.6 | 5.0.6 |
| @types/node | ^26.6.5 | 26.6.5 |
| zod | ^4.6.7 | 4.6.7 (MIT licence; added Phase 1) |

How it runs: `npm start` → `node server.ts`. Node 24 strips TypeScript types and runs the file
directly, with no build step. So relative imports must end in `.ts`. `enum`, `namespace` and
constructor parameter properties are not allowed (only erasable syntax).

Type checking: `tsconfig.json` is check-only (`noEmit`). Run `npm run typecheck` (TypeScript 7.0.2).

Tests: `npm test` runs Node's built-in runner (`node --test`), which finds every `*.test.ts` file.
No extra test package.

Local install: `package-lock.json` was made on Replit. Its download URLs point to
`http://package-firewall.replit.internal`, which only exists inside Replit, so `npm ci` fails on a
laptop. Workaround used on 2026-10-23 (lockfile left unchanged): copy `package.json` and the lockfile to
a temp folder, rewrite `http://package-firewall.replit.internal/npm/` → `https://registry.npmjs.org/` in
the copy, run `npm ci` there, and move `node_modules` into the repo. The integrity hashes matched.
Decision (2026-10-23): the lockfile should use public registry URLs. New packages are installed with
`npm install` on M2's laptop. Note: `npm install` keeps the old Replit URLs for packages already
in the lockfile; only new packages get public URLs.

Planned (not installed yet, versions to be filled in when added): Prisma, PostgreSQL on Neon (free tier),
Google Gemini SDK, a PDF text library, a multipart upload library.

## Decisions

| Date | Decision | Reason |
|---|---|---|
| 2026-10-23 | Keep the existing Replit-generated Express server; do not recreate it. | It already runs on Replit; smallest change is safest. |
| 2026-10-23 | Stack: Node, TypeScript, Express, Zod, Prisma, PostgreSQL (Neon). | M2's choice: typed end to end, free hosted DB, Zod gives runtime validation of API input. |
| 2026-10-23 | Gemini for CV extraction, behind an adapter with a mock implementation. | Provider can change later; app and tests run without an API key. |
| 2026-10-23 | Draft and confirmed profiles are separate types. | Product rule: only the graduate-confirmed profile drives matching and pathways. |
| 2026-10-23 | CVs processed in memory only, never stored. | Privacy: we do not need to keep CVs. |
| 2026-10-23 | Run with plain `node server.ts` (native type stripping); no tsx, no build step. | Fewer tools; Node 24 supports it. Revisit only if a real problem appears. |
| 2026-10-23 | `tsconfig.json` for type checking only: `noEmit`, `module: nodenext`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `verbatimModuleSyntax`, `strict`, `types: ["node"]`. | Makes the editor and `tsc --noEmit` follow the same rules Node uses when it strips types. |
| 2026-10-23 | Tests use Node's built-in `node --test`. | No extra test tool to install or explain. |
| 2026-10-23 | `.gitignore`: added `.env`, `.env.*` (except `.env.example`), `dist/`, `.DS_Store`. | Keep secrets and local junk out of git. |
| 2026-10-23 | Zod 4 for API contracts, in `src/server/contracts/`. One schema gives both runtime validation and the TypeScript type. | No duplicate type definitions; bad input is rejected with a clear message. |
| 2026-10-23 | IDs are lowercase slug strings checked by regex, not Zod brands. | Simple: example JSON and DB rows work as they are. |
| 2026-10-23 | Draft and confirmed profiles carry `status: "draft"` / `"confirmed"`. | A draft is rejected if sent where a confirmed profile is needed. |
| 2026-10-23 | Confirmed profile checks: `preferredRouteId` required for `preferred-route`; added skills must be in `confirmedSkills`; a skill is in only one of confirmed / removed / unconfirmed. | Catches contradictory input early. |
| 2026-10-23 | Match score is a whole number 0 to 100. Every match response includes the fixed `scoreMeaning` text. | Easy to read; the "not a hiring probability" message cannot be left out. |
| 2026-10-23 | Resources and SDG tags carry `isPlaceholder`. | Unreviewed content is always visibly marked. |
| 2026-10-23 | Added an `EvidenceId` type and `EvidenceRef` (`{ evidenceId }`) for pathway steps. | Evidence items need their own ID; an object can grow without breaking M1. |
| 2026-10-23 | One error shape `{ error: { code, message, details? } }` with a fixed HTTP status per code (see Endpoints). | Every route fails the same way, so the frontend needs one error handler. |

## Endpoints

Schemas: `src/server/contracts/` (import from `index.ts`). Fictional JSON examples for each request and
response: `src/server/contracts/examples.ts`. Status "planned" means the contract exists but the route does not yet.

| Method + path | Request | Response | Feature | Status |
|---|---|---|---|---|
| GET /health | none | `{ status: "ok" }` | setup | done (Replit Agent) |
| POST /api/profile/extract | multipart upload, field `cv` (PDF or .txt, max 2 MB) | `DraftProfile` | 1 | planned, Phase 3 |
| POST /api/match | `MatchRequest` (= `ConfirmedProfile`) | `MatchResponse` | 3 | planned |
| POST /api/pathway | `PathwayRequest` (`{ profile, roleId }`) | `PathwayResponse` | 4 | planned |
| GET /api/roles | none | roles with skills and weights, plus a placeholder flag | 3 | planned, Phase 2 |
| GET /api/sdg | none | `SdgResponse` | 5 | planned |
| GET /api/evidence | none | `EvidenceListResponse` (contract PROPOSED, to agree with M3/M4) | 2 (M3/M4) | planned |

Errors (all endpoints): body is `ApiError`, `{ "error": { "code", "message", "details"? } }`.

| Code | HTTP | When |
|---|---|---|
| INVALID_INPUT | 400 | body or query failed validation |
| NOT_FOUND | 404 | unknown route, role or skill |
| FILE_TOO_LARGE | 413 | upload over 2 MB |
| UNSUPPORTED_FILE | 415 | not PDF or plain text |
| UNREADABLE_CV | 422 | no text could be read (never an empty profile) |
| LLM_FAILED | 502 | model returned bad JSON, or the provider failed |
| LLM_TIMEOUT | 504 | model did not answer in time |

Match buckets (provisional, to confirm with M1): for each role skill, it is a **strength** if it is in
`confirmedSkills`, **unconfirmed** if it is in `unconfirmedSkillIds`, otherwise a **gap**.

## Progress checklist

- [x] Phase 0: inspect repo, set up working notes
- [x] Phase 1: API contract (Zod schemas, examples, validation test)
- [ ] Phase 2: database schema and placeholder seed (Prisma + PostgreSQL), `GET /api/roles`
- [ ] Phase 3: CV upload and extraction (`POST /api/profile/extract`)

## Data, licences and privacy notes

- CVs are processed in memory only. They are not written to disk, stored in the database, or logged.
- All CVs and profiles used in development, tests and demos are fictional.
- Seeded content (roles, skills, resources) is placeholder until replaced by reviewed data,
  and is flagged `isPlaceholder` in the database.
- No real sources, courses, links or statistics are invented. Trend evidence comes from M3/M4.
- Repository licence: Apache 2.0 (`LICENSE`). Third-party library licences are recorded here as libraries are added.

## AI assistance log

- Replit Agent: scaffolded minimal Express + TypeScript server with GET /health and Replit config (commits ca8551b, 9671391).
- Claude Code: used for M2 backend development, phase by phase; all code reviewed and committed by M2.
