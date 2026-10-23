// Database reads for POST /api/match. The match engine itself never touches the database.
import { prisma } from "./client.ts";
import type { EvidenceInput, RoleInput } from "../matching/matchEngine.ts";

export async function loadRoles(): Promise<RoleInput[]> {
  const rows = await prisma.role.findMany({ include: { skills: { include: { skill: true } } } });
  return rows.map((role) => ({
    roleId: role.id,
    name: role.name,
    skills: role.skills.map((rs) => ({
      skillId: rs.skillId,
      name: rs.skill.name,
      weight: rs.weight,
      isRequired: rs.isRequired,
    })),
  }));
}

export async function loadKnownSkillIds(): Promise<string[]> {
  const rows = await prisma.skill.findMany({ select: { id: true } });
  return rows.map((s) => s.id);
}

// Only evidence that has a priorityAdjustment can change a weight.
export async function loadEvidence(): Promise<EvidenceInput[]> {
  const rows = await prisma.trendEvidence.findMany({ where: { priorityAdjustment: { not: null } } });
  return rows.map((e) => ({
    evidenceId: e.id,
    skillId: e.skillId,
    direction: e.direction,
    priorityAdjustment: e.priorityAdjustment ?? 0, // never null here, because of the filter above
    explanation: e.adjustmentExplanation,
  }));
}
