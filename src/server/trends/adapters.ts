import type { EvidenceInput, RoleInput } from "../matching/matchEngine.ts";
import { CriteriaBundle } from "../contracts/trends.ts";

export function toCountRoleInputs(input: CriteriaBundle): RoleInput[] {
  const bundle = CriteriaBundle.parse(input);
  const names = new Map(bundle.capabilities.map((c) => [c.skillId, c.name]));
  return bundle.roles.map((role) => ({
    roleId: role.roleId, name: role.name, description: role.description, isPlaceholder: false,
    skills: role.skills.map((skill) => ({ ...skill, name: names.get(skill.skillId)!, weight: 1, isPlaceholder: false })),
  }));
}

export function toCitationOnlyEvidence(input: CriteriaBundle): EvidenceInput[] {
  return CriteriaBundle.parse(input).evidence.flatMap((e) => e.linkedSkillIds.map((skillId) => ({
    evidenceId: e.id, skillId, direction: "neutral" as const, priorityAdjustment: null, explanation: e.supportedClaim,
  })));
}
