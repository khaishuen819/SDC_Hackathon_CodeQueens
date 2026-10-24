import { ConfirmedProfile } from "../contracts/profile.ts";
import { CriteriaReview, SkillReview } from "../contracts/criteria.ts";
import { CriteriaBundle } from "../contracts/trends.ts";
import { criteriaSnapshotId } from "./identity.ts";
import type { ReconcileResult } from "../contracts/trends.ts";

export class CriteriaReconciliationError extends Error {
  code: "INVALID_INPUT" | "CRITERIA_CONTEXT_REQUIRED";
  constructor(code: "INVALID_INPUT" | "CRITERIA_CONTEXT_REQUIRED", message: string) {
    super(message); this.name = "CriteriaReconciliationError"; this.code = code;
  }
}

// Answers are ephemeral inputs. No CV, personal profile or answer is stored in
// the public criteria, and unanswered skills never hold scores/pathways back.
export function reconcileCriteria(input: ConfirmedProfile, previous: CriteriaBundle | null, target: CriteriaBundle, review?: CriteriaReview): ReconcileResult {
  const profile = ConfirmedProfile.parse(input), bundle = CriteriaBundle.parse(target);
  const from = previous ? CriteriaBundle.parse(previous) : null;
  const snapshotId = criteriaSnapshotId(bundle);
  const answers = CriteriaReview.parse(review ?? { targetSnapshotId: snapshotId });
  if (answers.targetSnapshotId !== snapshotId || (answers.fromSnapshotId && answers.fromSnapshotId !== snapshotId &&
      (!from || answers.fromSnapshotId !== criteriaSnapshotId(from)))) {
    throw new CriteriaReconciliationError("CRITERIA_CONTEXT_REQUIRED", "Reload the correct criteria version; possession answers are optional.");
  }
  const registry = new Map(bundle.capabilities.map((c) => [c.skillId, c]));
  if (from?.capabilities.some((c) => !registry.has(c.skillId))) {
    throw new CriteriaReconciliationError("CRITERIA_CONTEXT_REQUIRED", "The target criteria must retain recognised historical skills.");
  }
  const profileIds = [...profile.confirmedSkills.map((s) => s.skillId), ...profile.addedSkillIds, ...profile.removedSkillIds, ...profile.unconfirmedSkillIds];
  if ([...profileIds, ...answers.answers.map((a) => a.skillId)].some((id) => !registry.has(id))) {
    throw new CriteriaReconciliationError("INVALID_INPUT", "Profile/review contains an unrecognised skill ID.");
  }

  const confirmed = new Map(profile.confirmedSkills.map((s) => [s.skillId, s]));
  const originalConfirmed = new Set(confirmed.keys());
  const added = new Set(profile.addedSkillIds), removed = new Set(profile.removedSkillIds), unsure = new Set(profile.unconfirmedSkillIds);
  const explicit = new Map(answers.answers.map((a) => [a.skillId, a.answer]));
  for (const answer of answers.answers) {
    const old = confirmed.get(answer.skillId), wasAdded = added.has(answer.skillId);
    confirmed.delete(answer.skillId); added.delete(answer.skillId); unsure.delete(answer.skillId);
    if (answer.answer === "have") {
      removed.delete(answer.skillId);
      confirmed.set(answer.skillId, old ?? { skillId: answer.skillId });
      if (wasAdded || !originalConfirmed.has(answer.skillId)) added.add(answer.skillId);
    } else if (answer.answer === "not-sure") {
      removed.delete(answer.skillId); unsure.add(answer.skillId);
    }
    // Not yet is an explicit answer, not a fabricated wrong-extraction record.
  }
  const order = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  const updated = ConfirmedProfile.parse({
    ...profile, confirmedSkills: [...confirmed.values()].sort((a, b) => order(a.skillId, b.skillId)),
    addedSkillIds: [...added].sort(order), removedSkillIds: [...removed].sort(order), unconfirmedSkillIds: [...unsure].sort(order),
  });
  const current = new Map<string, string[]>();
  for (const role of bundle.roles) for (const skill of role.skills) {
    current.set(skill.skillId, [...(current.get(skill.skillId) ?? []), role.roleId]);
  }
  const questions = [...current].sort(([a], [b]) => order(a, b)).flatMap(([skillId, roleIds]) => {
    if (confirmed.has(skillId) || explicit.get(skillId) === "not-yet") return [];
    const capability = registry.get(skillId)!;
    return [{
      skillId, name: capability.name, roleIds: roleIds.sort(order), evidenceIds: capability.evidenceIds,
      why: "This capability is listed for the route but not confirmed in your profile. You can learn it or confirm you already have it.",
      state: unsure.has(skillId) ? "not-sure" as const : "unanswered" as const,
    }];
  });
  const guidance = SkillReview.parse({
    ...(answers.fromSnapshotId ? { fromSnapshotId: answers.fromSnapshotId } : {}), targetSnapshotId: snapshotId, questions,
  });
  return { status: "ready", profile: updated, snapshotId, review: guidance };
}
