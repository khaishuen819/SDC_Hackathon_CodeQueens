import * as z from "zod";
import { EvidenceItem } from "./evidence.ts";
import { LearningResource } from "./pathway.ts";
import { SdgResponse } from "./sdg.ts";
import { RoleId, SkillId, SourceId, EvidenceId, SdgId, PILOT_ROLE_IDS } from "./ids.ts";
import { Instant } from "./criteria.ts";
import type { ConfirmedProfile } from "./profile.ts";
import type { SnapshotId, SkillReview, ProviderState, TrendMeta } from "./criteria.ts";
export * from "./criteria.ts";

const Text = z.string().trim().min(1).max(500);
const ShortId = z.string().min(1).max(100);
const Quote = z.string().min(20).max(300);
export const TaskId = z.enum(["B1", "B2", "B3", "B4", "Q1", "Q2", "Q3", "Q4"]);
export type TaskId = z.infer<typeof TaskId>;
export const HttpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password;
}, "Use an HTTPS URL without credentials.");
const Reviewed = z.boolean().refine((value) => !value, "Placeholder content is not ready.");

export const Capability = z.strictObject({
  skillId: SkillId, name: Text, definition: Text, aliases: z.array(Text), observableOutcome: Text,
  taskIds: z.array(TaskId).min(1), prerequisiteSkillIds: z.array(SkillId), evidenceIds: z.array(EvidenceId).min(1),
});
export type Capability = z.infer<typeof Capability>;
export const CriteriaDecision = z.strictObject({
  roleId: RoleId, skillId: SkillId, action: z.enum(["admit", "retire"]), reason: Text, evidenceIds: z.array(EvidenceId).min(1),
});
export type CriteriaDecision = z.infer<typeof CriteriaDecision>;
export const BundleResource = LearningResource.extend({
  skillId: SkillId, url: HttpsUrl, isPlaceholder: Reviewed, estimatedHours: z.number().positive(),
  estimateBasis: z.enum(["provider", "app"]), estimateNote: Text, checkedAt: Instant,
}).strict();
export type BundleResource = z.infer<typeof BundleResource>;
// The old evidence response retains its day-only fields. A versioned bundle
// also supports honest month/year/unknown precision without inventing a day.
export const BundleEvidence = EvidenceItem.omit({ publishedDate: true }).extend({
  url: HttpsUrl, publishedDate: z.iso.date().nullable(), publishedAt: Instant.nullable(),
  originalDate: z.string().nullable(), datePrecision: z.enum(["day", "month", "year", "unknown"]),
  dateBasis: z.enum(["published", "updated"]), checkedAt: Instant,
}).strict();
export type BundleEvidence = z.infer<typeof BundleEvidence>;
const BundleRole = z.strictObject({
  roleId: RoleId, name: Text, description: Text, isPlaceholder: Reviewed,
  skills: z.array(z.strictObject({ skillId: SkillId, name: Text, weight: z.literal(1), isRequired: z.boolean() })).min(1),
});

export const CriteriaBundle = z.strictObject({
  schemaVersion: z.literal(1), policyVersion: z.literal("count-coverage-v1"),
  roles: z.array(BundleRole).length(2), capabilities: z.array(Capability).min(1),
  resources: z.array(BundleResource), evidence: z.array(BundleEvidence).min(1), sdg: SdgResponse,
  prerequisiteEdges: z.array(z.strictObject({ skillId: SkillId, prerequisiteSkillId: SkillId })),
  criteriaDecisions: z.array(CriteriaDecision).min(1),
  sourceContentKeys: z.array(z.string().min(1)).min(1), interpreterVersion: Text,
}).superRefine((b, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  const unique = (values: string[], path: string) => {
    if (new Set(values).size !== values.length) issue(path, "Duplicate canonical key.");
  };
  unique(b.roles.map((x) => x.roleId), "roles");
  if (!PILOT_ROLE_IDS.every((id) => b.roles.some((r) => r.roleId === id))) issue("roles", "Both pilot roles are required.");
  unique(b.capabilities.map((x) => x.skillId), "capabilities");
  unique(b.resources.map((x) => x.resourceId), "resources");
  unique(b.evidence.map((x) => x.id), "evidence");
  unique(b.sdg.goals.map((x) => x.sdgId), "sdg");
  unique(b.sdg.roleTags.map((x) => `${x.roleId}:${x.sdgId}`), "sdg");
  unique(b.sdg.skillTags.map((x) => `${x.skillId}:${x.sdgId}`), "sdg");
  unique(b.sourceContentKeys, "sourceContentKeys");
  const caps = new Map(b.capabilities.map((c) => [c.skillId, c]));
  const evidence = new Map(b.evidence.map((e) => [e.id, e]));
  const roleIds = new Set(b.roles.map((r) => r.roleId));
  const goals = new Set(b.sdg.goals.map((g) => g.sdgId));
  const associations = new Set(b.roles.flatMap((r) => r.skills.map((s) => `${r.roleId}:${s.skillId}`)));
  const decisions = new Map(b.criteriaDecisions.map((d) => [`${d.roleId}:${d.skillId}`, d]));
  unique(b.criteriaDecisions.map((d) => `${d.roleId}:${d.skillId}`), "criteriaDecisions");
  const knownEvidence = (ids: string[]) => ids.every((id) => evidence.has(id));
  const names = new Map<string, string>();
  for (const c of b.capabilities) {
    for (const name of [c.name, ...c.aliases]) {
      const key = name.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
      if (names.has(key) && names.get(key) !== c.skillId) issue("capabilities", "Ambiguous canonical name/alias.");
      names.set(key, c.skillId);
    }
    if (!knownEvidence(c.evidenceIds) || c.evidenceIds.some((id) => !evidence.get(id)?.linkedSkillIds.includes(c.skillId))) issue("capabilities", "Unknown or unrelated supporting evidence.");
    unique(c.prerequisiteSkillIds, "capabilities");
    if (c.prerequisiteSkillIds.some((id) => !caps.has(id) || id === c.skillId)) issue("capabilities", "Unknown/self prerequisite.");
  }
  for (const e of b.evidence) {
    if (e.linkedSkillIds.some((id) => !caps.has(id))) issue("evidence", "Unknown linked skill.");
    if (e.datePrecision !== "unknown" && !e.originalDate?.trim()) issue("evidence", "Known date precision requires the original value.");
    if (e.datePrecision !== "day" && (e.publishedAt !== null || e.publishedDate !== null)) issue("evidence", "Do not invent a publication day.");
    if (e.datePrecision === "day" && (!e.publishedDate || !e.originalDate || (e.publishedAt && e.publishedAt.slice(0, 10) !== e.publishedDate))) issue("evidence", "Publication day/precision disagree.");
  }
  for (const r of b.resources) if (!caps.has(r.skillId) || new URL(r.url).hostname === "example.com") issue("resources", "Unknown skill or placeholder resource.");
  for (const tag of b.sdg.roleTags) if (!roleIds.has(tag.roleId) || !goals.has(tag.sdgId) || tag.isPlaceholder) issue("sdg", "Invalid/unready role SDG mapping.");
  for (const tag of b.sdg.skillTags) if (!caps.has(tag.skillId) || !goals.has(tag.sdgId) || tag.isPlaceholder) issue("sdg", "Invalid/unready skill SDG mapping.");
  for (const role of b.roles) {
    unique(role.skills.map((s) => s.skillId), "roles");
    const definitions = new Set<string>(), outcomes = new Set<string>();
    if (!b.sdg.roleTags.some((t) => t.roleId === role.roleId)) issue("sdg", "Role SDG rationale is required.");
    for (const skill of role.skills) {
      if (!caps.has(skill.skillId)) issue("roles", "Unknown current capability.");
      const capability = caps.get(skill.skillId);
      if (capability) {
        const normal = (s: string) => s.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
        const definition = normal(capability.definition), outcome = normal(capability.observableOutcome);
        if (definitions.has(definition) || outcomes.has(outcome)) issue("roles", "Overlapping capabilities cannot count twice for a role.");
        definitions.add(definition); outcomes.add(outcome);
      }
      if (!b.resources.some((r) => r.skillId === skill.skillId && r.cost === "free")) issue("resources", "Current capability needs a ready free resource.");
      if (!b.sdg.skillTags.some((t) => t.skillId === skill.skillId)) issue("sdg", "Current capability needs an SDG rationale.");
      if (decisions.get(`${role.roleId}:${skill.skillId}`)?.action !== "admit") issue("criteriaDecisions", "Current association needs an admission decision.");
    }
  }
  for (const d of b.criteriaDecisions) {
    if (!roleIds.has(d.roleId) || !caps.has(d.skillId) || !knownEvidence(d.evidenceIds) ||
        d.evidenceIds.some((id) => !evidence.get(id)?.linkedSkillIds.includes(d.skillId))) issue("criteriaDecisions", "Unknown or unrelated decision reference.");
    if ((d.action === "admit") !== associations.has(`${d.roleId}:${d.skillId}`)) issue("criteriaDecisions", "Decision disagrees with current association.");
  }
  const declared = b.capabilities.flatMap((c) => c.prerequisiteSkillIds.map((p) => `${c.skillId}:${p}`)).sort();
  const edges = b.prerequisiteEdges.map((e) => `${e.skillId}:${e.prerequisiteSkillId}`).sort();
  unique(edges, "prerequisiteEdges");
  if (JSON.stringify(declared) !== JSON.stringify(edges)) issue("prerequisiteEdges", "Edges must agree with capability prerequisites.");
  const visiting = new Set<string>(), done = new Set<string>();
  const walk = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (done.has(id)) return true;
    visiting.add(id);
    for (const p of caps.get(id)?.prerequisiteSkillIds ?? []) if (!walk(p)) return false;
    visiting.delete(id); done.add(id); return true;
  };
  if (b.capabilities.some((c) => !walk(c.skillId))) issue("prerequisiteEdges", "Prerequisite cycle.");
});
export type CriteriaBundle = z.infer<typeof CriteriaBundle>;

export const SourceItem = z.strictObject({
  sourceId: SourceId, providerId: SourceId, canonicalUrl: HttpsUrl, title: Text,
  publishedAt: Instant.nullable(), dateBasis: z.enum(["published", "updated"]), text: z.string().min(1).max(4000),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  extractedLinks: z.array(z.strictObject({ linkId: ShortId, url: HttpsUrl, title: Text })),
});
export type SourceItem = z.infer<typeof SourceItem>;
export const ResourceCandidate = z.strictObject({
  linkId: ShortId, url: HttpsUrl, title: Text, text: z.string().min(1).max(4000), contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  access: z.enum(["free", "paid", "unknown"]), checkedAt: Instant,
});
export type ResourceCandidate = z.infer<typeof ResourceCandidate>;
export const CandidateInterpretation = z.strictObject({
  sourceId: SourceId, roleId: RoleId, taskId: TaskId, referenceTaskId: ShortId,
  sourceExcerpt: Quote, referenceExcerpt: Quote, bridgeExplanation: Text,
  relation: z.enum(["distinct", "same", "alias", "tool-for", "version-of", "example-of", "covered-subpractice", "alternative-stack", "uncertain"]),
  existingSkillId: SkillId.optional(), fit: z.enum(["pilot", "specialist", "uncertain", "unrelated"]),
  conflict: z.boolean(), uncertainties: z.array(Text).max(4),
  capability: z.strictObject({ name: Text, definition: Text, aliases: z.array(Text).max(4), observableOutcome: Text, example: Text, prerequisiteSkillIds: z.array(SkillId).max(4) }),
  learning: z.strictObject({
    resourceLinkIds: z.array(ShortId).max(4), resourceExcerpts: z.array(z.strictObject({ linkId: ShortId, excerpt: Quote })).max(4),
    estimatedHours: z.number().positive(), estimateBasis: z.enum(["provider", "app"]), estimateNote: Text, estimateExcerpt: Quote.optional(),
  }).nullable(),
  sdgTemplateIds: z.array(ShortId).max(4),
});
export type CandidateInterpretation = z.infer<typeof CandidateInterpretation>;

export type RoleReference = {
  version: string; urls: string[]; attribution: string;
  tasks: Array<{ occupationId: string; taskId: string; text: string; taskType: string; originalDate: string | null; datePrecision: "day" | "month" | "year" | "unknown" }>;
  software: Array<{ occupationId: string; name: string; hotTechnology: boolean; inDemand: boolean }>;
};
export type PilotConfig = {
  roleIds: string[]; sourceHosts: string[]; resourceHosts: string[]; foundationalSkillIds: string[];
  taskAnchors: Array<{ taskId: TaskId; roleId: string; referenceTaskIds: string[] }>;
  sdgTemplates: Array<{ templateId: string; taskId: TaskId; sdgId: string; rationale: string }>;
};
export type AdmissionContext = { base: CriteriaBundle; reference: RoleReference; config: PilotConfig; sources: SourceItem[]; resources: ResourceCandidate[]; now: string };
export type AdmissionReason = { gate: "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7" | "A8"; code: string };
export type AdmissionResult = { status: "reuse"; existingSkillId: string } | { status: "promote"; candidate: CandidateInterpretation } | { status: "stage" | "reject"; reasons: AdmissionReason[] };
export type ReconcileResult = { status: "ready"; profile: ConfirmedProfile; snapshotId: SnapshotId; review: SkillReview };
export type VerifiedContent = Pick<CriteriaBundle, "roles" | "capabilities" | "resources" | "evidence" | "sdg" | "prerequisiteEdges" | "criteriaDecisions">;
export type HttpFetcher = typeof globalThis.fetch;
export type SourceBatch = { items: SourceItem[]; providers: ProviderState[]; resources: ResourceCandidate[] };
export type InterpretationInput = { batch: SourceBatch; reference: RoleReference; config: PilotConfig; base: CriteriaBundle; promptVersion: string };
export type InterpretationBatch = { items: Array<{ sourceId: string; mappings: CandidateInterpretation[] }> };
export type CriteriaDraftResult = { bundle: CriteriaBundle; admittedSkillIds: string[]; retiredSkillIds: string[]; staged: AdmissionResult[]; rejected: AdmissionResult[]; providers: ProviderState[] };
export type CriteriaSnapshot = { id: SnapshotId; createdAt: string; bundle: CriteriaBundle };
export type CriteriaContext = { snapshot: CriteriaSnapshot; meta: TrendMeta };
export type RefreshReservation = { status: "acquired"; generation: bigint; baseSnapshotId: SnapshotId | null; leaseExpiresAt: string } | { status: "busy" | "cooldown"; retryAt: string };
export type PublishResult = { status: "published" | "unchanged" | "conflict"; snapshot: CriteriaSnapshot | null };
export type QueueItem = { key: string; sourceId: string; contentHash: string; interpreterFingerprint: string; state: "pending" | "retry-wait" | "quarantined" | "processed"; firstQueuedAt: string; lastAttemptAt: string | null; attemptCount: number; inputFailureCount: number; nextAttemptAt: string | null; lastErrorCode: string | null };
export type QueueState = { items: QueueItem[]; nextWorkClass: "new" | "retry"; nextProviderId: string; modelRetryAfterAt: string | null };
export type WorkSelection = { kind: "new" | "retry" | "none"; keys: string[] };
export type InterpretationOutcome = { status: "success"; interpretation: InterpretationBatch } | { status: "input-failure"; errorCode: string } | { status: "provider-failure"; errorCode: string; retryAfterAt?: string };
export type RefreshState = { snapshotId: SnapshotId | null; nextGeneration: bigint; publishedGeneration: bigint; providers: ProviderState[]; sourceCache: SourceBatch; interpretationCache: Record<string, InterpretationBatch>; queue: QueueState; stagedCandidates: CandidateInterpretation[]; leaseGeneration: bigint | null; leaseExpiresAt: string | null; nextAllowedAt: string | null };
