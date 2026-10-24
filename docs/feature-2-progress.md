# Feature 2 implementation progress

Owner: Jong (M3). Working branch: `codex/feature-2-automation`.
Approved basis: V4 automation/scoring design and implementation plan, reviewed24 October2026.

The user authorizes small commits and publication to this feature branch,
superseding CLAUDE.md's earlier M2-only commit restriction for this work.
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

Phase1 is in progress. Later phases have not been implemented.

1. Shared schemas and versioned contracts, with backwards-compatible legacy endpoints.
2. Source/canonical admission rules, stable identity and one-point/citation-only adapters.
3. Non-blocking possession reconciliation and integrated offline verification.

The existing weighted engine's score meaning stays accurate. A separate count-coverage
response/meaning is defined for the versioned integration; Phase5 will select it.
Publication dates retain their true precision; year/month-only evidence gets no invented day.

## Verification limits

Baseline:74 backend tests passed and TypeScript checking passed using the locked packages.
New checks use clearly synthetic sources/catalogues only. No live Gemini call, source
refresh, database migration, populated baseline or deployed Feature2 flow is claimed.

After Phase1: scoped role-reference/baseline work, live interpretation, durable snapshots,
API/frontend integration, then actual deployment/demo checks, each in its own phase.
