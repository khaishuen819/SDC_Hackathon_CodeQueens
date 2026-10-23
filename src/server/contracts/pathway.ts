import * as z from "zod";
import { ResourceId, RoleId, SkillId } from "./ids.ts";
import { ConfirmedProfile } from "./profile.ts";
import { EvidenceRef } from "./evidence.ts";

// POST /api/pathway
export const PathwayRequest = z.object({
  profile: ConfirmedProfile,
  roleId: RoleId, // the route the graduate chose
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
});
export type LearningResource = z.infer<typeof LearningResource>;

export const PathwayStep = z.object({
  order: z.int().min(1), // 1 = learn first
  skillId: SkillId,
  // Plain text: why this skill is next for this graduate.
  why: z.string().min(1),
  estimatedHours: z.number().positive(),
  resources: z.array(LearningResource),
  // Skills to have before this step.
  prerequisites: z.array(SkillId),
  // Trend evidence for this step. Filled later by feature 2 (M3/M4).
  evidence: z.array(EvidenceRef).optional(),
});
export type PathwayStep = z.infer<typeof PathwayStep>;

export const PathwayResponse = z.object({
  roleId: RoleId,
  steps: z.array(PathwayStep), // ordered by `order`
});
export type PathwayResponse = z.infer<typeof PathwayResponse>;
