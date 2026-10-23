// Database reads for pathways, SDGs and the evidence list. Each function gets the
// Prisma client as an argument, so tests can pass a small fake.
import type { PrismaClient } from "./generated/prisma/client.ts";
import type { EvidenceListResponse, SdgResponse } from "../contracts/index.ts";
import type { ResourceInput } from "../pathway/pathwayEngine.ts";

type ReferenceDb = Pick<PrismaClient, "resource" | "sdgGoal" | "roleSdg" | "skillSdg" | "trendEvidence">;

// The Resource rows for these skills, exactly as stored.
export async function loadResources(db: ReferenceDb, skillIds: string[]): Promise<ResourceInput[]> {
  const rows = await db.resource.findMany({ where: { skillId: { in: skillIds } }, orderBy: { id: "asc" } });
  return rows.map((r) => ({
    resourceId: r.id,
    skillId: r.skillId,
    title: r.title,
    url: r.url,
    provider: r.provider,
    cost: r.cost,
    estimatedHours: r.estimatedHours,
    sourceNote: r.sourceNote,
    isPlaceholder: r.isPlaceholder,
  }));
}

// GET /api/sdg: all goals, role tags and skill tags.
export async function loadSdg(db: ReferenceDb): Promise<SdgResponse> {
  const [goals, roleTags, skillTags] = await Promise.all([
    db.sdgGoal.findMany({ orderBy: { number: "asc" } }),
    db.roleSdg.findMany({ orderBy: [{ roleId: "asc" }, { sdgId: "asc" }] }),
    db.skillSdg.findMany({ orderBy: [{ skillId: "asc" }, { sdgId: "asc" }] }),
  ]);
  return {
    goals: goals.map((g) => ({ sdgId: g.id, number: g.number, name: g.name })),
    roleTags: roleTags.map((t) => ({ roleId: t.roleId, sdgId: t.sdgId, rationale: t.rationale, isPlaceholder: t.isPlaceholder })),
    skillTags: skillTags.map((t) => ({ skillId: t.skillId, sdgId: t.sdgId, rationale: t.rationale, isPlaceholder: t.isPlaceholder })),
  };
}

// GET /api/evidence: REVIEWED evidence only, one TrendEvidence row = one EvidenceItem.
export const EVIDENCE_LIST_WHERE = { isPlaceholder: false };

export async function loadEvidenceList(db: ReferenceDb): Promise<EvidenceListResponse> {
  const rows = await db.trendEvidence.findMany({
    where: EVIDENCE_LIST_WHERE,
    include: { source: true },
    orderBy: { id: "asc" },
  });
  return {
    items: rows
      .filter((e) => !e.isPlaceholder) // same rule again, to be safe
      .map((e) => ({
        id: e.id,
        title: e.source.title,
        publisher: e.source.publisher,
        url: e.source.url,
        publishedDate: isoDate(e.source.publishedDate),
        retrievedAt: isoDate(e.source.retrievedAt),
        supportedClaim: e.supportedClaim,
        limitation: e.limitation,
        linkedSkillIds: [e.skillId], // one row links one skill
      })),
  };
}

// A database date as "YYYY-MM-DD".
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
