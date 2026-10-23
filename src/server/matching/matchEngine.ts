// Role matching: a pure function. It gets everything it needs as arguments
// (no database, no network), so it is easy to test and to explain.
import {
  SCORE_MEANING,
  type ConfirmedProfile,
  type EvidenceAdjustment,
  type MatchResponse,
  type RoleMatch,
  type RoleSkillResult,
  type TrendDirection,
} from "../contracts/index.ts";

// A role with its skills and base weights (from the database).
// isPlaceholder on a skill = its weight row or the skill itself is placeholder data.
export type RoleInput = {
  roleId: string;
  name: string;
  isPlaceholder: boolean;
  skills: Array<{ skillId: string; name: string; weight: number; isRequired: boolean; isPlaceholder: boolean }>;
};

// One reviewed TrendEvidence row (feature 2, M3/M4). Only rows with a
// priorityAdjustment change weights; the pathway also cites rows without one.
export type EvidenceInput = {
  evidenceId: string;
  skillId: string;
  direction: TrendDirection;
  priorityAdjustment: number | null;
  explanation: string | null;
};

// PROPOSED, to confirm with M3/M4: the evidence for one skill can change its weight
// by at most -1 to +1 in total, and a weight never goes below 0.5.
export const MAX_TOTAL_ADJUSTMENT = 1;
export const MIN_EFFECTIVE_WEIGHT = 0.5;

// evidence = null means the evidence could not be read: base weights are used,
// and every explanation says so.
export function matchRoles(
  profile: ConfirmedProfile,
  roles: RoleInput[],
  evidence: EvidenceInput[] | null,
): MatchResponse {
  const confirmed = new Set(profile.confirmedSkills.map((s) => s.skillId));
  const notSure = new Set(profile.unconfirmedSkillIds);
  const preferredId = profile.entryPath === "preferred-route" ? profile.preferredRouteId : undefined;

  const scored = roles.map((role) => scoreRole(role, confirmed, notSure, evidence));

  // Highest score first; ties by role id, so the order is always the same.
  scored.sort((a, b) => b.score - a.score || (a.roleId < b.roleId ? -1 : 1));
  const top = scored[0];

  const ranked: RoleMatch[] = scored.map((r, index) => {
    const isPreferred = r.roleId === preferredId;
    const sentences = [...r.sentences];
    if (isPreferred && top) {
      if (top.roleId === r.roleId) sentences.push("This is your preferred route.");
      else if (top.score === r.score) sentences.push(`This is your preferred route. ${top.name} has the same score.`);
      else sentences.push(`This is your preferred route, so it stays your route even though ${top.name} scores higher.`);
    }
    return {
      roleId: r.roleId,
      rank: index + 1,
      score: r.score,
      scoreExplanation: sentences.join(" "),
      strengths: r.strengths,
      gaps: r.gaps,
      unconfirmedSkills: r.unconfirmedSkills,
      // The preferred route is flagged, never moved: its rank is still by score.
      preferredRouteKept: isPreferred,
    };
  });

  const isPlaceholder = roles.some((role) => role.isPlaceholder || role.skills.some((s) => s.isPlaceholder));
  return { scoreMeaning: SCORE_MEANING, isPlaceholder, roles: ranked };
}

// A role skill after trend evidence has been applied.
export type WeightedSkill = {
  skillId: string;
  name: string;
  isRequired: boolean;
  baseWeight: number;
  weight: number; // effective weight
  adjustments: EvidenceAdjustment[];
  rawTotal: number; // sum of adjustments before the -1..+1 limit
  limitedTotal: number; // after the limit
  hitMinimum: boolean; // weight was raised to MIN_EFFECTIVE_WEIGHT
};

// Used by matching and by pathways, so both follow the same evidence rules.
export function applyEvidence(skill: RoleInput["skills"][number], evidence: EvidenceInput[]): WeightedSkill {
  const rows = evidence.flatMap((e) =>
    e.skillId === skill.skillId && e.priorityAdjustment !== null ? [{ ...e, priorityAdjustment: e.priorityAdjustment }] : [],
  );
  const adjustments = rows.map((e) => ({
    evidenceId: e.evidenceId,
    direction: e.direction,
    adjustment: e.priorityAdjustment,
    explanation: e.explanation || "No explanation given.",
  }));
  const rawTotal = round2(rows.reduce((sum, e) => sum + e.priorityAdjustment, 0));
  const limitedTotal = Math.min(MAX_TOTAL_ADJUSTMENT, Math.max(-MAX_TOTAL_ADJUSTMENT, rawTotal));
  const unlimitedWeight = round2(skill.weight + limitedTotal);
  return {
    skillId: skill.skillId,
    name: skill.name,
    isRequired: skill.isRequired,
    baseWeight: skill.weight,
    weight: Math.max(MIN_EFFECTIVE_WEIGHT, unlimitedWeight),
    adjustments,
    rawTotal,
    limitedTotal,
    hitMinimum: unlimitedWeight < MIN_EFFECTIVE_WEIGHT,
  };
}

function scoreRole(
  role: RoleInput,
  confirmed: Set<string>,
  notSure: Set<string>,
  evidence: EvidenceInput[] | null,
) {
  // Highest weight first, then by id: the same order in every list.
  const skills = role.skills
    .map((s) => applyEvidence(s, evidence ?? []))
    .sort((a, b) => b.weight - a.weight || (a.skillId < b.skillId ? -1 : 1));

  // Each role skill goes in exactly one list. A removed skill is simply not
  // confirmed, so it is a gap.
  const strengths = skills.filter((s) => confirmed.has(s.skillId));
  const unconfirmed = skills.filter((s) => !confirmed.has(s.skillId) && notSure.has(s.skillId));
  const gaps = skills.filter((s) => !confirmed.has(s.skillId) && !notSure.has(s.skillId));

  // Only strengths count toward the score.
  const total = round2(sumWeights(skills));
  const covered = round2(sumWeights(strengths));
  const exact = total > 0 ? (covered / total) * 100 : 0;
  const score = Math.round(exact);

  const sentences: string[] = [];
  if (confirmed.size === 0) {
    sentences.push(
      `You have no confirmed skills yet, so the score is 0 (0 of this role's ${fmt(total)} skill-weight points). ` +
        "Confirm the skills you have to see how well they cover this role.",
    );
  } else {
    sentences.push(
      `Your confirmed skills cover ${fmt(covered)} of this role's ${fmt(total)} skill-weight points: ` +
        `${fmt(covered)} / ${fmt(total)} x 100 = ${score}${exact === score ? "" : " (rounded)"}.`,
    );
    if (unconfirmed.length > 0) {
      sentences.push(`Not counted (you marked as not sure): ${listSkills(unconfirmed)}.`);
    }
    if (gaps.length > 0) {
      sentences.push(`Not counted (not on your confirmed profile): ${listSkills(gaps)}.`);
    }
  }

  // Say exactly what trend evidence changed, and cite it.
  for (const s of skills.filter((x) => x.adjustments.length > 0)) {
    sentences.push(evidenceSentence(s));
  }
  if (evidence === null) {
    sentences.push(EVIDENCE_UNAVAILABLE);
  }

  return {
    roleId: role.roleId,
    name: role.name,
    score,
    sentences,
    strengths: strengths.map(toResult),
    gaps: gaps.map(toResult),
    unconfirmedSkills: unconfirmed.map(toResult),
  };
}

export const EVIDENCE_UNAVAILABLE = "Trend evidence was not available, so base weights were used.";

// "Trend evidence changed the weight of Docker from 2 to 3 (+1 from evidence ev-1)."
export function evidenceSentence(s: WeightedSkill): string {
  let detail = `${signed(s.rawTotal)} from evidence ${s.adjustments.map((a) => a.evidenceId).join(", ")}`;
  if (s.rawTotal !== s.limitedTotal) detail += `, limited to ${signed(s.limitedTotal)}`;
  if (s.hitMinimum) detail += `; the lowest allowed weight is ${MIN_EFFECTIVE_WEIGHT}`;
  return `Trend evidence changed the weight of ${s.name} from ${fmt(s.baseWeight)} to ${fmt(s.weight)} (${detail}).`;
}

// baseWeight and evidenceAdjustments are only sent when evidence exists for the skill.
function toResult(s: WeightedSkill): RoleSkillResult {
  const result: RoleSkillResult = { skillId: s.skillId, weight: s.weight, isRequired: s.isRequired };
  if (s.adjustments.length > 0) {
    result.baseWeight = s.baseWeight;
    result.evidenceAdjustments = s.adjustments;
  }
  return result;
}

// "Docker (weight 2), Test automation (weight 3, required)"
function listSkills(skills: WeightedSkill[]): string {
  return skills.map((s) => `${s.name} (weight ${fmt(s.weight)}${s.isRequired ? ", required" : ""})`).join(", ");
}

function sumWeights(skills: WeightedSkill[]): number {
  return skills.reduce((sum, s) => sum + s.weight, 0);
}

// Round to 2 decimals, so 0.1 + 0.2 shows as 0.3.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function fmt(n: number): string {
  return String(round2(n));
}

function signed(n: number): string {
  return n > 0 ? `+${fmt(n)}` : fmt(n);
}

// Skill or role IDs in the profile that we do not know. The route answers
// INVALID_INPUT with these, instead of guessing.
// knownRoleIds = null skips the preferredRouteId check (the pathway does not use it).
export function findUnknownIds(
  profile: ConfirmedProfile,
  knownSkillIds: Iterable<string>,
  knownRoleIds: Iterable<string> | null,
): Array<{ path: string; message: string }> {
  const skills = new Set(knownSkillIds);
  const problems: Array<{ path: string; message: string }> = [];

  profile.confirmedSkills.forEach((s, i) => {
    if (!skills.has(s.skillId)) problems.push({ path: `confirmedSkills.${i}.skillId`, message: `Unknown skillId "${s.skillId}".` });
  });
  for (const key of ["removedSkillIds", "addedSkillIds", "unconfirmedSkillIds"] as const) {
    profile[key].forEach((id, i) => {
      if (!skills.has(id)) problems.push({ path: `${key}.${i}`, message: `Unknown skillId "${id}".` });
    });
  }
  const roles = knownRoleIds === null ? null : new Set(knownRoleIds);
  if (roles !== null && profile.preferredRouteId !== undefined && !roles.has(profile.preferredRouteId)) {
    problems.push({ path: "preferredRouteId", message: `Unknown roleId "${profile.preferredRouteId}".` });
  }
  return problems;
}
