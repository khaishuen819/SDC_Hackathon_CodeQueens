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

How it runs: `npm start` → `node server.ts`. Node 24 strips TypeScript types and runs the file
directly, with no build step. So relative imports must end in `.ts`. `enum`, `namespace` and
constructor parameter properties are not allowed (only erasable syntax).

Type checking: `tsconfig.json` is check-only (`noEmit`). Run `npx tsc --noEmit` (TypeScript 7.0.2).

Tests: Node's built-in runner (`node --test`) finds and runs `*.test.ts` files on Node 24 with no
extra package (checked 2026-10-23). The `test` script is added in Phase 1, together with the first test.

Local install: `package-lock.json` was made on Replit. Its download URLs point to
`http://package-firewall.replit.internal`, which only exists inside Replit, so `npm ci` fails on a
laptop. Workaround used on 2026-10-23 (lockfile left unchanged): copy `package.json` and the lockfile to
a temp folder, rewrite `http://package-firewall.replit.internal/npm/` → `https://registry.npmjs.org/` in
the copy, run `npm ci` there, and move `node_modules` into the repo. The integrity hashes matched.
Open question for the team: should the lockfile use public URLs? (Replit regenerates it on install.)

Planned (not installed yet, versions to be filled in when added): Zod, Prisma, PostgreSQL on Neon (free tier),
Google Gemini SDK.

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

## Endpoints

(none implemented yet besides the existing `GET /health`)

## Progress checklist

- [ ] Phase 0: inspect repo, set up working notes
- [ ] Phase 1: API contract (Zod schemas, examples, validation test)
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
