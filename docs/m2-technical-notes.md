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
| @prisma/client | 7.10.1 (exact) | 7.10.1 (Apache-2.0; Phase 2) |
| @prisma/adapter-pg | 7.10.1 (exact) | 7.10.1 (Apache-2.0; Phase 2) |
| pg (node-postgres) | ^8.23.1 | 8.23.1 (MIT; Phase 2) |
| prisma (CLI, dev) | 7.10.1 (exact) | 7.10.1 (Apache-2.0; Phase 2) |
| @types/pg (dev) | ^8.23.1 | 8.23.1 (MIT; Phase 2) |

Why Prisma 7.10.1 and not "latest": on 2026-10-23 npm's `latest` tag for `prisma` points to
`8.0.0-rc.26`, a release candidate published the day before. 7.10.1 (2026-10-15) is the newest stable
version, and `@prisma/client`'s `latest` tag points to it too. The three Prisma packages are pinned to the
exact same version because the CLI and client must match. The CLI prints an "update available" notice
pointing at the release candidate; ignore it.

Prisma 7 with plain Node (no tsx), checked 2026-10-23:
- The `prisma-client` generator writes plain `.ts` files. With `importFileExtension = "ts"` and
  `moduleFormat = "esm"`, `node` runs them directly, and `npm run typecheck` passes with them.
- The generated code goes to `src/server/db/generated/prisma`, not `node_modules`, because Node does not
  strip types from `.ts` files inside `node_modules`. Run `npx prisma generate` after every schema change.
- Prisma enums are generated as plain `const` objects, which is allowed (erasable syntax only).
- The seed is `node prisma/seed.ts` (set in `prisma.config.ts`). Prisma 7 never seeds automatically:
  run `npx prisma db seed` yourself.
- `.env` is loaded with Node's built-in `process.loadEnvFile` (no `dotenv` package), only if the file
  exists. Variables that are already set (for example Replit Secrets) win.
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
in the lockfile; only new packages get public URLs. On 2026-10-23 all 97 old URLs were rewritten to
`https://registry.npmjs.org/` (URL lines only; versions and integrity hashes unchanged). Checked with a
clean `npm ci` (empty cache) in a temp copy: install, `npm test` and `npm run typecheck` all passed.
After every install, check: `grep -c package-firewall.replit.internal package-lock.json` should print 0.

Planned (not installed yet, versions to be filled in when added): Google Gemini SDK, a PDF text library,
a multipart upload library.

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
| 2026-10-23 | Prisma 7.10.1 (stable), pinned exactly; not the 8.0 release candidate. | Stable for the hackathon; follow the v7 docs. |
| 2026-10-23 | Driver adapter `@prisma/adapter-pg` (node-postgres) for Neon. | Prisma 7 requires an adapter; this is the one in Prisma's PostgreSQL docs, and Neon accepts normal PostgreSQL connections. |
| 2026-10-23 | `process.loadEnvFile` instead of `dotenv`. | Built into Node 24, one fewer package. |
| 2026-10-23 | Every content table has `isPlaceholder`, default `true`. | Nothing counts as reviewed unless someone sets it to false on purpose. |
| 2026-10-23 | Role-skill weight is a whole number: 1 = nice to have, 2 = important, 3 = core. | Easy to explain on screen. |
| 2026-10-23 | `TrendEvidence` has optional `priorityAdjustment` (number) and `adjustmentExplanation` (text), empty for now. | Feature 2 can change skill priority later, visibly and with a reason. The scale is to be agreed with M3/M4. |
| 2026-10-23 | The DB client fails at start-up if `DATABASE_URL` is missing. | A clear error now instead of a confusing one on the first request. |
| 2026-10-23 | All `/api` routes are mounted through one `apiRouter` (`src/server/routes/index.ts`). | `server.ts` changes once; later phases add routes without touching it. |

## Endpoints

Schemas: `src/server/contracts/` (import from `index.ts`). Fictional JSON examples for each request and
response: `src/server/contracts/examples.ts`. Status "planned" means the contract exists but the route does not yet.

| Method + path | Request | Response | Feature | Status |
|---|---|---|---|---|
| GET /health | none | `{ status: "ok" }` | setup | done (Replit Agent) |
| POST /api/profile/extract | multipart upload, field `cv` (PDF or .txt, max 2 MB) | `DraftProfile` | 1 | planned, Phase 3 |
| POST /api/match | `MatchRequest` (= `ConfirmedProfile`) | `MatchResponse` | 3 | planned |
| POST /api/pathway | `PathwayRequest` (`{ profile, roleId }`) | `PathwayResponse` | 4 | planned |
| GET /api/roles | none | `RolesResponse` (roles, skills, weights, `isPlaceholder`) | 3 | done, Phase 2 (needs migrate + seed) |
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

Match buckets (decided 2026-10-23): each role skill is in exactly one list. **Strength** if it is in
`confirmedSkills`; **unconfirmed** if the graduate marked it "not sure" (`unconfirmedSkillIds`); otherwise a
**gap**, worded to the graduate as "not on your confirmed profile". The score counts confirmed skills only.
Roles are ranked by score; the preferred route is marked with `preferredRouteKept: true`, not moved.

## Database tables (Prisma schema: `prisma/schema.prisma`)

The database holds reference content only. **No user profiles and no CVs are stored.**

| Table | What it is for |
|---|---|
| Role | A career route, e.g. backend development. Its `id` is the `roleId` used in the API. |
| Skill | One skill in our catalogue, e.g. SQL. CV extraction maps to these IDs. |
| RoleSkill | Which skills a role needs: `weight` (1 to 3) and `isRequired`. Matching reads this. |
| Resource | A learning resource for one skill (title, link, provider, cost, hours). Pathways read this. |
| SdgGoal | The 17 UN Sustainable Development Goals (number and official name). |
| RoleSdg | Links a role to an SDG, with a plain-text reason. |
| SkillSdg | Links a skill to an SDG, with a plain-text reason. |
| Source | A dated publication that trend evidence comes from (M3/M4 fill it). |
| TrendEvidence | One claim from one source about one skill: direction (rising/declining), summary, limitation, and optional `priorityAdjustment` + `adjustmentExplanation`. Starts empty; matching will read it later. |

Mapping to the proposed evidence contract: one `TrendEvidence` row = one `EvidenceItem`. It has one
`skillId`, so `linkedSkillIds` has one entry; `title`, `publisher`, `url` and the dates come from its `Source`.
To agree with M3/M4.

## Database setup (Neon) and commands

1. Create a free account at neon.tech and make a project (pick a region close to the Replit server).
2. Neon dashboard > **Connect** > copy the connection string. Use the **direct** one (host without
   `-pooler`): `prisma migrate` needs a direct connection. It ends in `?sslmode=require`.
3. Local: put it in `.env` as `DATABASE_URL="..."` (`.env` is git-ignored; see `.env.example`).
4. Replit: **Tools > Secrets**, add key `DATABASE_URL` with the same value. Add it before running the
   new code on Replit: the server stops at start-up without it.

Commands (run by M2, from the project root):

| Command | What it does |
|---|---|
| `npx prisma validate` | Checks the schema file. No database needed. |
| `npx prisma generate` | Writes the TypeScript client to `src/server/db/generated/prisma`. No database needed. |
| `npx prisma migrate dev --name init` | Creates `prisma/migrations/<timestamp>_init/migration.sql` and applies it to the database. |
| `npx prisma db seed` | Runs `node prisma/seed.ts`: upserts the placeholder content. Safe to run again. |
| `npx prisma migrate deploy` | Applies existing migrations without creating new ones (for an already-set-up database). |

## Progress checklist

- [x] Phase 0: inspect repo, set up working notes
- [x] Phase 1: API contract (Zod schemas, examples, validation test)
- [ ] Phase 2: database schema and placeholder seed (Prisma + PostgreSQL), `GET /api/roles`
  - [x] schema, config, client, seed script, `GET /api/roles`, `.env.example`; `prisma validate` + `generate` pass
  - [ ] M2 runs `migrate dev` and `db seed` on Neon, then checks `GET /api/roles`
- [ ] Phase 3: CV upload and extraction (`POST /api/profile/extract`)

## Data, licences and privacy notes

- CVs are processed in memory only. They are not written to disk, stored in the database, or logged.
- All CVs and profiles used in development, tests and demos are fictional.
- Seeded content (roles, skills, weights, resources, SDG rationales) is placeholder until replaced by
  reviewed data. Every such row has `isPlaceholder = true`, and `GET /api/roles` reports it. Never show
  it as real.
- Placeholder resource links use `https://example.com/placeholder/...` (example.com is reserved for
  examples, so it is not a real course).
- SDG numbers and names: official UN Sustainable Development Goals. Checked on 2026-10-23 against
  https://www.un.org/sustainabledevelopment/sustainable-development-goals/ . We use the names as on the
  official SDG icons; that page writes two slightly differently ("Industry, Innovation, and
  Infrastructure"; goal 17 as "Partnerships"). SDG names are not placeholders; the role/skill SDG links are.
- No real sources, courses, links or statistics are invented. Trend evidence comes from M3/M4.
- Repository licence: Apache 2.0 (`LICENSE`). Third-party library licences are recorded here as libraries are added.

## AI assistance log

- Replit Agent: scaffolded minimal Express + TypeScript server with GET /health and Replit config (commits ca8551b, 9671391).
- Claude Code: used for M2 backend development, phase by phase; all code reviewed and committed by M2.
