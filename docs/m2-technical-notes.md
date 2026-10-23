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
| multer | 2.4.0 (exact) | 2.4.0 (MIT; Phase 3) |
| unpdf | 1.9.0 (exact) | 1.9.0 (MIT; bundles Mozilla PDF.js 6.4.299, Apache-2.0; Phase 3) |
| @google/genai | 2.30.0 (exact) | 2.30.0 (Apache-2.0; official Google Gen AI SDK; Phase 3) |
| @types/multer (dev) | ^2.3.0 | 2.3.0 (MIT; Phase 3) |

Version rule (from Phase 3): use releases at least about one week old, pinned exactly. On 2026-10-23 the
newest multer (2.5.0) was 1 day old, @google/genai (2.31.0) a few hours old and unpdf (1.9.1) 4 days old,
so the previous release of each was used. Brand-new releases are where a compromised package is most
likely to show up.

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
- The generated client is committed to git (decision 2026-10-23), so Replit needs no generate step.
  It must be regenerated with `npx prisma generate` after any schema change, and committed again.
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
| 2026-10-23 | Commit the generated Prisma client; no `postinstall`. | Replit runs it as is; regenerate after schema changes. |
| 2026-10-23 | Proposal (asked M3/M4): `priorityAdjustment` is -1 to +1, added to the role-skill weight. | Small, explainable effect; to be confirmed. |
| 2026-10-23 | Match score logic is a pure function (`src/server/matching/matchEngine.ts`); the route reads the database and passes data in. | Tests need no database; the formula sits in one readable place. |
| 2026-10-23 | Unknown skill IDs or `preferredRouteId` return `INVALID_INPUT` with a `details` entry per bad ID. | Never guess what the graduate meant. |
| 2026-10-23 | Evidence total per skill limited to -1..+1, effective weight at least 0.5 (**proposed, to confirm with M3/M4**). | Evidence can shift priorities but never wipe out a skill or dominate a role. |
| 2026-10-23 | `baseWeight` and `evidenceAdjustments` appear on a role skill only when evidence exists for it. | Old responses keep working; "present" means "evidence changed this". |
| 2026-10-23 | If the evidence read fails, match with base weights and say so in every explanation. | Evidence is optional; a feature 2 problem must not break matching. |
| 2026-10-23 | `exampleMatchResponse` is real engine output, checked by a test. | The example M1 builds against cannot drift from what the API returns. |
| 2026-10-23 | `MatchResponse.isPlaceholder`: true if any role, role skill or skill used is placeholder data. | Scores from placeholder weights must never look real. |
| 2026-10-23 | Only REVIEWED evidence (`isPlaceholder = false`) with a `priorityAdjustment` changes weights. | Unreviewed evidence must not change what graduates see. |
| 2026-10-23 | Database read functions take the Prisma client as an argument (`loadRoles(prisma)`). | Tests pass a small fake client, so they need no database. |
| 2026-10-23 | `DATABASE_URL` placeholder uses `sslmode=verify-full`. | node-postgres already treats `require` as `verify-full` and warns about it; writing `verify-full` keeps the same security and removes the warning. |
| 2026-10-23 | Added error code `INTERNAL_ERROR` (500). | Unexpected problems (e.g. database down) also return our JSON error shape. |
| 2026-10-23 | Uploads with multer `memoryStorage`, 2 MB limit, one file in field `cv`. | Most used Express upload library; memory storage means the CV never touches disk. |
| 2026-10-23 | PDF text with unpdf (MIT), not raw pdfjs-dist or pdf-parse. | Maintained (unjs), no dependencies, one-call `extractText`, works in Node without worker set-up; uses Mozilla's PDF.js inside. |
| 2026-10-23 | File type is checked from the file's bytes (`%PDF-`, or valid UTF-8 text with a .txt name / text/plain type). | The browser's name and type can be wrong. |
| 2026-10-23 | Fewer than 30 letters/digits of text = `UNREADABLE_CV`. Text over 20,000 characters is cut, with a warning. | Never return a misleading empty profile; bound model time and cost. |
| 2026-10-23 | Gemini: JSON mode (`responseMimeType: application/json`), `temperature: 0`, 30 s timeout, reply checked with Zod. Not using Gemini's own response schema yet. | JSON mode plus Zod is simple and testable without the real API; the response-schema option can be tried later against the real API. |
| 2026-10-23 | After extraction, any skillId not in the catalogue becomes `null` (raw name kept) with a warning. | The model can never put an invented ID into a profile, whatever it replies. |
| 2026-10-23 | Mock adapter is the default (`LLM_PROVIDER` unset = mock). Its output says "MOCK EXTRACTION ... NOT read from your CV". | App and tests run without a key; mock output cannot be mistaken for real extraction. |

## Endpoints

Schemas: `src/server/contracts/` (import from `index.ts`). Fictional JSON examples for each request and
response: `src/server/contracts/examples.ts`. Status "planned" means the contract exists but the route does not yet.

| Method + path | Request | Response | Feature | Status |
|---|---|---|---|---|
| GET /health | none | `{ status: "ok" }` | setup | done (Replit Agent) |
| POST /api/profile/extract | multipart upload, field `cv` (PDF or .txt, max 2 MB) | `DraftProfile` | 1 | done, Phase 3 |
| POST /api/match | `MatchRequest` (= `ConfirmedProfile`) | `MatchResponse` | 3 | done, Phase 4 |
| POST /api/pathway | `PathwayRequest` (`{ profile, roleId }`) | `PathwayResponse` | 4 | planned |
| GET /api/roles | none | `RolesResponse` (roles, skills, weights, `isPlaceholder`) | 3 | done, Phase 2 |
| GET /api/sdg | none | `SdgResponse` | 5 | planned |
| GET /api/evidence | none | `EvidenceListResponse` (contract PROPOSED, to agree with M3/M4) | 2 (M3/M4) | planned |

Errors (all endpoints): body is `ApiError`, `{ "error": { "code", "message", "details"? } }`.

| Code | HTTP | When |
|---|---|---|
| INVALID_INPUT | 400 | body or query failed validation, not JSON, a draft profile, or unknown IDs (`details` lists each problem) |
| NOT_FOUND | 404 | unknown route, role or skill |
| FILE_TOO_LARGE | 413 | upload over 2 MB |
| UNSUPPORTED_FILE | 415 | not PDF or plain text |
| UNREADABLE_CV | 422 | no text could be read (never an empty profile) |
| LLM_FAILED | 502 | model returned bad JSON, or the provider failed |
| LLM_TIMEOUT | 504 | model did not answer in time |
| INTERNAL_ERROR | 500 | unexpected server problem, e.g. database down |

Unknown paths under `/api` return `NOT_FOUND` as JSON.

### POST /api/profile/extract

Upload one CV, get a DRAFT profile for the graduate to check. Code: `src/server/routes/profile.ts`,
`src/server/extraction/`.

Request: `multipart/form-data` with one file in field `cv`. PDF (with real text, not a scan) or plain
text (.txt, UTF-8). Max 2 MB.

```
curl -s -F "cv=@docs/sample-cvs/backend-graduate.txt;type=text/plain" http://localhost:3000/api/profile/extract
```

Response 200: `DraftProfile`. Example from the mock adapter (shortened):

```json
{
  "status": "draft",
  "extractedSkills": [
    { "skillId": "javascript", "rawName": "JavaScript", "evidence": "(mock) Built a web app in JavaScript", "confidence": 0.9 }
  ],
  "projects": [{ "title": "(mock) Fictional coursework project", "summary": "...", "skillIds": ["javascript", "sql"] }],
  "experience": [],
  "warnings": ["MOCK EXTRACTION (LLM_PROVIDER=mock): this is a fixed FICTIONAL profile. It was NOT read from your CV."]
}
```

Errors: `UNSUPPORTED_FILE` 415, `FILE_TOO_LARGE` 413, `UNREADABLE_CV` 422 (no text, scanned, damaged or
password-protected PDF), `INVALID_INPUT` 400 (no file, wrong field name, more than one file),
`LLM_FAILED` 502, `LLM_TIMEOUT` 504. Example:
`{ "error": { "code": "UNREADABLE_CV", "message": "We could not read any text from this file. ..." } }`

Steps: check file type from its bytes, then read text in memory (unpdf for PDF). If fewer than 30
letters/digits, return `UNREADABLE_CV`. Otherwise load the skill catalogue from the database and call the
adapter (Gemini or mock). Turn any non-catalogue skillId into `null` with a warning, then check the reply
against the `DraftProfile` schema.

Prompt-injection protection: the system prompt (`src/server/extraction/prompt.ts`) says the CV is data,
not instructions. The CV text goes between `<<<CV_TEXT_START>>>` and `<<<CV_TEXT_END>>>`, and those markers
are removed from the CV text itself, so a CV cannot close its own block. Even if the model is fooled, its
reply is still checked with Zod and against the catalogue. `docs/sample-cvs/qa-graduate.txt` has a
deliberate injection line for manual testing.

Model and provider: Google Gemini API through `@google/genai`, model set by `GEMINI_MODEL`. On 2026-10-23
Google's model list recommended `gemini-3.5-flash-lite` (stable) for fast, low-cost text tasks.
**Provider terms and free-tier limits to be checked by M2 before the demo.** In particular: whether
free-tier prompts may be used by Google to improve its products, and the request limits per minute/day.
Until that is checked, send only fictional CVs to Gemini.

Settings (env vars, see `.env.example`): `LLM_PROVIDER` = `mock` (default) or `gemini`; `GEMINI_API_KEY`;
`GEMINI_MODEL`. With `gemini`, the server will not start unless both are set.

### POST /api/match

Score every role for a CONFIRMED profile. Code: `src/server/routes/match.ts` (validation and database
reads), `src/server/matching/matchEngine.ts` (pure score logic), `src/server/db/matchData.ts` (reads).

Request: JSON body = `ConfirmedProfile` (see `exampleConfirmedProfile`). Max 100 kB.

```
curl -s -X POST -H "content-type: application/json" --data @profile.json http://localhost:3000/api/match
```

Response 200: `MatchResponse` (see `exampleMatchResponse`, which is real engine output). Always includes
`scoreMeaning` (not a hiring probability) and `isPlaceholder` (true if any role, role skill or skill used
is placeholder data: then the scores are only illustrative and must not be shown as real). Roles are ranked by score, highest first; ties by role id.

Errors: `INVALID_INPUT` 400 for a body that fails the schema (each Zod problem in `details`), a body that
is not JSON, a draft profile (`status: "draft"`), or unknown skill IDs / `preferredRouteId` (one `details`
entry each, e.g. `{ "path": "confirmedSkills.6.skillId", "message": "Unknown skillId \"made-up-skill\"." }`).
`INTERNAL_ERROR` 500 if roles cannot be read from the database.

**Score formula** (per role):

```
effective weight = max(0.5, base weight + limit(sum of evidence adjustments for the skill, -1, +1))
score = round( sum of effective weights of role skills in confirmedSkills
               / sum of effective weights of all role skills  x 100 )
```

- Every role skill is in exactly one list: **strengths** (in `confirmedSkills`), **unconfirmedSkills**
  (in `unconfirmedSkillIds`, "not sure"), or **gaps** (everything else, including removed skills).
- Only strengths count toward the score. Unconfirmed skills are not counted and are not gaps.
- An empty `confirmedSkills` list is valid: score 0, and the explanation says so.
- `scoreExplanation` shows the numbers (e.g. `14 / 18 x 100 = 78 (rounded)`), lists what was not counted
  and why ("you marked as not sure", "not on your confirmed profile"), and never says "missing" or
  "you lack".
- The preferred route (only when `entryPath` is `preferred-route`) gets `preferredRouteKept: true` and
  is never moved: its rank is still by score, and its explanation says it stays the graduate's route.

**Evidence hook (feature 2 plugs in here).** The route reads `TrendEvidence` rows that are REVIEWED
(`isPlaceholder = false`) and have a `priorityAdjustment` (`loadWeightEvidence` in `src/server/db/matchData.ts`).
Placeholder evidence never changes a weight. For each skill, the adjustments are added up, the total is limited to
**-1 to +1 (proposed, to confirm with M3/M4)**, and added to the base weight. The effective weight is
never below **0.5** (also proposed). When evidence exists for a skill:
- the skill's result carries `baseWeight` (before) and `evidenceAdjustments` (`evidenceId`, `direction`,
  `adjustment`, `explanation`), and `weight` is the effective weight;
- `scoreExplanation` says which skill changed, from what to what, and cites the evidence IDs, e.g.
  `Trend evidence changed the weight of CI/CD basics from 2 to 3 (+1 from evidence fictional-evidence-1).`
  It also says when the -1..+1 limit or the 0.5 minimum was applied.
If reading evidence fails, the match still returns with base weights, and every explanation ends with
`Trend evidence was not available, so base weights were used.` The evidence tables are empty today,
so live scores currently use base weights only.

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
| TrendEvidence | One claim from one source about one skill: direction (rising/declining), summary, limitation, and optional `priorityAdjustment` + `adjustmentExplanation`. Starts empty. `POST /api/match` reads rows with a `priorityAdjustment` (see the evidence hook). |

Mapping to the proposed evidence contract: one `TrendEvidence` row = one `EvidenceItem`. It has one
`skillId`, so `linkedSkillIds` has one entry; `title`, `publisher`, `url` and the dates come from its `Source`.
To agree with M3/M4.

## Database setup (Neon) and commands

1. Create a free account at neon.tech and make a project (pick a region close to the Replit server).
2. Neon dashboard > **Connect** > copy the connection string. Use the **direct** one (host without
   `-pooler`): `prisma migrate` needs a direct connection. Neon gives it with `?sslmode=require`; change
   that to `?sslmode=verify-full` (same security in node-postgres today, and no warning at start-up).
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
- [x] Phase 2: database schema and placeholder seed (Prisma + PostgreSQL), `GET /api/roles`
  (migration `20261023030501_init` applied and seeded on Neon; `GET /api/roles` checked 2026-10-23)
- [x] Phase 3: CV upload and extraction (`POST /api/profile/extract`), mock + Gemini adapters, 14 route tests
  - [ ] M2: try `LLM_PROVIDER=gemini` with a real key and the two fictional sample CVs, after checking provider terms
- [x] Phase 4: `POST /api/match` with explained scores and the trend-evidence hook (pure engine + route tests)
  - [ ] M3/M4: confirm the -1..+1 adjustment scale and the 0.5 minimum weight

## Data, licences and privacy notes

- **Privacy statement: CVs are processed in memory and not stored.** The upload is held in memory
  (multer `memoryStorage`) only while the request runs. It is never written to disk, never stored in the
  database, and neither the file nor its text is ever logged (error logs hold only an error name and message).
- With `LLM_PROVIDER=gemini`, the CV text is sent to Google's Gemini API to be read. The prompt asks the
  model not to copy names or contact details into its reply. Google's handling of that data depends on
  the API terms and tier: M2 checks this before the demo (see the endpoint notes).
- Sample CVs in `docs/sample-cvs/` are FICTIONAL (marked at the top). Contact details use example.com.
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
