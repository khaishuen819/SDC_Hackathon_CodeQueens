import * as z from "zod";
import { EvidenceId, RoleId, SkillId } from "./ids.ts";
import { ConfirmedProfile } from "./profile.ts";
import { TrendDirection } from "./evidence.ts";

// Sent with every match response, so the frontend always shows what a score means.
export const SCORE_MEANING =
  "The score (0 to 100) shows how much of this role's weighted skill list is covered by your confirmed skills. " +
  "It is not a hiring probability and does not predict whether you will get a job.";

// POST /api/match: the body is the confirmed profile itself.
export const MatchRequest = ConfirmedProfile;
export type MatchRequest = z.infer<typeof MatchRequest>;

// One piece of trend evidence that changed a skill's weight (feature 2, M3/M4).
export const EvidenceAdjustment = z.object({
  evidenceId: EvidenceId,
  direction: TrendDirection,
  // This row's own adjustment. The total per skill is limited to -1..+1.
  adjustment: z.number(),
  explanation: z.string().min(1),
});
export type EvidenceAdjustment = z.infer<typeof EvidenceAdjustment>;

// One of the role's skills, as it appears in a match result.
export const RoleSkillResult = z.object({
  skillId: SkillId,
  // How much this skill counts for the role, after any trend evidence
  // (the "effective weight"; base scale 1 to 3 is set in the database seed).
  weight: z.number().positive(),
  isRequired: z.boolean(),
  // Only present when trend evidence exists for this skill:
  // the weight before evidence, and the evidence that changed it.
  baseWeight: z.number().positive().optional(),
  evidenceAdjustments: z.array(EvidenceAdjustment).optional(),
});
export type RoleSkillResult = z.infer<typeof RoleSkillResult>;

export const RoleMatch = z.object({
  roleId: RoleId,
  rank: z.int().min(1), // 1 = highest score
  score: z.int().min(0).max(100), // whole numbers, easier to read
  // Plain text: how this score was calculated for this graduate.
  scoreExplanation: z.string().min(1),
  // Every role skill is in exactly one of these three lists.
  // Only strengths count towards the score.
  // Role skills that are in confirmedSkills.
  strengths: z.array(RoleSkillResult),
  // Role skills not on the confirmed profile (and not marked "not sure").
  // Shown to the graduate as "not on your confirmed profile", not as "missing".
  gaps: z.array(RoleSkillResult),
  // Role skills the graduate marked "not sure" (unconfirmedSkillIds).
  unconfirmedSkills: z.array(RoleSkillResult),
  // true on the graduate's preferred route. It stays their route even if
  // another route scores higher.
  preferredRouteKept: z.boolean(),
});
export type RoleMatch = z.infer<typeof RoleMatch>;

export const MatchResponse = z.object({
  scoreMeaning: z.literal(SCORE_MEANING),
  roles: z.array(RoleMatch), // ordered by rank
});
export type MatchResponse = z.infer<typeof MatchResponse>;
