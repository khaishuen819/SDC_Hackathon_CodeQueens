import * as z from "zod";
import { ResourceId, RoleId, SkillId } from "./ids.ts";
import { ConfirmedProfile } from "./profile.ts";
import { EvidenceRef } from "./evidence.ts";
import { CriteriaReview, SnapshotId, SkillReview, TrendMeta } from "./criteria.ts";

// POST /api/pathway
export const PathwayRequest = z.object({
  profile: ConfirmedProfile,
  roleId: RoleId, // the route the graduate chose
  snapshotId: SnapshotId.optional(),
  criteriaReview: CriteriaReview.optional(),
});
export type PathwayRequest = z.infer<typeof PathwayRequest>;

export const ResourceCost = z.enum(["free", "paid", "unknown"]);
export type ResourceCost = z.infer<typeof ResourceCost>;

export const LearningResource = z.object({
  resourceId: ResourceId,
  title: z.string().min(1),
  url: z.url(),
  provider: z.string().min(1),
  cost: ResourceCost,
  // Where this resource came from, or who reviewed it.
  sourceNote: z.string().min(1),
  // true for seeded content that nobody has reviewed yet. Show it as placeholder.
  isPlaceholder: z.boolean(),
  estimateBasis: z.enum(["provider", "app"]).optional(),
  estimateNote: z.string().min(1).optional(),
  checkedAt: z.iso.datetime({ offset: true }).optional(),
});
export type LearningResource = z.infer<typeof LearningResource>;

export const PathwayStep = z.object({
  order: z.int().min(1), // 1 = learn first
  skillId: SkillId,
  // Plain text: why this skill is next for this graduate.
  why: z.string().min(1),
  // Hours of the skill's learning resource (the first by resource id).
  // null when no resource is listed yet: we never invent an hour count.
  estimatedHours: z.number().positive().nullable(),
  resources: z.array(LearningResource),
  // Skills to have before this step. Always empty for now: there is no
  // prerequisite data yet (open item for M3).
  prerequisites: z.array(SkillId),
  // Trend evidence for this step. Filled later by feature 2 (M3/M4).
  evidence: z.array(EvidenceRef).optional(),
  estimateBasis: z.enum(["provider", "app"]).optional(),
  estimateNote: z.string().min(1).optional(),
  possessionState: z.enum(["unconfirmed", "not-yet"]).optional(),
  isPrerequisite: z.boolean().optional(),
});
export type PathwayStep = z.infer<typeof PathwayStep>;

export const PathwayResponse = z.object({
  roleId: RoleId,
  // true if any resource, the role, or any of its skills is placeholder data. Never show it as real.
  isPlaceholder: z.boolean(),
  steps: z.array(PathwayStep), // ordered by `order`
});
export type PathwayResponse = z.infer<typeof PathwayResponse>;

export const VersionedPathwayResponse = PathwayResponse.extend({ criteria: TrendMeta, review: SkillReview })
  .refine((r) => r.criteria.snapshotId === r.review.targetSnapshotId, { error: "Pathway and optional guidance must use the same version." });
export type VersionedPathwayResponse = z.infer<typeof VersionedPathwayResponse>;
