import { createHash } from "node:crypto";
import { CandidateInterpretation, CriteriaBundle, Instant, ResourceCandidate, SourceItem } from "../contracts/trends.ts";
import { SdgId } from "../contracts/ids.ts";
import type { AdmissionContext, AdmissionReason, AdmissionResult } from "../contracts/trends.ts";

export function validateCriteriaBundle(input: unknown): CriteriaBundle {
  return CriteriaBundle.parse(input);
}

const normal = (text: string) => text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const fail = (status: "stage" | "reject", gate: AdmissionReason["gate"], code: string): AdmissionResult => ({ status, reasons: [{ gate, code }] });
const allowed = (url: string, hosts: string[]) => {
  const value = new URL(url);
  return value.protocol === "https:" && !value.username && !value.password && (!value.port || value.port === "443") && hosts.includes(value.hostname);
};

// Checks source/registry/readiness facts. Semantic relevance remains an AI
// interpretation of the supplied text, not proof of occupational necessity.
export function evaluateCandidate(input: CandidateInterpretation, context: AdmissionContext): AdmissionResult {
  const parsed = CandidateInterpretation.safeParse(input);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path.map(String).join(".") ?? "";
    const gate = path.startsWith("learning") ? "A7" : path.startsWith("sdg") ? "A8" : path.startsWith("capability.prerequisite") ? "A5" :
      path.startsWith("capability") ? "A3" : /^(roleId|taskId|reference|bridge)/.test(path) ? "A2" : /^(relation|existing)/.test(path) ? "A4" :
      /^(fit|conflict|uncertainties)/.test(path) ? "A6" : "A1";
    return fail("reject", gate, "invalid-interpretation");
  }
  const c = parsed.data, b = validateCriteriaBundle(context.base);
  const now = Date.parse(Instant.parse(context.now));
  const matches = context.sources.filter((s) => s.sourceId === c.sourceId);
  if (matches.length !== 1) return fail("reject", "A1", "source-not-retrieved");
  const sourceResult = SourceItem.safeParse(matches[0]);
  if (!sourceResult.success) return fail("reject", "A1", "invalid-source-record");
  const source = sourceResult.data;
  if (!allowed(source.canonicalUrl, context.config.sourceHosts) || !source.publishedAt || Date.parse(source.publishedAt) > now + 300_000 ||
      source.contentHash !== hash(source.text) || !source.text.includes(c.sourceExcerpt)) return fail("reject", "A1", "unsupported-source");

  const anchor = context.config.taskAnchors.find((a) => a.taskId === c.taskId && a.roleId === c.roleId);
  const reference = context.reference.tasks.find((t) => t.taskId === c.referenceTaskId);
  const occupation = c.roleId === "backend-development" ? "15-1252.00" : c.roleId === "qa-automation" ? "15-1253.00" : null;
  if (!occupation || !context.config.roleIds.includes(c.roleId) || !b.roles.some((r) => r.roleId === c.roleId) || !anchor || !reference ||
      !anchor.referenceTaskIds.includes(reference.taskId) || reference.occupationId !== occupation || !reference.text.includes(c.referenceExcerpt) || c.fit === "unrelated")
    return fail("reject", "A2", "unsupported-role-task-bridge");

  // A3's outcome/example/definition must be present in the validated shape.
  const names = new Set([c.capability.name, ...c.capability.aliases].map(normal));
  const canonical = b.capabilities.filter((known) => [known.name, ...known.aliases].some((n) => names.has(normal(n))) ||
    normal(known.observableOutcome) === normal(c.capability.observableOutcome) || normal(known.definition) === normal(c.capability.definition));
  const declared = c.existingSkillId ? b.capabilities.find((s) => s.skillId === c.existingSkillId) : undefined;
  if (c.existingSkillId && !declared) return fail("reject", "A4", "invented-canonical-id");
  if (canonical.length > 1 || (declared && canonical.some((s) => s.skillId !== declared.skillId))) return fail("stage", "A4", "ambiguous-canonical-mapping");
  if (c.relation === "uncertain") return fail("stage", "A4", "uncertain-distinction");
  if (c.fit !== "pilot" || c.relation === "alternative-stack") return fail("stage", "A5", "optional-or-uncertain-route-fit");
  if (c.capability.prerequisiteSkillIds.some((id) => !b.capabilities.some((s) => s.skillId === id))) return fail("stage", "A5", "prerequisite-not-recognised");
  if (c.conflict || c.uncertainties.length) return fail("stage", "A6", "unresolved-support");
  const existing = canonical[0] ?? declared;
  if (existing) {
    if (c.relation === "distinct" && declared && !canonical.length) return fail("stage", "A4", "conflicting-relation");
    return { status: "reuse", existingSkillId: existing.skillId };
  }
  if (c.relation !== "distinct") return fail("stage", "A4", "missing-canonical-target");

  const learning = c.learning;
  if (!learning?.resourceLinkIds.length || new Set(learning.resourceLinkIds).size !== learning.resourceLinkIds.length) return fail("stage", "A7", "resource-not-ready");
  const resources = learning.resourceLinkIds.map((id) => context.resources.find((r) => r.linkId === id));
  for (let i = 0; i < resources.length; i++) {
    const result = ResourceCandidate.safeParse(resources[i]);
    if (!result.success) return fail("stage", "A7", "resource-not-retrieved");
    const resource = result.data;
    const linked = source.extractedLinks.some((l) => l.linkId === resource.linkId && l.url === resource.url) ||
      b.resources.some((r) => r.resourceId === resource.linkId && r.url === resource.url);
    const quote = learning.resourceExcerpts.find((q) => q.linkId === resource.linkId)?.excerpt;
    if (!linked || !allowed(resource.url, context.config.resourceHosts) || resource.access !== "free" ||
        resource.contentHash !== hash(resource.text) || Date.parse(resource.checkedAt) > now + 300_000 || !quote || !resource.text.includes(quote))
      return fail("stage", "A7", "unsupported-learning-resource");
  }
  if (learning.estimateBasis === "provider") {
    const excerpt = learning.estimateExcerpt;
    const duration = excerpt?.match(/\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?)\b/i);
    const hours = duration ? Number(duration[1]) / (/^m/i.test(duration[2]) ? 60 : 1) : null;
    if (!excerpt || hours !== learning.estimatedHours || !resources.some((r) => r?.text.includes(excerpt))) return fail("stage", "A7", "unverified-provider-duration");
  }
  if (!c.sdgTemplateIds.length || c.sdgTemplateIds.some((id) => !context.config.sdgTemplates.some((t) =>
    t.templateId === id && t.taskId === c.taskId && SdgId.safeParse(t.sdgId).success && t.rationale.trim()))) return fail("stage", "A8", "sdg-template-not-ready");
  return { status: "promote", candidate: c };
}
