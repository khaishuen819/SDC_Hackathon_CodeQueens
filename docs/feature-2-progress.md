# Feature 2 implementation progress

**Latest checkpoint,24 October:** Phase5 backend integration is complete locally after independent review and regression fixes;209 backend tests passed,9 DB tests skipped,10 frontend checks and typecheck passed. Phase4 was received from GitHub at a3684f2. Later Phase5 commits await per-push approval. Phase6/frontend and Phase7/release remain pending. Earlier checkpoint wording below records its own time.

Owner: Jong (M3). Working branch: `codex/feature-2-automation`.
Approved basis: V4 automation/scoring design and implementation plan, reviewed24 October2026.

The user authorizes local implementation and small commits on this feature branch,
superseding CLAUDE.md's earlier M2-only commit restriction for this work.
Latest instruction (24 October): pause and notify the user before EVERY push.
Phase 2 code (`ae96541`, `dfe4338`) and Phase 3 (`e6384e0`..`272902c`) were pushed after
approval. Phase 4 commits stay local until the user approves a push. Keep at least a
conservative 15% session-token reserve.
Main merges and Replit publishing are separate actions. The proficiency picker
removal is a separate change for Jong to apply; it is not bundled here.

## Accepted behaviour

- CS fresh-graduate pilot: backend development and QA automation.
- One point per distinct admitted capability. Only confirmed possession earns credit.
- Not sure, unanswered and CV-omitted skills do not block results. Preserve uncertainty,
  offer guidance and allow later explicit possession confirmation without reupload.
- No extra-skill penalties, importance tiers or numerical trend adjustments.
- Useful older sources remain valid; no age-only cutoff or24-hour fallback expiry.
- New tools/aliases/covered practices should reuse capabilities rather than inflate the denominator.
- Source/model failures preserve the last valid criteria. Refresh costs use shared controls.
- No raw CV/profile data in public criteria snapshots or source-interpretation prompts.

## Checkpoints

Phase1's offline foundation is complete. Phase2's reference/catalogue checkpoint
is below. Phase 3's source/interpretation kernels and Phase 4's durable store and
refresh service are implemented (see their sections at the end); Phases 5–7 have
not been implemented.

1. Completed: shared schemas/versioned contracts.85 backend checks passed at this checkpoint.
2. Completed: source/canonical admission rules, stable identity and one-point/citation-only adapters.112 backend checks and type-checking passed.
3. Completed: non-blocking possession reconciliation;123 backend checks passed before independent review.
4. Review corrections: enforce configured foundation prerequisites; reject identical co-scored
   capabilities while retaining historical records; preserve honest date precision and decision-source linkage.
   Each regression was observed failing before its fix. Final results:127 backend checks,
   10 existing frontend checks and TypeScript checking pass.

The existing weighted engine's score meaning stays accurate. A separate count-coverage
response/meaning is defined for the versioned integration; Phase5 will select it.
Publication dates retain their true precision; year/month-only evidence gets no invented day.
Known-capability updates may use existing ready content without inventing a new lesson
estimate. Distinct new capabilities still need every source/resource/SDG gate to pass.

Independent read-only review identified two important invariant gaps, now fixed with
regressions. Missing original dates for declared known precision was treated as a source
readiness issue and fixed too; wholly unknown dates remain explicitly unknown. Decision
records must reference evidence linked to their capability, not merely any known source.

## Verification limits

Baseline:74 backend tests passed and TypeScript checking passed using the locked packages.
New checks use clearly synthetic sources/catalogues only. No live Gemini call, source
refresh, database migration, populated baseline or deployed Feature2 flow is claimed.
The public app still uses its current integration; these new kernels are wired in Phase5.

After Phase1: scoped role-reference/baseline work, live interpretation, durable snapshots,
API/frontend integration, then actual deployment/demo checks, each in its own phase.

## Phase 2 — local checkpoint, 24 October 2026

- Added bounded HTTPS retrieval: allowed hosts, same-host redirects, actual streamed
  byte limits, request deadlines/cancellation, real HTTP status and conditional headers.
- Added the pinned O*NET 31.0 importer and actual `row` parser. The saved reference
  contains 47 tasks and 859 software examples for occupations 15-1252.00/15-1253.00.
  Dates retain their original precision; an unclassified task stays `Unknown`.
  Software popularity flags and management tasks never automatically become requirements.
- Configured B1–B4/Q1–Q4, existing canonical IDs and permitted hosts/SDG templates.
- Added `pilot-baseline.json`: 16 recognised capabilities, 16 public free learning
  resources, prerequisites, app-estimated practice hours, SDG explanations and 16
  source-linked admission decisions. Eight distinct capabilities are assessed per role.
  JavaScript, Python, TypeScript, Node.js and Docker remain recognised learning/stack
  options; knowing every alternative is not required to score 100% of this pilot subset.
  The scope/mappings are explicit product interpretations, not an occupational exam,
  complete employability measure, hiring probability or AI-growth claim.
- Added pure `buildInitialCriteria` readiness validation. No database bootstrap or
  application-route connection is claimed: durable storage arrives in Phase4.
- Seed reruns insert missing demo rows only and preserve existing catalogue rows.
  A database-free regression checks reviewed content and prohibits snapshot access.

Verification: **143 backend tests, 10 frontend checks and
TypeScript checking passed**, using the lockfile. Sixteen public resource URLs returned
HTTP 200; public page topics were checked. We have not completed the learning courses,
tested learning outcomes, called Gemini, migrated a database or deployed this change.

### Import verification limitation

`node scripts/import-role-reference.ts` timed out twice at its 30-second bound here.
Both pinned public tables were successfully retrieved with PowerShell HTTPS requests
and parsed with the same tested parser to produce the checked-in reference. Raw table
hashes, actual retrieval times, resource checks and review limits are recorded in
`src/server/trends/data/baseline-provenance.json`. This fallback is not a successful
native Node live-import test. Recheck the default importer from the target runtime
before relying on it there; do not increase limits or claim live AI updates to hide it.

O*NET data uses CC BY 4.0, independently of Apache-2.0 source code. Exact attribution
and adaptations are in the reference/provenance files and the technical notes.

Next approved phase: Phase3 live retrieval/interpretation. Do not start it as part of
this Phase2 checkpoint. Publication still awaits the user's review before any push.

### Independent review and correction

One fresh-context read-only review found no critical issues and one important content
gap: Playwright best practices and GitHub's issue-creation instructions did not teach
the full promised test-case design and reproducible-report outcomes. These links were
replaced with the official ISTQB CTFL v4.0.1 syllabus (sections 4.1–4.2.2, printed
pages39–40) and Mozilla Bug Writing Guidelines. Their instructional passages and HTTP200
responses were checked, and evidence/provenance/estimates were updated without changing
the promised outcomes or eight-point role denominators. Only links and short original
summaries are stored; publisher copyright remains intact. This is a content correction,
verified against the actual instruction and existing catalogue tests, not a new learning
feature or a test that merely asserts a replacement URL.

Deferred minor: date validation should reject impossible calendar dates such as
`2025-02-31` and contradictory `originalDate`/precision/day combinations. The reviewer
reproduced these malformed-input edge cases; the checked-in reference did not contain
them. Add regressions before broadening ingestion. Do not interpret this as a finding
that the current stored dates are fabricated. Resolved in Phase 3 (`e6384e0`, below).

The review explicitly deferred later-phase refresh/queue controls, durable publication,
restart fallback and browser/version integration. Native-import success on the target
runtime and real database/deployment verification also remain pending. The valid offline
checkpoint does not establish any of those capabilities.

## Phase 3 — local checkpoint, 24 October 2026

Bounded live sources, Gemini interpretation and draft criteria, as pure or
injected-dependency kernels. Nothing is persisted, published or wired into routes:
storage, the shared lease and publication are Phase 4; routes are Phase 5.

Local commits (not pushed), each shown as a diff and approved before committing:

1. `e6384e0` fix: reject impossible and contradictory source dates. `isCalendarDate`
   replaces `Date.parse` (which rolled 2025-02-31 into March). Evidence original dates
   must match their precision; day precision must equal the publication day; unknown
   precision keeps no original date. Both regressions failed before the fix.
2. `e07eb08` chore: add fast-xml-parser 5.11.2 (exact, MIT, seven MIT dependencies,
   each at least 14 days old). `npm audit` unchanged: two existing high advisories
   (multer 2.4.0, body-parser via Express) predate this change; not fixed here.
3. `362b11b` feat: fetch bounded publisher feeds (`sources.ts`).
4. `598e248` feat: bounded fair interpretation queue (`queue.ts`).
5. `edee380` feat: Gemini source interpreter (`interpreter.ts`, `.env.example`).
6. This commit: validated criteria drafts (`refreshDraft.ts`) and these notes.

Behaviour, all within the approved V4 bounds:

- Feeds: GitHub Changelog and JetBrains AI RSS; HTTPS, at most two same-host
  redirects, 10 s and 2 MiB per source. DTD/entity declarations are rejected before
  parsing (CDATA article text excepted); XML is validated first because the parser
  alone accepts malformed input; nesting is capped at 64. At most six dated items per
  feed and 4,000 sanitised characters per item. Missing, impossible or more than five
  minutes future dates are skipped; there is no age cutoff. HTTP 304 reuses validators.
  A failed feed keeps its previous success time; the other feed still returns items.
- Resources: only links the publisher included, on configured free documentation
  hosts, at most six per refresh, fetched only for the items selected for the model.
- Queue: 48 active items (24 per provider) with an explicit overflow count; two new
  items or one ready retry per model turn, alternating new/retry work and providers.
  Input failures wait 5 then 30 minutes and quarantine on the third; a failed pair
  retries individually. Provider outages back off model work for at least 5 minutes
  without charging articles. Dispatch is recorded before the call.
- Interpreter: one request per refresh, at most two sources, four mappings, six
  resources and 8,192 output tokens, 30 s deadline, temperature 0, JSON schema output,
  no automatic continuation, no retry. Source text is delimited untrusted data; no
  URLs or profile data are sent. Truncated, blocked, malformed, incomplete or
  oversized replies fail the whole batch. `TREND_PROVIDER` defaults to `disabled`.
- Drafts: each mapping goes through `evaluateCandidate` (A1–A8) against the evolving
  draft. Reuse attaches dated evidence without changing any denominator. Promotion adds
  one `cap-` capability with weight 1, decision, evidence, resources, prerequisites and
  SDG tags, then must pass `CriteriaBundle` validation or stays staged. Ten repeats add
  at most one criterion. `draftRefresh` composes one in-memory run under a 60 s deadline.

Plan deviations (engineering details only; no approved product decision changed):

- `contracts/trends.ts`: the date-validation fix, and `QueueItem.providerId` for fairness.
- `fetchSourceItems` takes an optional `options` argument (clock, conditional requests,
  timeout, resource hosts). Resource fetching is a separate `fetchResourceCandidates`
  so the model work is selected first.
- Queue adds `enqueueSourceItems` (capacity bounds) and `recordDispatch` (attempt saved
  before the call), plus `emptyQueue`/`queueCounts` helpers.
- `buildCriteriaDraft` takes a fourth context argument (reference, config, clock,
  interpreter version) that `evaluateCandidate` requires.
- `draftRefresh` is an in-memory composition added so the one-request bound is testable.

Verification: 176 backend tests, 10 frontend checks and TypeScript checking passed.
Every new test file was observed failing before its module existed. Deliberate code
mutations were run for the queue, interpreter and draft builder; each surviving mutant
led to a stronger test (fairness and repeat-reuse). One read-only run against the real
feeds returned 12 schema-valid items with real dates and two fetched GitHub Docs pages.

Not verified or not done:

- No live Gemini call. The generated response schema uses `$schema`, `pattern`,
  `anyOf`, `exclusiveMinimum` and `additionalProperties`; Gemini acceptance is
  unverified. A rejection would surface as a provider failure (HTTP 400) and keep the
  last valid criteria. Task 7 includes the real check; simplify the schema if needed.
- JetBrains AI items currently link to `jetbrains.com`, which is not a configured
  resource host, so new capabilities from them will usually stage at A7.
- No retirement: `retiredSkillIds` is always empty until a verified correction or
  retraction workflow exists.
- Phase 4 must resupply all cached waiting items when the interpreter context changes
  (old-context active entries are dropped) and should cap processed/quarantined
  history when persisting queue state. Both are done in Phase 4 (below).
- No database, snapshot, route, frontend or deployment change.

## Phase 4 — local checkpoint, 24 October 2026

Durable, restart-safe criteria versions and the refresh service. Not wired into
routes (Phase 5); the migration is not applied to Neon (Phase 7 runbook).

Local commits (not pushed), each shown as a diff and approved before committing:

1. `e3c759e` store contract and in-memory store: `CriteriaStore`, shared pure rules
   (75 s lease, 60 s between reservation starts, publish only for the current base, a
   newer generation and the held lease), content-hash check on every snapshot read,
   validated `QueueItem`/`QueueState` and a strict `RefreshPublicState` (no profile data).
2. `4c32ca3` snapshot tables: `CriteriaSnapshot` and the single `CriteriaHead` row. The
   migration `20261024130000_dynamic_criteria_snapshots` is additive only, with a
   single-row check and triggers rejecting UPDATE, DELETE and TRUNCATE on snapshots.
3. `cac0446` PostgreSQL store: one transaction per write, `SELECT ... FOR UPDATE` on the
   head row and the database clock, reusing the shared rules.
4. `1c4fcd1` refresh service: reserve, run one bounded draft from saved state, persist the
   dispatch before the model call, publish or save, always release. `bootstrapCriteria`,
   a 200-record queue history cap and the `onDispatch` hook. Fix: `publishIfCurrent`
   takes an explicit `checked` flag, so a version built from cached sources while feeds
   are down does not invent a successful check.
5. This commit: notes and the `TEST_DATABASE_URL` placeholder.

Approved decisions recorded here: `RefreshState` keeps providers, waiting sources, queue
and notices plus check times; the unused interpretation and staged caches were dropped
(processed queue keys already prevent re-interpretation). Database tests run only on an
explicit disposable database. The migration folder uses a standard 14-digit timestamp.

Verification:

- `npm test` without a test database: 196 passed, 9 skipped (database tests, pending),
  0 failed; 10 frontend checks and TypeScript checking passed.
- Throwaway PGlite (PostgreSQL 17.5, in memory) with both migrations: `prisma migrate
  diff` reported no drift; triggers and the single-row check behaved as intended; the
  shared store contract, database-time lease and direct-SQL immutability tests passed
  (8 passed, 1 skipped). PGlite was used only as a local verification tool and is not a
  project dependency.
- Each new test file failed before its module existed. Deliberate mutations of the memory
  store, PostgreSQL store and refresh service were each caught.

Not verified or not done:

- True lock contention between separate connections: the four-connection reservation
  test needs a multi-connection disposable PostgreSQL (`TEST_DATABASE_CONCURRENCY=1`).
  PGlite accepts one connection.
- The migration has not been applied to Neon or any shared database.
- PGlite quirks (dropped reconnects, closing the connection after an SQL error) are
  handled in the test helpers; real PostgreSQL does not need them.
- The status display uses the server clock while leases use the database clock, so a
  small skew is possible. Each admitted skill changes the catalogue fingerprint, so
  current articles are reinterpreted (two per refresh); this is by design but costs calls.
- No routes, frontend or deployment change; the public app still uses legacy logic.

## Phase 5 — backend integration checkpoint, 24 October 2026

Continued from a3684f2. Baseline re-run:196 backend passed,9 DB skipped,10 frontend
passed and typecheck passed. Reviewed the peer Phase2–4 source/draft/queue/store and
migration code. Live Gemini acceptance and multi-connection locking remain unverified.

Review fix8a0d4fb: exceptional timeouts lost warnings on later status reads and could
report old criteria as fresh. Reproduced RED, fixed GREEN: save failure notice under
the lease; newer unfinished attempts make status partial without changing the last
success or valid criteria. This fix was pushed before the newer per-push approval
note was noticed. Remaining commits stay local for review.

- One captured head and explicitly loaded immutable version supplies roles, complete
  recognition catalogue, matching, pathways, evidence and SDG readers. Unknown
  versions return409; unavailable storage/no baseline returns503. Historical versions
  never inherit current-head provider/check timestamps. Startup never auto-bootstraps.
- Adds GET /api/trends, POST /api/trends/refresh (empty input only), POST
  /api/trends/reconcile ({profile,review}). Reconcile returns the updated profile,
  snapshotId, optional guidance and criteria in memory only, never in public storage.
- Match/pathway require snapshotId or criteriaReview.targetSnapshotId. Both must
  agree when present. Genuine context errors preserve validated top-level review.
  Omission/Not sure/unanswered skills give usable200 scores/pathways with zero credit.
- One point per distinct admitted skill; citation-only pathway evidence. No legacy
  numerical DB evidence loader is used by the API. Pure engines remain unchanged.
  Explanations cite role evidence, describe denominator changes and preserve choice.
- Retired IDs remain recognised by roles, extraction and profile matching. Extra
  skills/proficiency levels give no score bonus or penalty.
- Pathways expand/topologically order unconfirmed prerequisites, then pilot required
  status, supported context and stable IDs. Preparation outside current associations
  never enlarges the score denominator. Actual resources, original dates, estimate
  provenance and SDG content remain intact.
- routes/index.ts constructs one production store/service. New criteriaApi.ts gives
  injected composition for full fictional-data HTTP checks without real credentials.

Phase6 contract guide: roles/evidence/sdg carry criteria; roles adds recognisedSkills.
Match/pathway carry criteria/review. Role matches add evidence references. Pathway
steps add optional possessionState, isPrerequisite, estimateBasis and estimateNote;
resources retain estimate/check metadata. See the schemas for exact shapes.

Pre-review verification:207 backend passed,9 DB skipped; typecheck passed. Replaced
obsolete weighted HTTP tests, retaining pure-engine tests. Cases include50→100,
old/new pinning, real409 transport, retirement, no baseline/no implicit bootstrap,
and a failed refresh after26hours. A deliberate current-associations-only catalogue
mutation failed the composed HTTP regression; restored code passed the whole suite.

No live model call, Neon migration/bootstrap, frontend edit or Replit publication.
Do not deploy this backend alone: Phase6 and coordinated Phase7 release remain.
The separate proficiency-dropdown patch is not included. Final review follows.

### Final independent review and regression fixes

A fresh read-only reviewer found no Critical issues, two Important issues and no
Minor issues. Both Important findings were reproduced failing before fixing:

1. Trends status/refresh storage failures escaped to the generic500/raw-error
   logger. Both storage read/reservation cases now return sanitized503
   TRENDS_UNAVAILABLE and never reach that logger. Existing ordinary/context errors
   retain their contracts.
2. A changed denominator explanation cited only current admissions, omitting a
   retirement-only correction. Explanations now inspect changed associations and
   cite their matching admit/retire reason/evidence. If no reason is recorded,
   they explicitly say so instead of assigning unrelated evidence to the change.

Final verification:209 backend passed,9 disposable-DB checks skipped,10 frontend
checks passed, tsc --noEmit passed. Independent review plus one red-green fix pass;
no second reviewer run was substituted for regression verification.

Reviewer exclusions were assessed and retained as phase boundaries: browser/cache/
late-response/learning-intent work is Phase6; real database locking/restarts/migration,
seed execution, live source/model quality and coordinated deployment are Phase7.
Those checks remain pending, not passes. Phase5 is complete as a local backend
checkpoint. Four Phase5 commits await push approval; only the earlier review fix
8a0d4fb has been pushed. Main and Replit remain unchanged.

## Feature 2 Phase 6 — frontend integration, 24 October 2026 MYT

**Local frontend scope complete; production release remains a separate gate.**
M4/leader authorized Codex to continue from the published Phase 5 checkpoint,
make one local commit at a time and stop for review after each. No Phase 6
commit was pushed, merged or deployed. The earlier Phase 5 pending-push wording
above is historical: the received feature checkpoint was `f578bd9`.

The intended audience remains fresh graduates. Backend Development and QA
Automation are the current CS fresh-graduate testing/validation pilot.

### What now works locally

- Versioned client transport, intact HTTP/context errors and one validated
  context reload/resubmission. Recovery never repeats CV extraction or refresh.
- Initial confirmation refreshes once, reads the complete recognition registry,
  reconciles and matches. All accepted readers use one saved snapshot. Late
  responses cannot overwrite a newer journey, edit or restart.
- Historical canonical skills stay recognisable without becoming scored criteria.
  Only confirmed listed capabilities count once; proficiency and learning
  choices add no points. The preferred route remains available.
- Have / Not yet / Not sure are optional after initial profile confirmation.
  Unanswered skills never block results or pathways. Accepted answers and
  learning goals survive ordinary review, route, level and unrelated skill edits.
  Explicit form possession edits replace only that skill's answer; a new CV or
  Start over clears the session.
- Learning Add / Not now stays separate from possession. Goals are in page
  memory only. Scores/profile are updated only after required server replies
  succeed; failures preserve the previous coherent view.
- Ordered pathways show named prerequisite-only stations, inspectable details,
  app/provider estimate labels, actual source/check dates and SDG rationales.
  Prerequisites outside the scored role never increase its denominator.
- Manual Check for updates is single-flight and respects cooldown/busy metadata;
  there is no timer polling. Partial/deferred/quarantined status does not imply
  skill decline, expiry or deletion. A cold/empty store shows unavailable.
- The optional proficiency picker remains, with a self-report/no-score-effect
  explanation. Its separately flagged removal option was not applied.

### Reproduce the fictional integration environment

Use Node 24+ and the root lockfile dependencies. From the application repository:

```text
npm --prefix frontend run dev:criteria-fixture
```

The default address is `http://127.0.0.1:5174`. Stop it with Ctrl+C.
`CQ_FIXTURE_PORT` can select another local port. A positional scenario can set
the default page, for example `npm --prefix frontend run dev:criteria-fixture -- empty`.

| Path | Purpose |
|---|---|
| `/fixtures/coverage/` | QA A/B versus Backend A; A confirmed gives QA 50%, then Have B gives 100%. |
| `/fixtures/historical/` | A remains recognised but is no longer associated with either scored role. |
| `/fixtures/prerequisite/` | Unscored prerequisite before B; year-only source date and synthetic partial/cooldown/deferred/quarantined metadata. |
| `/fixtures/empty/` | No criteria head; actual API returns sanitized unavailable errors. |

This is a **development-only composition of actual API routes and a memory
store**, not a deployment or a replacement backend. It never imports production
startup/database clients. It binds only 127.0.0.1 and starts only when explicitly
launched. The fixture banner sits outside the app's rerendered area, reads
**FICTIONAL / NOT LIVE EVIDENCE**, and remains visible in every scenario.

The synthetic bundles/reference come from `src/server/trends/testFixtures.ts`,
with explicit scenario changes in `frontend/fixtures/criteria-server.mjs`.
Snapshot readiness flags follow the tested schema; they are not evidence that
this fictional content has been reviewed or is usable as occupational data.
Extraction is fixed and labelled synthetic; samples must begin with FICTIONAL.
Publisher/model requests are blocked. Google font links are removed only from
the served fixture HTML; production HTML is unchanged. Fictional resource URLs
are shown as placeholders, not clickable verified courses.

The prerequisite scenario uses a frozen synthetic clock at
2026-10-24T10:00:00Z with a success 26 hours earlier. Its provider failure,
deferred/quarantined counts and cooldown are test inputs, not observed live events.

### Fresh verification

| Check | Actual result |
|---|---|
| `npm --prefix frontend test` | **60 passed, 0 failed**, including six real-route HTTP fixture checks. |
| `npm test` | **209 passed, 0 failed, 9 skipped**; the skipped disposable-PostgreSQL checks remain pending. |
| `npm run typecheck` | Passed. |
| `git diff --check` | Passed. |
| Browser acceptance | Passed the cases below using the local fictional server. |
| Cleanup | Browser tab closed, temporary viewport reset, fixture server stopped; no listener remained on 5174. |

Browser checks used the actual frontend and real local routes, not the fake DOM
action harness. Recorded observations:

- Jordan sample, preferred QA: A confirmed/B omitted immediately showed QA 50%,
  with Backend higher and QA still the selected route.
- Add to learning plan and Not now did not change coverage. Not sure and Not yet
  retained usable 50% results. Have B changed QA to 100% without a new CV.
- Returning to review and reconfirming retained Not yet and its learning goal
  after the review fix. A tied score no longer claimed another route was higher.
- Sam sample, explorer: QA 50%/Backend 0%; the user could choose the QA roadmap.
- Historical scenario: extracted A was recognised, not labelled unknown, but
  contributed zero coverage when absent from both current role lists.
- Prerequisite scenario: C appeared before B with a working detail drawer and an
  explicit no-extra-coverage note. App/provider estimates, year-only publication
  and actual check times were visible. Partial/cooldown status and both queue
  counts were inspectable. Fictional courses were not clickable verified links.
- Empty store: sample extraction showed TRENDS_UNAVAILABLE; no recommendation was
  fabricated. Start over returned to an empty upload screen.
- At 390 x 844, the roadmap/controls remained usable without horizontal document
  overflow. Opening details focused Close; Escape dismissed the drawer.
- No browser console errors were recorded in the final tab. Screenshot evidence
  was captured locally; this is not Replit/live-model evidence.

### Final read-only review and fixes

A fresh reviewer inspected the full Phase 6 range from `f578bd9`, including the
uncommitted fixture files. They reported no Critical issues, one Important
answer-preservation defect, and no additional actionable Minor findings.

The Important defect was reproduced RED before fixing: unchanged reconfirmation
discarded an explicit Not yet; unrelated edits also erased answers/goals. New
actual-app checks now cover unchanged reconfirmation, route/level/other-skill edits
and deliberate Have/Not sure/Leave replacements. The browser also verified the fix.

Browser acceptance exposed an additional incorrect tied-score sentence. A RED
regression reproduced it; the message now checks actual scores, not ordinal rank.
The final full suites above passed after both fixes. There was one review/fix
pass, not a second review presented as regression proof.

Review exclusions were assessed explicitly:

- Modal Tab containment/background inertness is a pre-existing accessibility
  follow-up. Escape/opening focus were checked; this is not a WCAG audit.
- Duplicate background/drawer `data-key` values had no reproduced wrong-skill
  dispatch; clicked-element actions retain the correct skill. Full focus auditing
  remains a follow-up rather than a claim of complete accessibility.
- The backend validates response schemas; no redundant browser copy of every
  deep schema was added beyond registry/version/required-view checks.
- Browser acceptance and documentation were completed by the receiving
  implementer after the read-only review; the reviewer did not perform them.
- Real PostgreSQL locking, live Gemini interpretation, target imports/bootstrap
  and coordinated deployment are Phase 7 gates, not passes from these fixtures.

### Next gate — not performed

Run the nine tests with disposable PostgreSQL and verify independent-connection
locking. Verify one real configured source-to-Gemini-to-advice flow and record the
actual model/version. Confirm target-runtime imports, authorized additive
migration/backup/bootstrap, then release compatible backend/frontend together with
interpretation initially disabled. Do not reset shared storage or reverse the
criteria head. Reconcile actual tools/data/licences/platform evidence and the
submission drafts with the version demonstrated. Main's README link removal must
be preserved in any later approved merge. The leader must confirm current
organizer timing and any repository freeze before publication.

Phase 6 does not implement Domain 1 Feature 6 (multiple future scenarios); its
delivery still belongs in the preliminary proposal. No measured career accuracy,
hiring demand, impact improvement, live model success, GPU use or deployed
readiness is established by this local verification.

### Execution decisions and tradeoffs (recorded at each step)

These are engineering decisions, not additional organizer rules. Later verification above supersedes interim status wording.

- Ruling: Use the feature checkout just synchronized at the user's request; no new worktree/branch — maintains the reviewed branch workflow and avoids a new workspace without consent. Cost: no isolation from concurrent edits; recheck status/staging before committing.
- Ruling: Current explicit user authorization overrides CLAUDE.md's staging/commit prohibition, but not the push prohibition. Stop after every local commit for user review. Cost: incomplete Phase 6 remains local until resumed.
- Ruling: Adapt shell-only task workspace/brief scripts to PowerShell — Git Bash fails before script execution with NtCreateDirectoryObject access denied. Preserve the same ledger/brief/log structure. Cost: manually verify task extraction and completion records.
- Ruling: Keep legacy unversioned role-only catalogue compatibility while requiring complete, valid recognisedSkills whenever criteria or recognition metadata is present — prevents breaking the existing frontend before Task 3 without weakening versioned validation. Cost: the legacy path remains until paired integration; never use it as fallback for malformed versioned data.
- Ruling: Add recordSkillAnswer(session, skillId, answer) for the plan's snapshot-keyed answer ledger; its only data effect is the immutable confirmed-profile/answer update. Ledger values are SkillAnswer arrays; learningChoicesBySkillId is separate. Cost: Tasks 3/4 must consume these explicitly recorded field shapes.
- Ruling: Use request-local results rather than a second persistent cache inside the coordinator. Every accepted reference assignment is guarded in app.js; every confirmation and pathway load reads pinned data anew, including unchanged semantic IDs with changed check metadata. Cost: additional inexpensive reader requests, avoiding stale-cache complexity.
- Ruling: Read the current registry after extraction completes; do not rerun extraction for context repairs. Preserve existing form corrections and default newly recognised entries to unconfirmed/leave until explicitly selected. Cost: sequential extraction/reference latency instead of the former parallel call.
- Ruling: Use a small fake DOM/event boundary in Node checks to exercise actual app actions and stale cache behaviour; browser/layout acceptance remains Task 5. Cost: these checks cannot establish rendered browser accessibility/layout.
- Ruling: Retain the optional proficiency picker because its removal was a separately flagged review option without direct confirmation here. Explicitly explain that it is self-reported and does not affect count coverage. Cost: an extra optional input remains visible; no scoring behaviour changes.
- Ruling: Add a pure stationDetails resolver in roadmap.js and require the full catalogue in buildStations, so prerequisite detail names/data are available without adding role criteria. Cost: all callers/checks must pass the catalogue.
- Ruling: Store possession answers and learning choices separately; commit a possession change only after matching (and the currently open roadmap if applicable) succeeds. Preserve the previous coherent view on failure. Cost: possession actions wait for the required API calls rather than showing optimistic scores.
- Ruling: Check for updates is manual and duplicate-guarded. Busy/cooldown shows actual retry metadata; a premature click announces the limit without a network request. There is no retry timer/polling. Cost: the user must explicitly check again when eligible.
- Ruling: Serve all four explicitly named scenarios on separate /fixtures/<scenario>/ API bases within one local server, with a selected default at /. Asset <base> points to / and a persistent fixture banner sits outside #app. Cost: dev-only HTML is adjusted at response time; production HTML/routes are unchanged.
- Ruling: The prerequisite scenario preloads synthetic failed-provider/deferred/quarantined metadata at a labelled frozen fixture clock. All network/model adapters are blocked or synthetic; no live trends are claimed. Cost: status checks establish display/recovery behaviour only.
- Ruling: Honor the explicit no-push/review-stop instruction over the finishing skill's generic integration menu. Keep this branch and checkout intact; do not propose a merge as if release gates passed.
- Final: Ruling: Keep pre-existing modal Tab containment/background inertness as an explicit accessibility follow-up — opening focus and Escape work, but Phase 6 is not a full accessibility audit. Cost: keyboard focus is not yet confined to the modal.
- Final: Ruling: Duplicate background/drawer data-key values had no reproduced wrong-state dispatch; retain clicked-element actions and record full focus auditing as follow-up. Cost: some focus restoration may remain ambiguous.
- Final: Ruling: Do not mirror every backend response schema in the browser; checked backend output contracts plus registry/version/view guards remain the boundary. Cost: deep response validation relies on the paired backend.
- Final: Ruling: Parent completed browser/layout acceptance and documentation, which the reviewer explicitly excluded from their read-only work. Cost: these observations are implementation-author acceptance, not an independent browser audit.
- Final: Ruling: Leave real PostgreSQL/model/import/bootstrap/deployment to the separate Phase 7 gate; fixtures cannot establish those properties. Cost: this phase is not production release approval.
