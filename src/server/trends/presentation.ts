import { COUNT_SCORE_MEANING, VersionedMatchResponse } from "../contracts/match.ts";
import { VersionedPathwayResponse } from "../contracts/pathway.ts";
import type { ConfirmedProfile } from "../contracts/profile.ts";
import type { SkillAnswer, SkillReview } from "../contracts/criteria.ts";
import { CriteriaBundle } from "../contracts/trends.ts";
import type { CriteriaContext, CriteriaSnapshot } from "../contracts/trends.ts";
import { matchRoles } from "../matching/matchEngine.ts";
import { buildPathway } from "../pathway/pathwayEngine.ts";
import { toCountRoleInputs, toCitationOnlyEvidence } from "./adapters.ts";
import { ApiFailure } from "../routes/errors.ts";

const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function presentMatch(profile: ConfirmedProfile, context: CriteriaContext, review: SkillReview, previous?: CriteriaSnapshot | null): VersionedMatchResponse {
  const bundle = CriteriaBundle.parse(context.snapshot.bundle);
  const matched = matchRoles(profile, toCountRoleInputs(bundle), []);
  const roles = matched.roles.map((role) => {
    const listed = bundle.roles.find((r) => r.roleId === role.roleId)!;
    const evidenceIds = [...new Set(bundle.criteriaDecisions.filter((d) => d.roleId === role.roleId && d.action === "admit").flatMap((d) => d.evidenceIds))].sort(order);
    const sentences = [`You have confirmed ${role.strengths.length} of ${listed.skills.length} listed skills: ${role.score}% coverage. Each skill counts once.`,
      "Unconfirmed skills are not counted yet and can be added later. Extra skills do not reduce your score."];
    const before = previous?.bundle.roles.find((r) => r.roleId === role.roleId);
    if (before && JSON.stringify(before.skills.map((s) => s.skillId).sort(order)) !== JSON.stringify(listed.skills.map((s) => s.skillId).sort(order))) {
      sentences.push(`This role's comparison list changed from ${before.skills.length} to ${listed.skills.length} skills. A lower percentage does not mean you lost a skill. Sources: ${evidenceIds.join(", ")}.`);
    }
    if (role.preferredRouteKept) sentences.push("This remains your chosen route, even if another route ranks higher.");
    return { ...role, scoreExplanation: sentences.join(" "), evidence: evidenceIds.map((evidenceId) => ({ evidenceId })) };
  });
  return VersionedMatchResponse.parse({ ...matched, roles, scoreMeaning: COUNT_SCORE_MEANING, criteria: context.meta, review });
}

export function presentPathway(profile: ConfirmedProfile, roleId: string, context: CriteriaContext, review: SkillReview, answers: SkillAnswer[] = []): VersionedPathwayResponse {
  const bundle = CriteriaBundle.parse(context.snapshot.bundle);
  const role = toCountRoleInputs(bundle).find((r) => r.roleId === roleId);
  if (!role) throw new ApiFailure("NOT_FOUND", `There is no role "${roleId}".`);
  const confirmed = new Set(profile.confirmedSkills.map((s) => s.skillId));
  const caps = new Map(bundle.capabilities.map((c) => [c.skillId, c]));
  const included = new Set(role.skills.filter((s) => !confirmed.has(s.skillId)).map((s) => s.skillId));
  const prerequisites = new Set<string>();
  const expand = (id: string) => {
    for (const prerequisite of caps.get(id)!.prerequisiteSkillIds) {
      if (confirmed.has(prerequisite)) continue;
      prerequisites.add(prerequisite);
      if (!included.has(prerequisite)) { included.add(prerequisite); expand(prerequisite); }
    }
  };
  for (const id of [...included]) expand(id);
  const expanded = { ...role, skills: [...role.skills] };
  for (const id of included) if (!expanded.skills.some((s) => s.skillId === id)) {
    expanded.skills.push({ skillId: id, name: caps.get(id)!.name, weight: 1, isRequired: true, isPlaceholder: false });
  }
  const path = buildPathway(profile, expanded, bundle.resources, toCitationOnlyEvidence(bundle));
  const required = new Set(role.skills.filter((s) => s.isRequired).map((s) => s.skillId));
  const remaining = new Map(path.steps.map((s) => [s.skillId, s]));
  const steps: typeof path.steps = [];
  while (remaining.size) {
    const eligible = [...remaining.keys()].filter((id) => caps.get(id)!.prerequisiteSkillIds.every((p) => !remaining.has(p)));
    eligible.sort((a, b) => Number(prerequisites.has(b)) - Number(prerequisites.has(a)) || Number(required.has(b)) - Number(required.has(a)) ||
      caps.get(b)!.evidenceIds.length - caps.get(a)!.evidenceIds.length || order(a, b));
    if (!eligible.length) throw new Error("Criteria contain a prerequisite cycle.");
    const id = eligible[0], step = remaining.get(id)!;
    remaining.delete(id); steps.push(step);
  }
  const explicit = new Map(answers.map((a) => [a.skillId, a.answer]));
  return VersionedPathwayResponse.parse({ ...path, criteria: context.meta, review, steps: steps.map((step, index) => {
    const capability = caps.get(step.skillId)!;
    const resource = bundle.resources.find((r) => r.resourceId === step.resources[0]?.resourceId);
    const isPrerequisite = prerequisites.has(step.skillId);
    const possessionState = explicit.get(step.skillId) === "not-yet" ? "not-yet" as const : "unconfirmed" as const;
    const status = possessionState === "not-yet" ? "You marked this as Not yet." : "You have not confirmed this skill. If you already have it, confirm it instead of relearning it.";
    return { ...step, order: index + 1, prerequisites: capability.prerequisiteSkillIds,
      isPrerequisite, possessionState, estimateBasis: resource?.estimateBasis, estimateNote: resource?.estimateNote,
      resources: step.resources.map((r) => {
        const stored = bundle.resources.find((x) => x.resourceId === r.resourceId)!;
        return { ...r, estimateBasis: stored.estimateBasis, estimateNote: stored.estimateNote, checkedAt: stored.checkedAt };
      }),
      why: `${isPrerequisite ? "A prerequisite for a suggested learning step." : `A listed skill for ${role.name}.`} ${status} ${capability.definition} ` +
        (resource ? `${resource.estimateBasis === "app" ? "App-estimated" : "Provider-estimated"} practice time. ${resource.estimateNote}` : "No ready resource is available for this prerequisite.") };
  }) });
}
