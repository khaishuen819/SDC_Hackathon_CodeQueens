import { createHash } from "node:crypto";
import { CriteriaBundle } from "../contracts/trends.ts";
import type { AdmissionResult, CandidateInterpretation, CriteriaDraftResult, HttpFetcher, InterpretationBatch, InterpretationOutcome, PilotConfig,
  ProviderState, QueueState, RoleReference, SourceBatch, SourceItem, WorkSelection } from "../contracts/trends.ts";
import { evaluateCandidate, validateCriteriaBundle } from "./policy.ts";
import { fetchResourceCandidates, fetchSourceItems } from "./sources.ts";
import { enqueueSourceItems, recordDispatch, recordInterpretationOutcome, selectInterpretationWork } from "./queue.ts";
import { interpreterFingerprint, interpretToOutcome, TREND_PROMPT_VERSION } from "./interpreter.ts";
import type { TrendInterpreter } from "./interpreter.ts";

export type DraftContext = { reference: RoleReference; config: PilotConfig; now: string; interpreterVersion: string };
const PUBLISHERS: Record<string, string> = { "github-changelog": "GitHub Changelog", "jetbrains-ai": "JetBrains AI Blog" };
const LIMITATION = "Automated interpretation of a publisher update. It describes a capability, not hiring demand, occupational necessity or a measured skill level.";
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const normal = (text: string) => text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const day = (instant: string) => new Date(Date.parse(instant)).toISOString().slice(0, 10);

// Links one source item to a capability as dated, cited evidence.
function attachEvidence(bundle: CriteriaBundle, source: SourceItem, mapping: CandidateInterpretation, skillId: string, ctx: DraftContext): string {
  const id = `evidence-${sha(`${source.sourceId}:${source.contentHash}`).slice(0, 16)}`;
  const existing = bundle.evidence.find((e) => e.id === id);
  if (existing) { if (!existing.linkedSkillIds.includes(skillId)) existing.linkedSkillIds.push(skillId); }
  else bundle.evidence.push({ id, title: source.title, publisher: PUBLISHERS[source.providerId] ?? source.providerId, url: source.canonicalUrl,
    publishedDate: day(source.publishedAt!), publishedAt: source.publishedAt, originalDate: day(source.publishedAt!), datePrecision: "day",
    dateBasis: source.dateBasis, retrievedAt: day(ctx.now), checkedAt: ctx.now, supportedClaim: mapping.bridgeExplanation, limitation: LIMITATION, linkedSkillIds: [skillId] });
  const capability = bundle.capabilities.find((c) => c.skillId === skillId)!;
  if (!capability.evidenceIds.includes(id)) capability.evidenceIds.push(id);
  const key = `${source.sourceId}:${source.contentHash}`;
  if (!bundle.sourceContentKeys.includes(key)) bundle.sourceContentKeys.push(key);
  return id;
}

// A distinct capability is published with its role association (weight 1),
// decision, evidence, resources, prerequisites and SDG tags together.
function promote(bundle: CriteriaBundle, c: CandidateInterpretation, source: SourceItem, batch: SourceBatch, ctx: DraftContext): { next: CriteriaBundle; skillId: string } | AdmissionResult {
  // App-assigned ID from the canonical task/outcome key; semantic duplicates were resolved by A4 first.
  const skillId = `cap-${sha(JSON.stringify([c.taskId, normal(c.capability.observableOutcome)])).slice(0, 16)}`;
  if (bundle.capabilities.some((x) => x.skillId === skillId)) return { status: "stage", reasons: [{ gate: "A4", code: "capability-id-collision" }] };
  const next = structuredClone(bundle);
  const { name, definition, aliases, observableOutcome, prerequisiteSkillIds } = c.capability;
  next.capabilities.push({ skillId, name, definition, aliases, observableOutcome, taskIds: [c.taskId], prerequisiteSkillIds, evidenceIds: [] });
  const evidenceId = attachEvidence(next, source, c, skillId, ctx);
  next.roles.find((r) => r.roleId === c.roleId)!.skills.push({ skillId, name, weight: 1, isRequired: false });
  next.criteriaDecisions.push({ roleId: c.roleId, skillId, action: "admit", reason: c.bridgeExplanation, evidenceIds: [evidenceId] });
  for (const prerequisiteSkillId of prerequisiteSkillIds) next.prerequisiteEdges.push({ skillId, prerequisiteSkillId });
  for (const linkId of c.learning!.resourceLinkIds) {
    const r = batch.resources.find((x) => x.linkId === linkId)!;
    next.resources.push({ resourceId: `res-${sha(`${skillId}|${r.url}`).slice(0, 16)}`, skillId, title: r.title, url: r.url, provider: new URL(r.url).hostname,
      cost: "free", sourceNote: `Linked from "${source.title}" on a configured free documentation host; checked automatically, not a completed course.`,
      isPlaceholder: false, estimatedHours: c.learning!.estimatedHours, estimateBasis: c.learning!.estimateBasis, estimateNote: c.learning!.estimateNote, checkedAt: r.checkedAt });
  }
  for (const templateId of c.sdgTemplateIds) {
    const t = ctx.config.sdgTemplates.find((x) => x.templateId === templateId)!;
    if (!next.sdg.skillTags.some((x) => x.skillId === skillId && x.sdgId === t.sdgId)) next.sdg.skillTags.push({ skillId, sdgId: t.sdgId, rationale: t.rationale, isPlaceholder: false });
  }
  return { next, skillId };
}

// Applies A1–A8 to each mapping in order against the evolving draft, so a
// repeated update reuses the capability admitted moments earlier.
export function buildCriteriaDraft(base: CriteriaBundle, batch: SourceBatch, interpretation: InterpretationBatch, ctx: DraftContext): CriteriaDraftResult {
  let bundle = validateCriteriaBundle(base), changed = false;
  const admittedSkillIds: string[] = [], staged: AdmissionResult[] = [], rejected: AdmissionResult[] = [];
  for (const item of interpretation.items) for (const mapping of item.mappings) {
    if (mapping.sourceId !== item.sourceId) { rejected.push({ status: "reject", reasons: [{ gate: "A1", code: "mismatched-source" }] }); continue; }
    const result = evaluateCandidate(mapping, { base: bundle, reference: ctx.reference, config: ctx.config, sources: batch.items, resources: batch.resources, now: ctx.now });
    const source = batch.items.find((s) => s.sourceId === mapping.sourceId)!;
    if (result.status === "stage") { staged.push(result); continue; }
    if (result.status === "reject") { rejected.push(result); continue; }
    let next: CriteriaBundle, skillId: string | null = null;
    if (result.status === "reuse") {
      next = structuredClone(bundle);
      attachEvidence(next, source, mapping, result.existingSkillId, ctx);
    } else {
      const promoted = promote(bundle, mapping, source, batch, ctx);
      if ("status" in promoted) { staged.push(promoted); continue; }
      ({ next, skillId } = promoted);
    }
    const checked = CriteriaBundle.safeParse(next);
    if (!checked.success) {
      const area = String(checked.error.issues[0]?.path[0] ?? "");
      staged.push({ status: "stage", reasons: [{ gate: area === "resources" ? "A7" : area === "sdg" ? "A8" : "A4", code: "bundle-readiness-failed" }] });
      continue;
    }
    bundle = checked.data; changed = true;
    if (skillId) admittedSkillIds.push(skillId);
  }
  if (changed) bundle = { ...bundle, interpreterVersion: ctx.interpreterVersion };
  // Retirement needs a verified correction/retraction workflow; none is implemented in Phase 3.
  return { bundle, admittedSkillIds, retiredSkillIds: [], staged, rejected, providers: batch.providers };
}

export type RefreshDeps = {
  base: CriteriaBundle; reference: RoleReference; config: PilotConfig; providers: ProviderState[]; queue: QueueState; sources: SourceItem[];
  fetcher: HttpFetcher; interpreter: TrendInterpreter | null; now: () => string; signal?: AbortSignal; deadlineMs?: number;
};
export type RefreshRun = {
  interpretation: "disabled" | "idle" | "attempted"; providers: ProviderState[]; queue: QueueState; sources: SourceItem[]; skipped: number;
  work: WorkSelection; outcome: InterpretationOutcome | null; draft: CriteriaDraftResult | null;
};

// In-memory composition of one refresh: feeds -> queue -> at most one model
// request -> validated draft. It saves and publishes nothing; Phase 4's
// refresh service supplies persistence, the shared lease and publication.
export async function draftRefresh(deps: RefreshDeps): Promise<RefreshRun> {
  const none: WorkSelection = { kind: "none", keys: [] };
  if (!deps.interpreter) return { interpretation: "disabled", providers: deps.providers, queue: deps.queue, sources: deps.sources, skipped: 0, work: none, outcome: null, draft: null };
  const interpreter = deps.interpreter;
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new Error("Refresh deadline exceeded.")), deps.deadlineMs ?? 60_000);
  const signal = deps.signal ? AbortSignal.any([deps.signal, deadline.signal]) : deadline.signal;
  try {
    const options = { now: deps.now, resourceHosts: deps.config.resourceHosts };
    const fetched = await fetchSourceItems(deps.providers, deps.fetcher, signal, options);
    const sources = new Map(deps.sources.map((s) => [s.sourceId, s]));
    for (const s of fetched.items) sources.set(s.sourceId, s);
    const context = { batch: { items: [], providers: [], resources: [] }, reference: deps.reference, config: deps.config, base: deps.base, promptVersion: TREND_PROMPT_VERSION };
    const fingerprint = interpreterFingerprint(context, interpreter.model);
    const enqueued = enqueueSourceItems(deps.queue, [...sources.values()], fingerprint, deps.now());
    let queue = enqueued.state;
    const waiting = () => [...sources.values()].filter((s) => queue.items.some((i) => i.sourceId === s.sourceId && (i.state === "pending" || i.state === "retry-wait")));
    const work = selectInterpretationWork(queue, deps.now());
    const selected = work.keys.map((k) => sources.get(queue.items.find((i) => i.key === k)!.sourceId)).filter((s): s is SourceItem => !!s);
    if (work.kind === "none" || selected.length !== work.keys.length)
      return { interpretation: "idle", providers: fetched.providers, queue, sources: waiting(), skipped: enqueued.skipped, work: none, outcome: null, draft: null };
    const resources = await fetchResourceCandidates(selected, deps.fetcher, signal, options);
    const batch: SourceBatch = { items: selected, providers: fetched.providers, resources };
    queue = recordDispatch(queue, work, deps.now());
    const outcome = await interpretToOutcome(interpreter, { ...context, batch }, signal);
    queue = recordInterpretationOutcome(queue, work, outcome, deps.now());
    const draft = outcome.status === "success" ? buildCriteriaDraft(deps.base, batch, outcome.interpretation,
      { reference: deps.reference, config: deps.config, now: deps.now(), interpreterVersion: `${interpreter.model}:${TREND_PROMPT_VERSION}` }) : null;
    return { interpretation: "attempted", providers: fetched.providers, queue, sources: waiting(), skipped: enqueued.skipped, work, outcome, draft };
  } catch (error) {
    if (deadline.signal.aborted) throw new Error("Refresh deadline exceeded.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
