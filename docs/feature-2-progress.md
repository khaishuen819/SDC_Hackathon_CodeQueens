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

Phase1's offline foundation is complete. Later phases have not been implemented.

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
