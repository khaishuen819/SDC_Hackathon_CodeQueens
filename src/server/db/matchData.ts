// Database reads for matching. The match engine itself never touches the database.
// Each function gets the Prisma client as an argument, so tests can pass a small fake
// (this file only imports Prisma *types*, so it loads without DATABASE_URL).
import type { PrismaClient } from "./generated/prisma/client.ts";
import type { EvidenceInput, RoleInput } from "../matching/matchEngine.ts";

type MatchDb = Pick<PrismaClient, "role" | "skill" | "trendEvidence">;

export async function loadRoles(db: MatchDb): Promise<RoleInput[]> {
  const rows = await db.role.findMany({ include: { skills: { include: { skill: true } } } });
  return rows.map((role) => ({
    roleId: role.id,
    name: role.name,
    isPlaceholder: role.isPlaceholder,
    skills: role.skills.map((rs) => ({
      skillId: rs.skillId,
      name: rs.skill.name,
      weight: rs.weight,
      isRequired: rs.isRequired,
      // The weight row or the skill itself may be placeholder data.
      isPlaceholder: rs.isPlaceholder || rs.skill.isPlaceholder,
    })),
  }));
}

export async function loadKnownSkillIds(db: MatchDb): Promise<string[]> {
  const rows = await db.skill.findMany({ select: { id: true } });
  return rows.map((s) => s.id);
}

// Only REVIEWED evidence (isPlaceholder = false) with a priorityAdjustment can change a weight.
export const WEIGHT_EVIDENCE_WHERE = { isPlaceholder: false, priorityAdjustment: { not: null } };

export async function loadWeightEvidence(db: MatchDb): Promise<EvidenceInput[]> {
  const rows = await db.trendEvidence.findMany({ where: WEIGHT_EVIDENCE_WHERE, orderBy: { id: "asc" } });
  // Same rule again, to be safe.
  return rows.filter((e) => !e.isPlaceholder && e.priorityAdjustment !== null).map(toEvidenceInput);
}

// All REVIEWED evidence, with or without an adjustment. Pathways cite every reviewed
// row for a skill; only rows with an adjustment change its weight.
export const REVIEWED_EVIDENCE_WHERE = { isPlaceholder: false };

export async function loadReviewedEvidence(db: MatchDb): Promise<EvidenceInput[]> {
  const rows = await db.trendEvidence.findMany({ where: REVIEWED_EVIDENCE_WHERE, orderBy: { id: "asc" } });
  return rows.filter((e) => !e.isPlaceholder).map(toEvidenceInput);
}

function toEvidenceInput(e: {
  id: string;
  skillId: string;
  direction: EvidenceInput["direction"];
  priorityAdjustment: number | null;
  adjustmentExplanation: string | null;
}): EvidenceInput {
  return {
    evidenceId: e.id,
    skillId: e.skillId,
    direction: e.direction,
    priorityAdjustment: e.priorityAdjustment,
    explanation: e.adjustmentExplanation,
  };
}
