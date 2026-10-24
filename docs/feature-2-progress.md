# Feature 2 implementation progress

Owner: Jong (M3). Working branch: `codex/feature-2-automation`.
Approved basis: V4 automation/scoring design and implementation plan, reviewed24 October2026.

The user authorizes local implementation and small commits on this feature branch,
superseding CLAUDE.md's earlier M2-only commit restriction for this work.
Latest instruction (24 October): pause and notify the user before EVERY push.
At the Phase2 coding checkpoint, the work had not been pushed. The user subsequently
authorised publishing that checkpoint with a self-contained handoff; future pushes
still need their own pause/notification. Keep a conservative 15% session-token reserve.
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
is implemented locally below; Phases3–7 have not been implemented.

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
this Phase2 checkpoint. The user reviewed the checkpoint and authorised the publication
accompanying [HANDOFF.md](../HANDOFF.md); future pushes still require a pause/notification.

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
that the current stored dates are fabricated.

The review explicitly deferred later-phase refresh/queue controls, durable publication,
restart fallback and browser/version integration. Native-import success on the target
runtime and real database/deployment verification also remain pending. The valid offline
checkpoint does not establish any of those capabilities.
