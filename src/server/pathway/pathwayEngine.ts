// Learning pathway: a pure function. It gets everything as arguments (no database),
// and uses the same evidence rules as matching (applyEvidence).
import type { ConfirmedProfile, LearningResource, PathwayResponse, ResourceCost } from "../contracts/index.ts";
import {
  EVIDENCE_UNAVAILABLE,
  applyEvidence,
  evidenceSentence,
  fmt,
  type EvidenceInput,
  type RoleInput,
  type WeightedSkill,
} from "../matching/matchEngine.ts";

// One Resource row from the database, passed through as it is.
export type ResourceInput = {
  resourceId: string;
  skillId: string;
  title: string;
  url: string;
  provider: string;
  cost: ResourceCost;
  estimatedHours: number;
  sourceNote: string;
  isPlaceholder: boolean;
};

// evidence = REVIEWED rows only (the loader filters). null = could not be read:
// base weights are used, and every step says so.
export function buildPathway(
  profile: ConfirmedProfile,
  role: RoleInput,
  resources: ResourceInput[],
  evidence: EvidenceInput[] | null,
): PathwayResponse {
  const confirmed = new Set(profile.confirmedSkills.map((s) => s.skillId));

  // Steps = the role's skills that are not confirmed (removed and "not sure" skills included).
  // Order: required first, then effective weight (highest first), then skill id.
  const skills = role.skills
    .filter((s) => !confirmed.has(s.skillId))
    .map((s) => applyEvidence(s, evidence ?? []))
    .sort(
      (a, b) =>
        Number(b.isRequired) - Number(a.isRequired) || b.weight - a.weight || (a.skillId < b.skillId ? -1 : 1),
    );

  const steps = skills.map((s, index) => {
    // Only this skill's own resource rows, in a fixed order. Nothing is made up.
    const own = resources.filter((r) => r.skillId === s.skillId).sort((a, b) => (a.resourceId < b.resourceId ? -1 : 1));
    return {
      order: index + 1,
      skillId: s.skillId,
      why: whyText(s, role.name, profile, own.length > 0, evidence === null),
      estimatedHours: own[0]?.estimatedHours ?? null, // null = no resource listed yet
      resources: own.map(toLearningResource),
      prerequisites: [], // no prerequisite data yet (open item for M3)
      // Every reviewed evidence row for this skill.
      evidence: (evidence ?? []).filter((e) => e.skillId === s.skillId).map((e) => ({ evidenceId: e.evidenceId })),
    };
  });

  const isPlaceholder =
    role.isPlaceholder ||
    role.skills.some((s) => s.isPlaceholder) ||
    steps.some((step) => step.resources.some((r) => r.isPlaceholder));

  return { roleId: role.roleId, isPlaceholder, steps };
}

// Plain text for this graduate: required or not, weight, why it is on the list, evidence.
function whyText(
  s: WeightedSkill,
  roleName: string,
  profile: ConfirmedProfile,
  hasResource: boolean,
  evidenceUnavailable: boolean,
): string {
  const sentences = [
    s.isRequired
      ? `${s.name} is required for ${roleName} (weight ${fmt(s.weight)}).`
      : `${s.name} is not required for ${roleName}, but it counts with weight ${fmt(s.weight)}.`,
  ];

  if (profile.unconfirmedSkillIds.includes(s.skillId)) {
    sentences.push("You marked it as not sure, so check first whether you already have it before you spend time learning it.");
  } else if (profile.removedSkillIds.includes(s.skillId)) {
    sentences.push("You removed it from your draft profile, so it is not on your confirmed profile.");
  } else {
    sentences.push("You have not listed it, so it is not on your confirmed profile.");
  }

  if (s.adjustments.length > 0) sentences.push(evidenceSentence(s));
  if (evidenceUnavailable) sentences.push(EVIDENCE_UNAVAILABLE);
  if (!hasResource) sentences.push("No learning resource is listed for this skill yet.");
  return sentences.join(" ");
}

function toLearningResource(r: ResourceInput): LearningResource {
  return {
    resourceId: r.resourceId,
    title: r.title,
    url: r.url,
    provider: r.provider,
    cost: r.cost,
    sourceNote: r.sourceNote,
    isPlaceholder: r.isPlaceholder,
  };
}
