# Automated Feature 2 — Option 2 rule proposal

> Repository handoff copy, 24 October 2026: technical requirements are preserved.
> Planning-time status below is historical; see [current handoff](../../../HANDOFF.md).
> Five unavailable original-workspace links were converted to provenance text below;
> current domain/context references point to files included in this repository.

**23 October 2026 MYT · Code Queens · Feature 2 integration owner: Jong (M3).**

**V4 · revised 24 October after Jong's non-blocking-score decision.** Retains V3's retry controls, single integration owner and corrected interfaces. Supersedes its unanswered-skill score gate: Not sure, omission and unanswered questions receive no possession credit but do not prevent scores or learning guidance. Preserve their unconfirmed status rather than fabricating a Not yet answer. No application code has been changed.

**Confirmed direction:** Option 2. Validated source information may automatically update a pilot role's scored criteria, including genuinely new skills. Offer optional possession questions and learning guidance; do not hold results until every skill is answered. A growing denominator can lower confirmed coverage; extra/unrelated skills and choosing Not now receive no separate penalty.

**Status:** Jong approved **one point per admitted, distinct capability**. Option 2, the learning-choice flow and last-valid-profile fallback are confirmed. The admission/technical details below accompany the implementation plan for review; they are proposed engineering rules, not measured occupational importance or matching accuracy. No product code or deployment has been changed here.

## 1. Confirmed constraints and approaches

- CS fresh graduates; `backend-development` and `qa-automation` only.
- Preliminary implementation/testing: features 1–5. Feature 6 delivery is documented.
- Real publisher feeds + Gemini interpretation + fixed application checks; no manually maintained evidence cards or per-article human approval.
- Useful older evidence is retained. No 30/90-day publication-age cutoff. Keep original source dates separate from retrieval/check timestamps.
- Preserve the graduate's selected route, fictional-data rules and explicit skill confirmation.
- After the initial profile confirmation, return current confirmed-coverage scores and pathways even when some skills are Not sure, unanswered or omitted. Only explicitly confirmed possession earns numerator credit. Users can recognise a skill in guidance, confirm it and recalculate without updating/reuploading the CV first.
- On source/model failure, keep the last valid role profile, warn that updates could not be checked and show actual last-successful-check times. No 24-hour expiry or outage-only score reset/skill deletion. Retry on the next eligible invocation under the shared work cooldown below; skipped requests still use saved data. With no valid prior profile, report unavailable.
- Option 1 (fixed scored criteria, changing learning suggestions) was considered. Option 2 was chosen for automatic scored-criteria updates.
- Earlier known-catalogue-only +0.5 rules are archived (original path `archive/2026-10-23-known-catalogue-trend-rules.md`, not bundled), not operative defaults.

## 2. Sources and the meaning of a scored criterion

Use two complementary evidence classes:

1. **Role reference:** public versioned O*NET task/software data for Software Developers `15-1252.00` and QA Analysts and Testers `15-1253.00`, narrowed by our pilot task scope below. Store source/version/update-date provenance and retrieval time; no API account should be required merely to use the public downloads.
2. **Changing AI capabilities:** the configured GitHub Changelog and JetBrains AI feeds, checked at invocation. Actual feed dates and URLs come from retrieval, not Gemini.

O*NET describes broad US occupations and includes work outside a graduate backend/QA pilot. Software examples are not universal requirements; downloaded software-skill rows do not provide our exact technical-skill importance scores. Do not claim current Malaysian vacancy demand, employer necessity or entry-level suitability merely from an occupational association.

A scored entry is an **app-estimated learning capability relevant to this pilot role profile**, not a declaration that every employer requires it. Actual sources, the app's task bridge and interpretation limits are inspectable.

**One-time scope configuration, not recurring article research:**

| Anchor | Graduate pilot task scope |
|---|---|
| B1 | Implement and check HTTP/API request and response behaviour. |
| B2 | Query, structure and protect application data/access. |
| B3 | Reproduce faults and verify server-side behaviour. |
| B4 | Maintain code changes and run basic delivery/deployment workflows. |
| Q1 | Derive test cases and coverage from software requirements. |
| Q2 | Execute and maintain functional/API automated checks. |
| Q3 | Diagnose failures and report reproducible defects. |
| Q4 | Run and interpret automated checks in a delivery workflow. |

These B/Q IDs and boundaries are our product scope, not O*NET task identifiers. Link relevant reference excerpts to them during initial import. Existing skill definitions/aliases, foundational prerequisites, allowed source hosts and permitted SDG rationale templates are configured once. Do not import management/supervision tasks or every language/framework listed for the broad occupation.

## 3. Automatic candidate admission — all gates must pass

Gemini supplies structured interpretations and support excerpts; application code evaluates the declared gates. Exact source quotes/schema checks do not prove the semantic judgment true. Evaluate misleading cases and label outputs as estimates.

| Gate | Required evidence/check | If it does not pass |
|---|---|---|
| A1 Actual source | Successfully retrieved allowlisted source, original URL/date, and a support excerpt present in the supplied text. Missing/far-future dates, fabricated quotes/IDs and malformed records are rejected. Age alone never rejects an item. | Reject the claim with a reason. |
| A2 Role-task bridge | A valid B/Q anchor plus an explicit explanation supported by the role reference and capability text. | Unrelated claims are rejected; uncertain/specialist-only fit remains a suggestion. |
| A3 Observable capability | A learnable action/outcome and an example of successful use, grounded in the source. A product name, price, popularity or marketing phrase alone is insufficient. | No scored promotion. |
| A4 Canonical distinction | Compare definitions and aliases with the current catalogue. Same/alias/tool-for/version-of/example-of/subpractice-covered-by reuses the existing skill. Only a distinct capability can get a new application-assigned ID. | Reuse the known skill or stage uncertainty; never double-count. |
| A5 Route and graduate fit | Fits the selected scope and stated foundational prerequisites. An alternative language/framework for an already-covered task does not automatically add another scored requirement. | Optional alternative/specialisation, not a compulsory scored entry. |
| A6 Coherent support | No unresolved correction or contradiction concerning the admission claim. Neither article count nor newest-publication-wins resolves disagreement. | Keep a candidate uncertain; retain last-valid criteria where needed. |
| A7 Learning readiness | A retrieved working free/low-cost resource actually teaches the capability, with prerequisite information and an honest time estimate. Provider estimates and app estimates are labelled distinctly. | Stage the candidate; do not fabricate a complete pathway. |
| A8 SDG readiness | At least one valid goal ID and a task-specific rationale using the pilot's permitted mapping templates; describe a possible contribution, not achieved impact. | Stage the candidate until enrichment succeeds. |

A1–A8 are Boolean eligibility conditions, not a scientific confidence score. Passing them is an automatic prototype estimate, not human review or proof of occupational necessity. No minimum number of articles, fixed waiting period, popularity rating or model-confidence threshold is used.

**Resource enrichment:** first use existing verified catalogue resources or actual links extracted from the supplied source, then configured official documentation/tutorial hosts. Fetch only retrieved/configured URLs; do not invent links or fetch arbitrary model/user URLs. A release announcement without instructional content is evidence, not automatically a learning resource. Missing content leaves a staged candidate and an honest limitation.

**Decision:** existing capability → update evidence/explanation or contextual learning advice; distinct capability with all gates passed → publish skill + role association + source/resource/SDG data atomically; incomplete/uncertain → suggestion/candidate only. A refresh admitting no new skill is valid.

## 4. Approved scoring convention

**One point per admitted, non-overlapping capability is approved.** Sources control which capabilities enter or leave the role profile, rather than generating unsupported fractional importance numbers.

`score = round(100 × confirmed admitted capabilities / all admitted capabilities)`

Use Jeremy's existing weighted engine with every admitted weight set to `1`. Initialise a coherent source-supported pilot catalogue; do not mix old placeholder 1/2/3 weights with new one-point entries. Do not apply the earlier +0.5 adjustment. This counts coverage of our selected capabilities; it does not claim all skills are equally important in employment.

Known limitations: granularity affects a count score. A broad existing skill and a narrow newly named subpractice must not both count when the former already covers the latter. Prefer reuse over new admission when uncertain.

**Illustrative arithmetic:** 7/10 = 70%; adding one genuine criterion gives 7/11 ≈ 64% if not yet known, or 8/11 ≈ 73% if already known. Not now and Add to learning plan cause no additional change. With identical criteria, confirming another relevant capability cannot lower coverage; an unrelated skill changes neither numerator nor denominator.

Different importance weights are outside the selected preliminary scoring policy. O*NET software flags, article counts and Gemini guesses must not become hidden weights.

## 5. Profile reconciliation and learning choices

New criteria are published with a version. Compare that version with the user's profile, reuse confirmed canonical skills and expose optional questions for newly introduced/unconfirmed skills. Only confirmed possession counts; all admitted role criteria stay in the denominator. Not sure/unanswered/omitted and explicit Not yet have the same zero numerator credit, while their epistemic states remain different. The result measures confirmed profile coverage, not all actual ability.

| Response | Profile and score behaviour |
|---|---|
| Already have it | Explicitly confirm possession, then include it in the numerator. |
| Not yet | Record the answer without possession credit, calculate against the new list and offer learning support. |
| Not sure / unanswered / omitted from CV | Keep unconfirmed, give no possession credit for now, and return the score/pathway normally. Suggest learning or checking existing knowledge; let the user confirm later. Do not manufacture an explicit Not yet answer or claim measured lack of ability. |

Use: See why it matters · Add to my learning plan · Not now. Source/date/task connection are visible through the explanation. A learning goal is separate from possession; Not now does not remove a role criterion or impose another penalty. Guidance also offers I already have this: that action explicitly confirms possession, updates the profile and recalculates against the same pinned criteria. No second confirmation or new CV upload is required. Merely opening a resource or adding a learning goal never grants possession. Initial profile confirmation is retained.

**First CV intake:** a scored skill omitted from the CV remains unconfirmed but does not block results after the user confirms their draft profile. In a two-skill role, confirming A and omitting B yields50% confirmed coverage and optional guidance for B; Not sure or explicit Not yet also yields50%, while later confirming B yields100%. Equal from/target IDs never force additional answers. Explain that unconfirmed skills are not counted yet and can be updated. Possession answers stay in page memory/request metadata, not public snapshots.

Optional questions and target version travel as `review` alongside normal200 match/pathway/reconciliation results. Unknown/unanswered skills alone never produce409. Real missing/mismatched transport context uses409 `CRITERIA_CONTEXT_REQUIRED` with preserved review/context payload through server middleware and the browser wrapper; the client reloads the correct catalogue and retries once without demanding possession answers. Unknown explicit snapshots remain409 `CRITERIA_UNAVAILABLE`. The full versioned `recognisedSkills` catalogue still includes retained historical skills.

## 6. Changes, consistency and failures

- Interpret unchanged source content once per catalogue/policy/prompt/model fingerprint; reuse its stored result. A new timestamp alone does not change criteria, score or advice.
- Repeated/syndicated items and alternate names do not add criteria. Source identity is provider + canonical URL; strip tracking parameters, preserve meaningful URL data.
- Retain historical evidence outside the rolling feed. A successful feed check does not revalidate an absent historical article or make its publication date new.
- A verified correction/retraction of the sole admission basis can retire the affected criterion in a new version. Remove neither the user's actual skill nor unrelated criteria. A tool retirement alone does not retire a general capability. Unresolved conflict is labelled, not silently settled by age or frequency.
- Match, pathway, roles and evidence use one criteria/evidence/resource version. Publish atomically; an older-started refresh cannot overwrite a newer success.
- Each bundle explicitly contains `criteriaDecisions`: latest role/skill admit-or-retire decisions with a reason and retained evidence IDs. Current associations have admit decisions; retirement removes an association while retaining the actual capability. Validate these records, include them in the semantic hash and preserve them across snapshot storage.
- One database-backed refresh lease coordinates every serving instance:75-second lease, at least60 seconds between reservation starts, using database time. Only the lease holder fetches sources/calls Gemini; busy/cooldown requests return saved status immediately without inventing a new successful check. Publication requires the same unexpired lease plus version/generation checks. This cooldown controls cost, not source age or saved-data usefulness.
- Discover at most six items/feed but interpret at most two uncached items in one model request per eligible refresh, with explicit array/string bounds. Persist deferred work, select fairly across providers, and show partial coverage/deferred/quarantined counts. Reuse unchanged interpretations. Truncated/oversized/incomplete output is not partly accepted or retried inside the same refresh. Later retries use the bounded policy below; Task3 fixes queue/capacity limits.
- Key failure state by source identity, content hash and semantic interpreter context. Allow at most3 input/output failures: after the first wait5minutes, after the second wait30minutes, after the third quarantine that unchanged input. A failed pair retries as individual items. Alternate eligible new and retry work, skipping waiting/quarantined items, so retries do not monopolise later articles. The next eligible invocation drives retries; no scheduler is introduced. New timestamps/HTTP304/restarts cannot reset budgets; changed content/context creates a new key with retained audit history.
- Provider authentication/quota/network/timeouts do not prove an article is bad. Record attempted dispatches and provider failure, retain pending input without incrementing its input-failure count, and back off model work for at least5minutes or a later observed retry-after. Valid irrelevant/rejected interpretations are completed outcomes, not retry failures. Quarantine does not delete accepted history, retire skills or affect the user's score; show a skipped-update notice and retain last-valid criteria.
- On failed/partial fetch or malformed model output, never publish an incomplete criterion or invent success. Retain last-valid data for affected providers, preserve their true check times and label coverage partial/unavailable. Other providers' success cannot advance the failed provider's success time.
- A previous score/profile version is never labelled current for a changed unreconciled role version. No 24-hour data deletion/reset.
- No CV/profile content is needed by the source interpreter or publishers. Production requires real configured Gemini; offline test doubles are labelled and never presented as live evidence.

Proposed engineering bounds: normal TLS; configured HTTPS hosts; bounded same-host redirects; 10-second source deadline; 2 MiB decoded source limit; six discovered items per AI feed per eligible refresh; 4,000 sanitised text characters per item; at most one30-second cancellable model request with at most two uncached items/four mappings and8192 output tokens;60-second total refresh deadline. Smaller batches reduce overflow risk but cannot guarantee a model's output fits: reject truncation and retain the last valid profile. These protect runtime/cost, not evidence usefulness. Reuse HTTP validators/cached interpretation on unchanged input. Exact resource/queue bounds, shared lease and tests are in the implementation plan.

## 7. Latest repository and integration sequence

Read-only head rechecked unchanged on24 October: `ed6801577bfeb054de279e69472bae6a7fe89653` (commit23 October,13:43:19 UTC), seven commits after the prior `5ba1fb3` review. The earlier GitHub comparison showed only README, new `frontend/**` and static-serving lines in `server.ts` changed; backend, schema, seed and dependencies were unchanged. A Published your App commit is not proof of a tested deployment.

Present: plain HTML/CSS/JS intake → confirmation → routes → roadmap, with source/date display. Missing: source producer, candidate promotion, criteria snapshots, new-skill reconciliation and durable last-valid-profile fallback. Seed resources/weights/SDG explanations remain marked placeholder in committed code; actual remote database content has not been inspected.

Implementation sequence:

1. **Reference and policy layer:** import only the two role references; configure task/skill boundaries, aliases and resource/SDG rules; replace placeholder baseline content before claiming readiness.
2. **Automatic source/candidate module:** `src/server/trends/`, real feed adapters, separate Gemini interpreter, gate evaluation and enrichment, no invented IDs/URLs/weights.
3. **Versioned criteria and profile integration:** Prisma/schema and database helpers, current role/evidence APIs, matching/pathway contracts, atomic snapshots and possession reconciliation. Reuse the mathematical engine; enforce the chosen policy at its inputs.
4. **Existing frontend integration:** `frontend/public/js/{api,app,profile,roadmap}.js` as needed. Refresh/invalidate session-long role/evidence caches; reconcile before match; pin pathway/evidence to the same version; reuse source display and add learning intent.
5. **Verification and deployed demonstration:** fixed-input edge cases, API/frontend checks, a real configured feed-to-advice flow and a separate dynamic-admission scenario. No forced score change when a genuine live item does not justify one.

**Release/recovery:** Jong prepares the complete release/config and database backup/migration runbook, using target access or a credentialed publishing operator only where needed. Apply additive migrations and validate/preserve the baseline; release compatible backend/frontend together with interpretation disabled; verify the complete journey and every serving instance before enabling Gemini. Keep traffic on the previous coherent release (or use coordinated maintenance) during incompatible rollout. On failure, disable publication, preserve snapshots and use only a compatible paired rollback or corrective release. Do not reset criteria/history or reverse database changes automatically. Task7 names the checks and order.

**Single integration owner: Jong (M3), across all seven phases.** He implements and tests Feature 2's source/rule/storage/API/frontend changes, content readiness, integration and delivery notes. M4 reviews product decisions; M2 provides access/git publishing support where required. Other teammates are not assigned separate Feature 2 coding phases. This later user-confirmed ownership supersedes the earlier split only for this integration; it does not transfer unrelated features/pitch duties. Name integration files in the plan. No assistant git add/commit/push; M2 publishes. Work one phase at a time.

## 8. Required verification

| Case | Expected result |
|---|---|
| D01 Same profile, criteria, source content and policy | Same result; timestamps alone do not change criteria. |
| D02 Useful older evidence | Retained with original dates; no publication-age cutoff. |
| D03 Tool/alias/version/alternative stack/covered subpractice | Reuse or optional alternative; no extra denominator unit. |
| D04 Irrelevant, unsupported or fabricated candidate | No scoring effect; rejection/uncertainty reason. |
| D05 Distinct role-relevant ready capability | All A gates pass; one canonical criterion published with source/resource/SDG data. |
| D06 Newly scored capability already known | Explicit confirmation earns numerator credit and recalculates; the optional question does not block other results. |
| D07 Newly scored capability not yet known | Updated denominator/coverage explained; friendly learning suggestion. |
| D08 Not sure/unanswered/omission | Return score/pathway with zero numerator credit for that criterion, preserved unconfirmed status and optional learning/possession guidance; no answer gate or invented absence claim. |
| D09 Add to learning plan/Not now | No possession credit, denominator change or extra penalty. |
| D10 Add confirmed relevant/unrelated skill under fixed criteria | Relevant cannot lower coverage; unrelated leaves it unchanged. |
| D11 Feed/model failure, including beyond 24 hours | Last-valid profile with warning/true dates; no outage-driven retirement/reset. Without valid prior data, report unavailable. |
| D12 Correction/retraction/conflict | Only affected supported criteria revised; no newest-wins or forced decline. |
| D13 Concurrent refresh and frontend cache/version changes | Atomic publication and coherent roles/match/pathway/evidence; no stale-cache bypass of questions. |
| D14 Missing resource, estimate, prerequisite or SDG support | Candidate remains staged; incomplete content is not fabricated. |
| D15 Initial placeholder data | Readiness flag remains until replaced; do not claim a completed pathway from example.com links. |
| D16 Source article changes but still maps to existing skill | Advice/explanation can update without forced score/criteria change. |
| D17 Real source-to-advice vs controlled admission fixture | Recorded separately; no fictional source presented as live evidence. |
| R1 Decision records | Required schema, valid role/skill/evidence references and admit/retire semantics; survive parse/storage and affect semantic hash. |
| R2 Optional-review and version-error transport | Normal200 results preserve optional questions; genuine409 context errors preserve the correct target context. Unanswered skills never cause409; ordinary errors are unchanged. |
| R3 Historical skill recognition | Versioned catalogue retains names/IDs after role retirement; frontend preserves possession without adding scoring credit. |
| R4 Refresh and output budgets | Independent instances share lease/cooldown; stale workers cannot publish; deferred coverage stays partial; oversized/truncated output gets no partial publication or automatic retry. |
| R5 Coordinated release/recovery | Database/baseline then compatible complete release then activation; recovery preserves the last valid head and uses compatible artifacts. |
| R6 Repeatedly failing articles | Per-key retry counters survive restart;5/30-minute waits, third-failure quarantine, individual retries, healthy-work progress and provider-outage distinction. |
| R7 Ownership | Jong is named as the single implementation/integration owner of every phase; outside support is limited to necessary access/publishing and product review. |
| R8 First-intake omission | With from=target after initial profile confirmation, omitted/Not sure skills stay unconfirmed but allow score/pathway output. Two-skill fixture gives50%, then100% after later possession confirmation; never fabricate Not yet. |

## 9. Provenance and next review

[Domain1 reading notes](../../handoff/official-reading-notes/domain1-notes.md) preserve competition-scope references; [current handoff](../../../HANDOFF.md) gives present team/code context. The original workspace also cited `../../DOMAIN-1-REFERENCE.md`, `../../member-3/CURRENT.md`, `../../team/2026-10-23-code-queens-team-handoff.md` and `../../member-3/handoff-2026-10-23/automated-feature-2-repository-review.md`. Those historical files are not bundled and must not be assumed accessible or substituted for current approved decisions.

Primary research: [O*NET software-skill columns](https://www.onetcenter.org/dictionary/31.0/mssql/software_skills.html), [role-report semantics](https://www.onetonline.org/help/online/details), [rating semantics](https://www.onetonline.org/help/online/scales), [Software Developers](https://www.onetonline.org/link/summary/15-1252.00), [QA Analysts and Testers](https://www.onetonline.org/link/summary/15-1253.00), [downloadable data attribution](https://www.onetcenter.org/license_db.html). Keep source/version, CC BY attribution and adaptation notices for downloaded role data; publisher article retention is limited to links, original short summaries and necessary validation excerpts.

Option 2, one-point coverage and the last-valid-profile fallback are approved. The gate/task-scope/engineering details above are proposals for the implementation-plan review, not organiser requirements or measured results. The plan must identify exact interfaces/tests and preserve all confirmed choices. No product code has been written under this design.
