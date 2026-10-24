# Dynamic Role Criteria and One-Point Coverage Implementation Plan

**V4 · revised 24 October 2026 MYT after Jong's non-blocking-score decision.** Supersedes V3's unanswered-skill gate. Keep zero possession credit for Not sure/omission/unanswered, preserve uncertainty, return scores/pathways and allow later confirmation from learning guidance. Retains V3's schema, transport, catalogue, retry, owner and release corrections. One-point arithmetic is unchanged; this plan remains unimplemented.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Add automatic source-backed role-criteria updates to the existing backend/QA prototype, with one point per admitted skill, non-blocking possession/learning guidance, real learning/SDG content and a durable last-valid-profile fallback.

**Architecture:** A pure admission/reconciliation kernel consumes bounded publisher updates and the scoped role reference. Immutable PostgreSQL JSON criteria snapshots freeze public roles, capabilities, evidence, resources and SDG links; a transactional pointer selects the current version. Existing engines receive one-point role inputs/citation-only evidence; the frontend pins one version, shows confirmed-coverage scores/pathways without requiring every skill answer and permits later explicit possession updates.

**Tech Stack:** Existing Node >=24 native TypeScript, Express 5.3, Zod 4.6, Prisma 7.10/PostgreSQL, @google/genai 2.30.0, plain HTML/CSS/JavaScript. Add only fast-xml-parser 5.11.2 for RSS.

**Spec:** [Option 2 design](../specs/2026-10-23-automated-trend-rules-design.md). User-approved decisions: dynamic criteria, one point per admitted distinct skill, non-blocking Not sure/omission handling, optional possession questions, no extra-skill/learning-choice penalty, no source-age cutoff, saved-profile fallback without24-hour expiry. The24 October user decision supersedes the earlier pending-score rule, including its first-intake test. Other engineering choices remain proposals in this review draft.

**Baseline:** GitHub main `ed6801577bfeb054de279e69472bae6a7fe89653`, rechecked unchanged on 24 October. The workspace currently contains documents and a selected source snapshot, not a runnable product checkout. This plan has not been executed; no dependency installation, database migration, model call or deployment is implied.

**Path convention:** future code/test/data paths below are relative to the product checkout, not this research workspace. Existing Markdown links resolve to the saved local design. Recheck main before execution; adapt the plan if affected files changed.

## Global Constraints

- CS fresh graduates; `backend-development` and `qa-automation` only.
- Preliminary implementation/testing: features 1–5. Feature 6 delivery is documented.
- Every admitted skill counts exactly once, with weight 1. Never apply legacy +0.5, negative or 1/2/3 importance values.
- Useful older evidence is retained. No 30/90-day publication-age cutoff.
- Preserve the graduate's selected route, fictional-data rules and explicit skill confirmation.
- Keep initial draft-profile confirmation, but no per-skill answer requirement before scores/pathways. Not sure/unanswered/omitted and explicit Not yet each earn0 numerator credit; preserve unconfirmed versus self-reported absence and allow later possession edits. The denominator is still every admitted role criterion, with no extra penalty.
- Keep the last valid role profile on source/model failure; show actual check dates and warning. No 24-hour expiry or outage-only reset/deletion.
- No source-memory news, fabricated resources, courses, dates, statistics or achieved SDG claims.
- No raw CVs, personal profiles or possession/learning choices in database snapshots, publisher requests or trend-model prompts.
- No assistant git add/commit/push. M2 publishes. Stop after each implementation phase, report changed files/checks and suggest a commit message.
- Jong (M3) is the single owner of all seven Feature 2 phases, including the necessary backend/API/database/frontend integration, tests, content readiness and delivery notes. Teammates' existing application/pitch work is retained; their separate implementation is not a prerequisite for these Feature 2 changes.
- Edit only phase-named files across those integration boundaries. M2 provides repository/platform access or git publishing support where required; M4 supplies product review/leader decisions. Neither is assigned a separate Feature 2 coding phase. No unrelated formatting, framework migration or server.ts changes.
- Current model ID/credentials, real database content and deployed runtime remain unverified. Never paste/log secrets.
- Source checks and offline fixtures must be distinguished from real model/integration/deployment verification.

## Review Focus

1. A new tool or covered subpractice inflates the denominator: Tasks 1/3 test existing-over-new mapping and alternative-stack rejection.
2. A refresh races with an older browser response or publication: Tasks 4–6 test atomic pointer changes, pinned contexts and stale-response suppression.
3. Unknown skills block results or become fabricated absence claims: Tasks1/5/6 test normal score/pathway output, unconfirmed labels, versioned denominator explanations and later possession updates.
4. A seed rerun or legacy evidence changes saved criteria: Tasks 2/4/5 test seed preservation and numerical-adjustment isolation.
5. A long outage or database restart loses the fallback: Tasks 4/7 test durable reread; distinguish source failure with working storage from storage itself being unavailable.

## Shared interfaces and HTTP contract

Define transport schemas (`SnapshotId`, `SkillAnswer`, `CriteriaReview`, `SkillReview`, `TrendMeta`, `RecognisedSkill`) in leaf module `src/server/contracts/criteria.ts`, importing only the ID schemas. Define the bundle/policy schemas in `contracts/trends.ts` and re-export the transport types there and from `contracts/index.ts`. This keeps error/response schemas from importing the full bundle back into themselves. Reuse engine input types through type-only imports; downstream tasks use these exact shared names.

| Type | Fields / rules |
|---|---|
| `SnapshotId` | `criteria-` plus 64 lowercase SHA-256 hex characters. |
| `Capability` | `skillId, name, definition, aliases[], observableOutcome, taskIds[], prerequisiteSkillIds[], evidenceIds[]`. Existing canonical IDs remain stable. No model-assigned final IDs. |
| `CriteriaDecision` | `{roleId,skillId,action:"admit"|"retire",reason,evidenceIds:string[]}`. Non-empty reason (maximum 500 characters), at least one evidence ID, and references to retained bundle evidence. At most one latest decision per role/skill pair: admit requires the current association; retire requires its absence but retains the capability. Every current association has an admit decision. Earlier snapshots preserve earlier decisions. No check/attempt timestamps. |
| `CriteriaBundle` | `schemaVersion:1, policyVersion:"count-coverage-v1", roles, capabilities, resources, evidence, sdg, prerequisiteEdges, criteriaDecisions:CriteriaDecision[], sourceContentKeys, interpreterVersion`. Roles include name/description and distinct skill associations with literal `weight:1`, `isRequired`. Reuse existing ResourceInput/EvidenceItem/SdgResponse-compatible shapes, with provenance/estimate-basis fields added explicitly. |
| `RecognisedSkill` | `{skillId,name}` from every capability in the pinned bundle, including retained historical capabilities. This is recognition/display data, not a scored role association. |
| `SourceItem` | `sourceId, providerId, canonicalUrl, title, publishedAt, dateBasis, text, contentHash, extractedLinks[]`. Input dates come from publishers; normalised text is bounded. |
| `CandidateInterpretation` | Supplied source ID, known-skill relation or proposed capability, B/Q task bridge and excerpts, observable outcome, prerequisites, applicability/uncertainty/conflict and selected supplied resource-link IDs. No arbitrary URLs, scores or new final IDs. |
| `AdmissionResult` | `reuse(existingSkillId)`, `promote(candidate)`, `stage(reasons[])` or `reject(reasons[])`. Promote requires all A1–A8. |
| `SkillAnswer` | `{skillId, answer:"have"|"not-yet"|"not-sure"}`; reject duplicate/conflicting answers. |
| `CriteriaReview` | `{fromSnapshotId?,targetSnapshotId,answers?:SkillAnswer[]}`; omitted answers default to[]. Context IDs identify the catalogue, not required answer completion. Omission never manufactures not-yet. Not sure/unanswered remain unconfirmed but do not block results. |
| `SkillReview` | `{fromSnapshotId?,targetSnapshotId,questions:[{skillId,name,roleIds,why,evidenceIds,state:"not-sure"|"unanswered"}]}`. Questions are optional guidance alongside usable results, not a completion gate. |
| `ReconcileResult` | `{status:"ready",profile,snapshotId,review:SkillReview}` for valid version context. Never mutate caller input. Malformed/contradictory input is rejected through normal validation; uncertainty alone is not an error. |
| `TrendMeta` | `snapshotId, policyVersion, status:"fresh"|"partial"|"unavailable"|"disabled", lastSuccessfulCheckAt, lastAttemptAt, providers[], notices[], deferredItemCount, quarantinedItemCount, refreshControl:{state:"ready"|"busy"|"cooldown",retryAt:string|null}`. Check/control/queue metadata is outside the semantic snapshot hash. Failure/skips do not advance check success; waiting or quarantined current inputs make interpretation coverage partial. Counts refer to current source-content/interpreter keys, not superseded audit records. |

Supporting types are defined beside those schemas, or as type-only aliases to the existing engine inputs:

| Type | Exact content used across tasks |
|---|---|
| `HttpFetcher` | `typeof globalThis.fetch`; inject it in every network adapter. |
| `PilotConfig` | The two role IDs, B/Q anchors, allowed foundational IDs, canonical aliases/boundaries, source/resource hosts and SDG rationale templates. |
| `RoleReference` | Release/version and URLs; task records with occupation/task ID, original text/type/date precision; software examples/flags; retrieval/attribution metadata. |
| `VerifiedContent` | `Pick<CriteriaBundle,"roles"|"capabilities"|"resources"|"evidence"|"sdg"|"prerequisiteEdges"|"criteriaDecisions">`; values pass readiness checks, not just TypeScript checks. |
| `ProviderState` | Provider ID, status `ok/unchanged/failed/disabled`, actual attempt/success times, optional error code/ETag/Last-Modified. No article publication date is overwritten. |
| `SourceBatch` | `items:SourceItem[]`, `providers:ProviderState[]`, and retrieved resource candidates `{linkId,url,title,text,contentHash,access:"free"|"paid"|"unknown",checkedAt}`. |
| `InterpretationInput` | SourceBatch items/resources, RoleReference, PilotConfig, base CriteriaBundle and prompt version. |
| `InterpretationBatch` | `{items:Array<{sourceId:string,mappings:CandidateInterpretation[]}>}`; exactly one item per supplied source ID. |
| `QueueItem` | `key,sourceId,contentHash,interpreterFingerprint,state:"pending"|"retry-wait"|"quarantined"|"processed",firstQueuedAt,lastAttemptAt,attemptCount,inputFailureCount,nextAttemptAt,lastErrorCode`. Attempt counts record reserved/dispatched calls; a crash can leave one recorded dispatch without a known outcome. inputFailureCount tracks only input/output-specific failures, maximum3. Key hashes sourceId/contentHash and semantic interpreter context (catalogue/reference/policy/prompt/model), never check timestamps. |
| `QueueState` | `items:QueueItem[],nextWorkClass:"new"|"retry",nextProviderId,modelRetryAfterAt:string|null`. Active items retain bounded source text in the source cache; quarantined keys/reasons remain outside active capacity. Persist with the existing public refresh/cache state. |
| `WorkSelection` | `{kind:"new"|"retry"|"none",keys:string[]}`. At most2 new items, or exactly1 eligible retry item, or no items. Never repeat a failed pair as a retry batch. |
| `InterpretationOutcome` | Validated success with InterpretationBatch, input-output failure with a bounded error code, or provider failure with a bounded error code and optional observed retry-after time. No raw provider errors/secrets. |
| `AdmissionContext` | Base CriteriaBundle, RoleReference, PilotConfig, checked resource candidates and current clock value. |
| `CriteriaDraftResult` | Proposed CriteriaBundle, admitted/retired skill IDs, staged/rejected AdmissionResults and provider states. |
| `CriteriaSnapshot` | `{id:SnapshotId,createdAt:string,bundle:CriteriaBundle}`; timestamps serialise as ISO strings at boundaries. |
| `RefreshState` | Current snapshot ID/null, next/published BigInt generation, provider states, source/interpretation cache, `queue:QueueState`, staged public candidates, lease generation/expiry and next-allowed time. No personal data. |
| `RefreshReservation` | `{status:"acquired",generation:bigint,baseSnapshotId:SnapshotId|null,leaseExpiresAt:string}` or `{status:"busy"|"cooldown",retryAt:string}`. Only acquired reservations may fetch sources or call the model. |
| `PublishResult` | `{status:"published"|"unchanged"|"conflict",snapshot:CriteriaSnapshot|null}`. |
| `CriteriaContext` | `{snapshot:CriteriaSnapshot,meta:TrendMeta}`; every reader derives from this same object. |

Record role-specific admission/retirement reasons with evidence IDs in the bundle's public `criteriaDecisions` collection. Keep check times/attempt status outside its semantic payload. A capability can remain recognised globally while retired from one role. For v1 resource admission, accept verified free access; paid/unknown candidates stay staged rather than invent a low-cost budget threshold.

`CriteriaBundle.capabilities` retains recognised retired historical IDs as well as current ones. Only current role associations enter the denominator; a previously learned capability never becomes an invalid extra skill merely because role membership changes.

Versioned `RolesResponse` requires `recognisedSkills:RecognisedSkill[]`, derived from that same snapshot's complete capabilities, alongside the current `roles` and `criteria`. The frontend builds its recognition/name map from `recognisedSkills`; scoring and new-role questions use only current role associations. A missing registry in a versioned response is a contract error, never a fallback to an incomplete current-role catalogue.

**HTTP:** add `POST /api/trends/refresh` (no CV/profile/arbitrary URL body), `GET /api/trends` and `POST /api/trends/reconcile` with `{profile,review}` (answers optional). Existing GET roles/evidence/sdg accept optional `snapshotId`; match/pathway accept it too. Match keeps its current direct confirmed-profile fields, adding optional top-level `criteriaReview`; pathway keeps `{profile,roleId}`, adding optional sibling `criteriaReview`. A pinned snapshot supplies context even without any possession answers; if both snapshotId/review target exist, they must agree. Keep personal review metadata out of ConfirmedProfile itself.

All versioned results add `criteria:TrendMeta`; normal200 match/pathway/reconcile results include `review:SkillReview` with optional questions and usable outputs. Not sure/omission/unanswered alone never causes409. Unknown explicit versions remain `CRITERIA_UNAVAILABLE` (409); no valid initial snapshot remains `TRENDS_UNAVAILABLE` (503). Missing/mismatched transport version context uses `{error:{code:"CRITERIA_CONTEXT_REQUIRED",message,details?},review:SkillReview}` (409). Extend `contracts/errors.ts`, `routes/errors.ts` and the frontend wrapper to preserve this payload; ordinary errors remain unchanged. The browser reloads the correct context and resubmits once without requiring possession answers; old clients get a clear reload message. A retained explicit pinned version is usable and dated, not silently switched to latest.

Refresh requests use the database reservation below. Busy/cooldown requests return current metadata (200 when a valid snapshot exists, otherwise the existing 503) immediately, without new fetch/model work or fabricated check times. The 60-second cooldown limits repeated work; it is not an age limit for sources or an expiry for saved criteria.

## Task 1 — Pure policy, counting and reconciliation

**Purpose/dependencies:** Establish shared behaviour before source or database work; depends on no new infrastructure.
**Files create:** `src/server/contracts/{criteria,trends}.ts`, paired contract tests, `src/server/trends/{policy,reconciliation,adapters}.ts`, paired `*.test.ts`.
**Files modify:** `src/server/contracts/{index,errors,match,pathway,roles,evidence}.ts`. SCORE_MEANING is defined in `contracts/match.ts`; update it there. Retain the pure matching engine's mathematical signature.
**Interfaces:** `validateCriteriaBundle(input:unknown):CriteriaBundle`; `evaluateCandidate(input:CandidateInterpretation, context:AdmissionContext):AdmissionResult`; `reconcileCriteria(profile:ConfirmedProfile,from:CriteriaBundle|null,target:CriteriaBundle,review?:CriteriaReview):ReconcileResult`; `toCountRoleInputs(bundle):RoleInput[]`; `toCitationOnlyEvidence(bundle):EvidenceInput[]`. Routes validate target context before reconciliation; omitted review answers are allowed.

- [ ] Write failing tests: every A gate has an independent failure case; role/graduate uncertainty stages; aliases/tools/alternative stacks/covered subpractices reuse; unsupported source quote or invented ID rejects.
- [ ] Write schema tests: missing `criteriaDecisions`, unknown references, duplicate role/skill decisions and inconsistent admit/retire associations reject. Valid decisions survive parsing; a retired capability remains recognised globally. Versioned roles expose all recognised IDs, including historical ones.
- [ ] Write count tests: seven-of-ten =70, seven-of-eleven =64, eight-of-eleven =73; extra unrelated skill neutral; confirmation monotonic under fixed criteria; all adapted weights strictly1.
- [ ] Test non-blocking coverage: seven confirmed/ten total yields70% whether the other three are Not yet, Not sure or unanswered; all unconfirmed yields0% confirmed coverage with guidance after explicit profile confirmation. Unreadable CV extraction still errors rather than producing a fabricated empty profile.
- [ ] Write review tests: have updates confirmedSkills and (when newly added) addedSkillIds together, clearing incompatible unconfirmed/removed groups; preserve addedSkillIds subset-of-confirmed. Explicit Not yet, Not sure and omission each receive0 credit, but only Not yet records self-reported absence. All allow ready output with valid context; duplicate/contradictory answers reject. Learning choices never grant possession.
- [ ] Explicit first-intake test: S requires A/B; user confirms A and omits B. With from=target=S and no B answer, return ready with optional B guidance and50% coverage. Not sure and Not yet also yield50%, preserving different states. Later explicit have for B yields100% on the same S. Never manufacture Not yet, require every answer or reupload a CV to update possession.
- [ ] Run `node --test src/server/contracts/criteria.test.ts src/server/contracts/trends.test.ts src/server/trends/*.test.ts`; expect missing-module/export failure before implementation.
- [ ] Implement schemas/kernel/adapters. Reuse existing IDs, role/profile types and score math. Model semantic assertions remain estimates; code validates source support, IDs, allowed scope, resource/SDG completeness and relationship consistency.
- [ ] Extend direction vocabulary to neutral/uncertain for interpretation/citations; use `priorityAdjustment:null` for every adapted evidence row. Never feed legacy adjustments to the selected path.
- [ ] Run targeted tests and `npm run typecheck`; expect pass after dependencies/client setup. No network/model calls in tests.
- [ ] Report files/results; suggested M2 commit: `feat: define dynamic criteria and count coverage policy`.

**Setup folded into this phase:** obtain/reuse a permitted runnable checkout at the pinned product ref via the worktree workflow; do not execute this plan in the research-copy directory. Inspect its instructions/status, install existing locked dependencies and generate Prisma client as required. No branch publication by the assistant.

## Task 2 — Role reference and ready initial catalogue

**Purpose/dependencies:** Produce a genuine baseline rather than scoring placeholder content; depends on Task1. Jong owns Feature 2's reference/rule configuration and baseline readiness, reusing valid teammate content where available. This does not transfer unrelated application content or features to Jong.
**Create:** `src/server/trends/{http,reference,pilotConfig,bootstrap}.ts`, `src/server/trends/{http,reference,bootstrap}.test.ts`, `src/server/trends/data/{role-reference-31.0,pilot-baseline}.json`, `scripts/import-role-reference.ts`.
**Modify:** `prisma/seed.ts` (preserve reviewed content); `docs/m2-technical-notes.md`.
**Interfaces:** `fetchRoleReference(fetcher:HttpFetcher,signal:AbortSignal):Promise<RoleReference>`; `buildInitialCriteria(reference:RoleReference,config:PilotConfig,verifiedContent:VerifiedContent):CriteriaBundle`; `bootstrapCriteria(store:CriteriaStore,bundle:CriteriaBundle):Promise<SnapshotId>` consumes Task4's store when available; pure construction is independently testable. `http.ts` exports `fetchBoundedText(url:string,options:FetchBounds,fetcher:HttpFetcher,signal:AbortSignal):Promise<FetchedText>`; FetchBounds contains allowed hosts, byte/deadline/redirect limits and conditional headers, and FetchedText contains final URL/status/headers/bounded text/byte count. Task3 reuses this helper.

- [ ] Test O*NET's actual object shape: parse `row`, not `column`; select only15-1252.00/15-1253.00. Unknown schema/missing fields/oversize/timeouts fail explicitly.
- [ ] Test that broad software examples, hot/in-demand flags and supervisory tasks do not automatically become junior requirements or weights.
- [ ] Implement pinned31.0 public JSON imports: `https://www.onetcenter.org/dl_files/database/db_31_0_json/task_statements.json` and `software_skills.json` in the same directory. Separate limit:16MiB/table and30 seconds/import; RSS uses smaller limits. Preserve actual date precision/version/attribution.
- [ ] Run `node scripts/import-role-reference.ts`; it writes only the filtered two-occupation `src/server/trends/data/role-reference-31.0.json`, containing attribution/version and original update-date precision. Keep CC BY data/adaptations distinct from the project's Apache source-code licence.
- [ ] Configure B1–B4/Q1–Q4, current16 IDs/aliases/observable boundaries and permitted prerequisite/SDG templates once. Fetch source/reference passages and verify actual resource URLs; no per-news-item manual approval process.
- [ ] Complete the initial bundle with source-supported role associations, working free/low-cost resources, estimated-hours provenance, prerequisites and meaningful role/skill SDG rationales. Reuse valid teammate content if available; reject example.com/placeholder records. Do not make unverified initial rows reviewed by simply flipping a flag.
- [ ] Keep existing IDs; normalise every admitted baseline weight to1 and supply supported `criteriaDecisions` for every initial role association. Validate no duplicate capability, unknown prerequisite, prerequisite cycle, missing role, empty role list or incomplete pathway/SDG record.
- [ ] Protect seed reruns: insert missing demo rows only or preserve any reviewed existing row; never modify snapshots/head. Test rerun preserves reviewed names/weights/resources/SDG content and current snapshot.
- [ ] Run targeted tests plus typecheck. An incomplete baseline is an explicit readiness blocker: continue pure/source work, but do not claim a source-backed current profile until bootstrap succeeds.
- [ ] Suggested M2 commit: `feat: add scoped role reference and verified baseline bootstrap`.

The pinned download is a reproducible reference, not an automatic claim of latest future O*NET release. Keep configured release metadata explicit; invocation-time AI feeds supply live updates. A later reference-release configuration update goes through the same importer and validation.

## Task 3 — Bounded sources, Gemini interpretation and enrichment

**Purpose/dependencies:** Convert real updates into validated draft criteria; depends on Task1 and the reference/config from Task2. Can proceed alongside Task4 against its interface.
**Create:** `src/server/trends/{sources,interpreter,refreshDraft,queue}.ts`, paired tests and `src/server/trends/fixtures/` clearly labelled synthetic test data.
**Modify:** `package.json`, `package-lock.json`, `.env.example`.
**Interfaces:** `fetchSourceItems(previousProviderState,fetcher,signal):Promise<SourceBatch>`; `interpretBatch(input:InterpretationInput,signal:AbortSignal):Promise<InterpretationBatch>`; `buildCriteriaDraft(base:CriteriaBundle,batch:SourceBatch,interpretation:InterpretationBatch):CriteriaDraftResult`; `selectInterpretationWork(state:QueueState,now:string):WorkSelection`; `recordInterpretationOutcome(state:QueueState,work:WorkSelection,outcome:InterpretationOutcome,now:string):QueueState`. Queue functions are pure; refreshService owns dispatch, database time/state persistence and the shared lease.

- [ ] Write network-fake tests for HTTP200/304, real publisher dates, old useful items, missing/future dates, duplicate URLs, excessive body/nesting, redirects, invalid XML, DOCTYPE/ENTITY and source failure.
- [ ] Run `npm install --save-exact fast-xml-parser@5.11.2` in the product checkout and review the lockfile change. Use native fetch/crypto/AbortController and JSON. Parser: entities/value coercion disabled, attributes retained, stable RSS arrays and bounded nesting64; reject DTD/entity declarations before parsing. Decode only predefined/numeric entities; never render publisher HTML.
- [ ] Use GitHub Changelog and JetBrains AI RSS hosts. HTTPS only, at most2 same-host redirects;10 seconds/source;2MiB decoded/source; six dated items/feed;4,000 sanitised text chars/item. Reject dates over5 minutes ahead; missing dates cannot promote. No maximum publication age.
- [ ] Preserve provider+canonical-URL identity/content hashes, remove tracking fragments/parameters and retain accepted historical evidence. Keep quotes/short original summaries and provenance; avoid republishing articles. On HTTP304 reuse interpretations only under the same catalogue/policy/prompt/model context; otherwise retrieve content without conditional validators before reprocessing.
- [ ] Select the at-most-two model work items before resource enrichment. Inspect at most6 actual source/configured official resource links for those selected items per refresh, each bounded by the same10-second/2MiB fetch rules and4,000 text chars. Unknown hosts, paid/unknown instructional access or unsupported links do not pass readiness; leave candidates staged.
- [ ] Use existing @google/genai2.30.0 `models.generateContent`, `responseMimeType:"application/json"`, `responseJsonSchema:z.toJSONSchema(...)`, `temperature:0`, `maxOutputTokens:8192`, cancellation and `automaticContinuation:false`. At most one model request per acquired refresh, containing at most2 uncached source items (at most4 mappings), not all12 discovered items. No SDK migration/new schema-converter package or retry within that refresh; later retries follow the bounded queue policy below.
- [ ] Persist deferred source text/keys in the existing durable source cache; alternate providers when selecting eligible uncached items, then use deterministic source-ID order. Reuse unchanged cached interpretations. Expose `deferredItemCount` and partial coverage until work completes; repeated client clicks cannot drain the queue through the shared cooldown. Retain accepted historical evidence regardless of queue capacity. Bound the deferred queue to48 items (24/provider); on overflow keep oldest-waiting unprocessed entries, skip new entries with an explicit capacity notice, and reconsider them on later feed checks. This is a work/memory bound, not a source-age rejection rule.
- [ ] Add per-key failure state: maximum3 input/output failures (initial attempt plus at most2 later retries); after failure1 wait5minutes, after failure2 wait30minutes, after failure3 quarantine that unchanged input. Retry only on a later eligible invocation, never inside the same refresh. HTTP304, process restart and new check timestamps cannot reset the budget. Changed content or semantic interpreter context creates a new key/budget while preserving the previous audit reason.
- [ ] A failed two-item batch charges one input failure to each included item. Retry those entries individually so one broken article cannot repeatedly poison the other. Alternate eligible new-work and retry-work turns when both exist; within each class alternate providers, then oldest-ready/source-ID order. A new-work turn may handle2 items; a retry turn handles1. Skip waiting/quarantined items. When both classes are eligible, a new-work turn occurs within at most2 acquired model-work turns; retries cannot monopolise later articles.
- [ ] Quarantined items leave active queue capacity and generate a visible skipped-update count/reason; do not delete accepted historical evidence or retire criteria because an input failed. Structurally valid irrelevant/rejected mappings are processed outcomes, not technical failures needing retries. Authentication/quota/network/timeouts are provider failures: record actual attempts but do not increment article inputFailureCount. Back off model work for at least5minutes (respect a later observed retry-after); retain pending items and last-valid criteria. No recurring retry job or manual per-article approval is added.
- [ ] Write failing fake-clock queue tests for5/30-minute eligibility boundaries, third-failure quarantine, failed-pair isolation, fair progress of a healthy later item, terminal irrelevant results, unchanged-content budget preservation, changed-key reset and provider outage without article quarantine. Test max1 model call/refresh and no model work before either shared or model retry time.
- [ ] Require exactly one result per supplied source item, at most2 mappings/item. Bound all strings/arrays: IDs at100chars; each mapping at most4 task IDs,4 prerequisite IDs,4 resource-link IDs and2 support excerpts (20–300chars each); definitions/outcomes/explanations at500chars each. Model selects supplied IDs only. Enforce JSON/Zod and completion checks; token-limit/truncated/omitted/duplicated/oversized output fails the whole batch, records the bounded failure state above and keeps last-valid criteria. No retry inside that refresh. Two items reduce expected output but do not guarantee it fits8192tokens. A structurally valid individual mapping with unsupported semantics is rejected individually.
- [ ] Apply A1–A8 and automatic reuse/stage/promote. App-assigned IDs: preserve existing IDs; new `cap-` plus16 hex chars from canonical task/outcome key, with collision detection. Semantic duplicates are resolved before ID allocation; hashing alone is not deduplication.
- [ ] Learning duration may use a real provider estimate or explicitly labelled app estimate of positive finite hours; never label app estimates as provider facts. Validate SDG IDs/templates/prerequisites rather than invent achieved impact.
- [ ] Tests: ten repeats add at most one criterion; review-AI-tests first maps to existing testing/design when covered; irrelevant/specialist/version/alternative-stack cases do not inflate the list; conflict/missing resource remains staged. Unchanged input reuses stored interpretation; zero admitted skills is a valid refresh. Twelve discovered items produce at most one two-item model request with the rest deferred; provider selection is fair. Oversized/truncated output never publishes a partial batch or triggers a second call; queue overflow is explicit and preserves accepted history.
- [ ] Env placeholders only: `TREND_PROVIDER=disabled|gemini`, `TREND_GEMINI_MODEL` with existing secret configuration reused; reference release is explicit. Disabled returns honest status and last valid profile, never fake live data. Offline tests inject an interpreter.
- [ ] Run targeted tests/typecheck; no paid model calls during unit tests. Suggested commit: `feat: fetch and interpret bounded AI development sources`.

One invocation has a60-second overall deadline; concurrent source/resource reads are bounded and share cancellation, model maximum30 seconds. Frontend refresh timeout65 seconds. Cancellation may not stop provider-side billing; cached unchanged interpretations avoid unnecessary calls. Do not start recurring automation.

## Task 4 — Durable snapshots and refresh publication

**Purpose/dependencies:** Make role updates restart-safe, consistent and recoverable; depends on Task1. Works in parallel with Task3.
**Create:** `src/server/trends/{snapshotStore,refreshService}.ts`, paired unit/integration tests; `prisma/migrations/20261023_dynamic_criteria_snapshots/migration.sql`.
**Modify:** `prisma/schema.prisma`.
**Interfaces:** `reserveRefresh():Promise<RefreshReservation>`; `readSnapshot(id?:SnapshotId):Promise<CriteriaSnapshot|null>`; `readRefreshState():Promise<RefreshState>`; `publishIfCurrent(baseId,generation,bundle,status):Promise<PublishResult>`; `recordFailure(generation,status):Promise<void>`; `releaseRefresh(generation):Promise<void>`. Expose as `CriteriaStore` for fake stores/tests. A semantic no-change success still records actual provider check results, then releases its lease; it does not create a snapshot merely to record health.

- [ ] Add `CriteriaSnapshot`: id/hash, schemaVersion, policyVersion, createdAt, public payload Json; and singleton `CriteriaHead`: key pilot, snapshotId, nextGeneration/publishedGeneration BigInt, attempt/success timestamps, nullable `leaseGeneration:BigInt`, `leaseExpiresAt:DateTime`, `nextAllowedAt:DateTime`, and public provider/cache/candidate state Json. No personal profiles/answers. Validate every payload at write/read; use DateTime timestamps, not day-only @db.Date, for check health/control.
- [ ] Semantic hash includes public criteria/source content/resource/SDG/policy/model identities and `criteriaDecisions`, excluding check timestamps/generation and transport/control metadata. Test decision changes alter the hash and decisions survive storage round-trip. Snapshots are immutable; use migration protections to reject update/delete through the runtime role, and do not garbage-collect history in v1.
- [ ] Reserve using database time in one transaction: active lease returns busy; otherwise now<nextAllowedAt returns cooldown; otherwise increment generation, capture the base head, record attempt, set a75-second lease and nextAllowedAt=now+60seconds. Only acquired workers do network/model work. Cross-instance losers return existing state immediately; do not poll, renew the lease or advance check times.
- [ ] Publish snapshot plus head transactionally only if base head matches, generation is newer and the same unexpired lease is held. Failure/release require matching leaseGeneration and cannot clear a successor's lease. Release in finally; the persisted cooldown survives release/failure. An expired lease is recoverable on the next request without a scheduler. On conflict, keep current result and retry against the new base on a later eligible invocation.
- [ ] Test timestamp-only success keeps ID; duplicate content does not insert another semantic version; older/competing publications cannot clobber a newer head. Validate one-point and all content readiness before publishing.
- [ ] Persist processed-source identities, short retained evidence/interpretation cache, queue counters/next-attempt/quarantine/fairness state and staged candidates under the same lease guard. Record dispatch/fairness advancement before the model call; a crash may leave a recorded attempted dispatch, never a free reset of the queue position. Simulate restart between failures and prove budgets/waits survive; an expired worker cannot overwrite a successor's queue state. Provider failures preserve prior timestamps/accepted history. Batch failure does not publish partial interpretation.
- [ ] Keep at most one worker per process; duplicate callers in that process also return busy metadata immediately rather than awaiting the worker. The database lease prevents duplicate paid work across instances, while CAS also protects publication. Test simultaneous reservations from independent store instances yield one acquired worker; cooldown/failure/restart keep work bounded; a stalled expired worker cannot publish or clear its successor's lease. Partial successful providers may publish a coherent validated merge retaining failed-provider history and partial status. Deferred work is partial, not complete coverage.
- [ ] Prove fallback after24+ hours and simulated restart rereads the same valid snapshot and score; check metadata warns rather than expiring criteria. With no snapshot, return unavailable. If storage itself is unavailable, return unavailable and let the browser retain its labelled previous view; do not claim a fresh server fallback.
- [ ] Run unit tests with an in-memory CriteriaStore and transactional tests only on an explicitly configured disposable `TEST_DATABASE_URL`. Never target the team/production database automatically. Without test storage, mark database-concurrency verification pending rather than claim pass.
- [ ] Run Prisma generate/typecheck and inspect migration. Suggested commit: `feat: persist immutable role criteria and last valid fallback`.

## Task 5 — Integrate all backend readers with one criteria version

**Purpose/dependencies:** Make the app consume the automatic criteria, not merely show detached news; depends on Tasks1–4.
**Create:** `src/server/routes/trends.ts`, `src/server/trends/{context,presentation}.ts`, `src/server/routes/trends.test.ts`, `src/server/trends/{context,presentation}.test.ts`.
**Modify/create tests as applicable:** `src/server/routes/{index,roles,match,pathway,reference,errors}.ts` and `src/server/routes/{roles,match,pathway,reference,errors}.test.ts`; `src/server/contracts/{match,pathway,roles,evidence,sdg,errors}.ts`. Adapt externally rather than change the pure pathway function if possible; if necessary, explicitly name `src/server/pathway/pathwayEngine.ts` in the phase report.
**Interfaces:** `loadCriteriaContext(snapshotId?:SnapshotId):Promise<CriteriaContext>`; `createTrendsRouter(deps:TrendsRouteDeps)` where deps exposes `refresh():Promise<TrendMeta>`, `loadState():Promise<TrendMeta>` and `reconcile(profile:ConfirmedProfile,review:CriteriaReview):Promise<ReconcileResult>`; `createRolesRouter({loadContext})` replaces the current direct-Prisma roles router. Versioned MatchRouteDeps/PathwayRouteDeps/ReferenceRouteDeps use the same `loadContext` signature plus `loadSnapshot(id:SnapshotId):Promise<CriteriaSnapshot|null>` for previous-version reconciliation. All match/pathway/reference data derives from one loaded target context per request.

- [ ] Add the shared HTTP routes/metadata/review errors specified above; test invalid/unknown version and malicious/arbitrary refresh input. Preserve legacy body fields and explicit schema validation.
- [ ] Preserve optional review questions alongside normal200 match/pathway outputs. Extend ApiFailure/sendError/errorHandler for validated top-level review only on CRITERIA_CONTEXT_REQUIRED; test real409 context mismatch transport with intact target/question IDs, and unchanged ordinary errors. Unanswered skills alone must produce usable200 results, not409.
- [ ] Resolve one snapshot first, then derive role/skill/resource/evidence/SDG readers from it. Return `recognisedSkills` from all retained capabilities in versioned roles. CV extraction's catalogue loader uses that current canonical registry; matching recognition includes historical extra IDs. Test retirement preserves the ID/name in the registry but excludes it from current scored associations. Do not mix a current Skill table read with an older pinned role bundle.
- [ ] Reconcile before match/pathway; verify snapshot target and criteriaReview target agree. Missing/mismatched transport context returns a context response; a retained pinned snapshot is valid. Do not silently switch versions or confuse an unanswered skill with missing version metadata.
- [ ] First-intake route regression: CV-omitted B, confirmed A and from=target produce200 match/pathway with50% coverage, optional B question and learning step, without a fabricated Not yet answer. Later confirming B returns100%. Snapshots/database still contain no personal possession state.
- [ ] Match: `matchRoles(ready.profile,toCountRoleInputs(bundle),[])`. Pathway: same one-point role input and snapshot resources plus `toCitationOnlyEvidence(bundle)`, never null/raw legacy numerical evidence. Keep mathematical signatures where possible.
- [ ] Update SCORE_MEANING/labels to one-point confirmed-profile coverage: unconfirmed skills are not counted yet and can be added later. Preserve the existing pathway inclusion of not-confirmed skills and label optional learning versus explicit Not yet accurately. Add source/denominator-change explanations without implying lost ability, hiring probability or measured proficiency.
- [ ] In presentation, fill prerequisite data, topologically order required prerequisites first, then contextual supported gaps, then stable skill-ID ties. Preserve user route; explain estimates and uncertainty. A cycle fails candidate readiness rather than making the route hang.
- [ ] Add source-time metadata without rewriting publication dates. Public existing day fields may remain for compatibility; expose ISO check/publication precision and original/app interpretation labels through explicit optional fields. No fictitious human review claim.
- [ ] Test busy/cooldown refresh requests return current metadata/control times without fetch/model calls; no initial snapshot returns503 rather than a fake current profile. Deferred/quarantined counts and failed-provider times remain accurate; quarantined inputs do not become role retirements.
- [ ] Tests exercise all API readers against the same old/new snapshot, unanswered/Not sure with usable outputs, cached fallback, historical IDs and retirement. Inject legacy +0.5/negative/non-1 inputs; neither engine uses them. Replace obsolete outage-reset and pending-score expectations.
- [ ] Run `npm test`, `npm run typecheck` and configured store integration tests. Suggested commit: `feat: integrate versioned criteria with matching and pathways`.

## Task 6 — Extend the existing frontend confirmation journey

**Purpose/dependencies:** Jong extends the existing frontend for Feature 2, preserving user control; depends on Task1 API shapes and Task5 integration. He can prepare these changes against labelled fixtures before backend integration. No separate M1 implementation handoff is required.
**Create:** `frontend/public/js/trends.js`, `frontend/checks/trends.check.mjs`.
**Modify:** `frontend/public/js/{api,app,profile,roadmap}.js`, `frontend/public/styles.css` only for the new question/status controls; `frontend/package.json`; existing profile/roadmap checks as needed.
**Interfaces:** `buildOptionalQuestions(previousRoles,nextRoles,profile,answers)`; `mergeSkillAnswers(profile,answers)`; `learningChoice(state,skillId,choice)` are pure helpers. API adds `refreshTrends()`, `trends()`, `reconcile(profile,review)`; existing methods accept snapshot/optional review options and expose normal200 guidance plus typed409 context-error data.

- [ ] Test a source update introducing an unconfirmed skill returns the new coverage/pathway with an explanation and optional Have / Not yet / Not sure controls. Not sure, skipping or leaving controls unanswered never blocks results. Confirmed canonical skills need no repeated question.
- [ ] Add accepted/loading snapshot IDs, provider status, possession answers and separate learning choices in page memory. No per-skill pending-score state or real CV/profile persistence.
- [ ] Extend api.js to preserve normal200 review payloads and validated409 context payload/status. Test automatic context reload/resubmission at most once, with no answer requirement or retry loop; keep ordinary/network error handling.
- [ ] Change profile.js `skillCatalogue()` to read the complete versioned `recognisedSkills` registry. A retired confirmed skill remains named/confirmed and never becomes an unknown warning; only current role associations count. Add frontend profile/refresh tests for retained historical and truly unknown IDs; reject malformed versioned catalogue responses rather than silently shrinking the map.
- [ ] In confirmProfile(), request refresh once, then load the returned/current snapshot, reconcile and match. Busy/cooldown uses the saved snapshot with honest status/retry time; never loop or automatically retry to bypass work limits. Keep the existing profile builder's disjoint-group protections; do not treat leave/notsure as an explicit Not yet answer.
- [ ] First-intake browser test: omit B, confirm A, leave B unchecked and complete initial profile confirmation. Show50% coverage and B learning guidance immediately. B remains unconfirmed; no fabricated Not yet answer. Repeat with Not sure and explicit Not yet; both still yield results. The initial draft-profile confirmation remains mandatory, not every skill answer.
- [ ] Invalidate roles/evidence/SDG caches when the version changes and on an explicit refresh; restart must not silently retain an obsolete catalogue. Carry one accepted snapshot through role/match/pathway/evidence/SDG requests.
- [ ] Suppress late responses using requestId; pin every result/question/edit to its accepted version. A refresh during optional guidance cannot apply answers to different IDs or mix old/new denominators.
- [ ] Reuse evidenceItem/evidencePanel and route/roadmap UI. Show original source date, actual last check, partial/unavailable status and the changed criterion. Use the approved See why it matters / Add to my learning plan / Not now actions.
- [ ] Add I already have this to guidance: explicit possession confirmation updates the profile and reruns matching/pathway against the same snapshot (50→100 in the A/B fixture). No new CV upload is needed. Opening a resource/adding a learning goal does not award credit. Optional skip/Not sure keeps guidance and scores usable.
- [ ] Show waiting/skipped-update counts and a plain notice when current articles are retrying/quarantined; keep the last valid recommendations usable. Do not describe a technical processing failure as evidence that a skill is obsolete or unimportant.
- [ ] Confirm learning-choice tests: Add does not grant a skill; Not now causes no extra reduction; a source outage after24+ hours keeps the saved criteria/result with warning. Learning goals can be shown as a separate roadmap suggestion without changing possession.
- [ ] Remove the misleading weight1=nice-to-have label. Extend prerequisite/context ordering checks without unnecessary visual redesign.
- [ ] Update frontend test script to include `checks/trends.check.mjs`; current script lists only two files. Run `npm --prefix frontend test`, root tests/typecheck and a browser walkthrough using fictional backend/QA samples.
- [ ] Suggested commit: `feat: explain dynamic skill updates before recalculating coverage`.

## Task 7 — Verify, document and hand off deployment

**Purpose/dependencies:** Jong owns complete Feature 2 integration verification, demo readiness, documentation and deployment preparation across all previous tasks. A credentialed teammate supplies target-platform access or performs restricted publishing where necessary; M2 remains the git publisher under repository rules. General team pitch/signature responsibilities remain outside this Feature 2 implementation plan.
**Create:** `docs/feature-2-live-verification.md`, `docs/feature-2-scenarios.md`.
**Modify:** `docs/m2-technical-notes.md`, `.env.example` as necessary; the existing PRD/tools-declaration drafts in this workspace. No root README edit unless explicitly requested.

- [ ] Run root/frontend tests, typecheck and disposable database round-trip/CAS checks. Record commands/results/limits; skipped checks are not passes.
- [ ] On the configured development environment, verify one real public-source Gemini interpretation and source-to-advice result. Keep model version/date and citation trace; no keys/CVs in logs.
- [ ] Verify unchanged refresh, irrelevant source, existing-skill update, alias/tool, conflicting claim, staged incomplete candidate and long-outage fallback. Controlled fictional admission inputs remain clearly labelled test fixtures; never present a fictional publisher as live evidence.
- [ ] Rehearse bad-item wait/retry/quarantine with healthy-item progress. Rehearse first-intake omission/Not sure: results and guidance remain usable at50% for A/B, with later possession confirmation raising coverage to100% without reupload.
- [ ] For real ready new criteria or labelled fixtures, verify7/10→7/11≈64% for Not yet, Not sure or unanswered; confirming possession gives8/11≈73%. Explain changed criteria and unconfirmed coverage, with no extra Not now penalty. Test one version across every reader.
- [ ] Jong prepares/records the complete release/config and database backup/migration runbook; use authorised target access or a credentialed operator only where needed. Apply only additive snapshot/control migrations; verify runtime immutability/permissions and seed preservation, then bootstrap a validated baseline only if no current head exists. Never replace an existing valid head just to deploy.
- [ ] Prepare/deploy matching backend/frontend together, initially TREND_PROVIDER=disabled. Verify snapshot reads, recognised catalogue,200 optional guidance,409 genuine context-error transport and non-blocking one-point matching before enabling live interpretation. Keep public traffic on the previous coherent release until all new instances are ready, or use coordinated maintenance; no incompatible mixed rollout.
- [ ] Open the complete journey in another browser/session: initial profile confirmation, score, optional questions, pathway/resources, SDG and source/status. Old clients get a reload/context message; unanswered possession questions never block. Enable Gemini only after all serving instances support the active schema/policy/frontend. A deployment commit alone is insufficient.
- [ ] Rehearse recovery: disable trend publication first, preserve the current snapshot/head/history, and roll backend/frontend back together only to a release that understands the active contract; otherwise use a compatible corrective release. Do not automatically reverse migrations, reset criteria, move the snapshot pointer backwards or restore a database backup as routine rollback. Confirm last-valid reads/reconciliation still work with interpretation disabled.
- [ ] Update actual technical/model/parser versions, sources/licences/attribution/adaptations and platform-use evidence. Keep Replit/RunPod declarations tied to work actually done; no invented GPU use or signatures.
- [ ] Update PRD and pitch claims to one-point app-estimated pilot coverage, automatic admission, uncertainty and human learning choice. Document Feature6's multiple-scenario delivery; do not claim it implemented.
- [ ] Record still-missing baseline/KPI/submission evidence separately. Follow the already-recorded official submission checklist; do not treat the working prototype as the entire submission.
- [ ] Suggested commit: `docs: record verified dynamic criteria and preliminary demo scope`. Provide changed files, actual test results and remaining deployment/submission items; M2 handles git publication.

## Coverage and parallel work

| Requirement / verification | Owning tasks |
|---|---|
| Source/date/provenance, no age cutoff; A1/D02/D11/D16 | 2,3,4,5 |
| Role scope, distinctness, prerequisites; A2–A6/D03–D05/D12 | 1,2,3 |
| Actual resources/time/SDG; A7–A8/D14–D15 | 2,3,5,7 |
| One-point score, extra skills, no old numerical effects; D01/D07/D10 | 1,5,6 |
| Non-blocking zero-credit uncertainty, later possession editing and independent learning intent; D06/D08–D09 | 1,5,6,7 |
| Snapshot hash, race, fallback and API/frontend consistency; D11/D13 | 4,5,6,7 |
| Decision-record completeness and round-trip; R1 | 1,2,4 |
| Normal optional-review transport and genuine version-context errors; R2 | 1,5,6 |
| Historical skill recognition across API/UI; R3 | 1,5,6 |
| Shared refresh budget, output limits and deferred work; R4 | 3,4,5,6 |
| Coordinated release and compatible recovery; R5 | 7 |
| Bounded retry/isolation, restart-safe counters and healthy-item progress; R6 | 3,4,5,6,7 |
| One named integration owner across all seven phases; R7 | All tasks |
| First-intake omission stays unconfirmed but allows score/pathway; later confirmation updates coverage; R8 | 1,5,6,7 |
| Real vs fixture demonstration; D17 and final delivery | 7 |

After Task1, Jong can sequence or delegate reference/content work and snapshot storage independently; source adapters can use reference fixtures until Task2 is ready. He can prepare UI against the frozen HTTP contract. This is technical parallelism within one owner's work, not a split among teammate implementation owners. Task5 blocks live integration; Task6/7 block a truthful complete-journey claim. No automatic new-skill admission is removed to save time; if readiness is missing, report it and demonstrate the working narrower scope honestly rather than fabricate completion.

**Main dependencies:** a runnable product checkout, verified initial content, configured Gemini model/key, disposable PostgreSQL for transactional verification and authorised target/repository publishing access (teammate support only if needed). None requires posting a secret in chat. A missing dependency blocks its verification/deployment step, not unrelated pure work.

**Scope/risk:** automatic new criteria, resources, snapshots and profile reconciliation are more work than a known-skill evidence hook. The preliminary deadline makes a minimal coherent integration important: no new framework, user accounts, training, popularity leaderboard, general web crawler or scheduler.

## Planner self-review and review handoff

- [x] Every A/D requirement maps to a task and named verification.
- [x] Shared names/contracts align across kernel, store, routes and client.
- [x] M4 corrections R1–R5 retain explicit fields/files/tests; R2 now carries optional guidance and genuine context errors, not an unanswered-skill gate.
- [x] R6–R8 retain bounded retries and Jong's ownership; the latest user decision replaces R8 with non-blocking omitted/Not sure handling and later possession editing.
- [x] No frozen-score Option1, ±0.5 policy, age cutoff or24-hour expiry is reintroduced.
- [x] Tests cover the five Review Focus cases; no unit test depends on a paid model or live publisher.
- [x] Known blockers/readiness and real-vs-fixture evidence are explicit.
- [x] Code bodies are left to the implementer; signatures, exact limits and expected behaviours are fixed here.

This is saved for the user's review before implementation, as requested. Recommend native execution in this conversation, one phase at a time, because the tasks share contracts and one snapshot lifecycle; use independent review at integration. Subagent-driven execution is an alternative if the user prefers independent implementers/reviewers for each phase.

Primary implementation references: [fast-xml-parser5.11.2](https://github.com/NaturalIntelligence/fast-xml-parser/releases/tag/v5.11.2), [tagged parser declarations](https://raw.githubusercontent.com/NaturalIntelligence/fast-xml-parser/v5.11.2/src/fxp.d.ts), [Gemini structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), [pinned SDK types](https://raw.githubusercontent.com/googleapis/js-genai/v2.30.0/src/types.ts), [Zod JSON Schema](https://zod.dev/json-schema), [O*NET task JSON](https://www.onetcenter.org/dl_files/database/db_31_0_json/task_statements.json), [O*NET software JSON](https://www.onetcenter.org/dl_files/database/db_31_0_json/software_skills.json).
