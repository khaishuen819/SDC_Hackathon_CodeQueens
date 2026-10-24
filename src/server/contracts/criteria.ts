// Transport leaves: do not import response or bundle schemas here.
import * as z from "zod";
import { RoleId, SkillId, SourceId, EvidenceId } from "./ids.ts";

export const SnapshotId = z.string().regex(/^criteria-[a-f0-9]{64}$/);
export type SnapshotId = z.infer<typeof SnapshotId>;
export const Instant = z.iso.datetime({ offset: true });

export const SkillAnswer = z.strictObject({ skillId: SkillId, answer: z.enum(["have", "not-yet", "not-sure"]) });
export type SkillAnswer = z.infer<typeof SkillAnswer>;
export const CriteriaReview = z.strictObject({
  fromSnapshotId: SnapshotId.optional(), targetSnapshotId: SnapshotId,
  answers: z.array(SkillAnswer).default([]),
}).refine((r) => new Set(r.answers.map((a) => a.skillId)).size === r.answers.length, {
  error: "A skill may have only one possession answer.", path: ["answers"],
});
export type CriteriaReview = z.input<typeof CriteriaReview>;

export const SkillReview = z.strictObject({
  fromSnapshotId: SnapshotId.optional(), targetSnapshotId: SnapshotId,
  questions: z.array(z.strictObject({
    skillId: SkillId, name: z.string().min(1), roleIds: z.array(RoleId).min(1),
    why: z.string().min(1), evidenceIds: z.array(EvidenceId), state: z.enum(["not-sure", "unanswered"]),
  })),
}).refine((r) => new Set(r.questions.map((q) => q.skillId)).size === r.questions.length, {
  error: "Questions must use distinct canonical skills.", path: ["questions"],
});
export type SkillReview = z.infer<typeof SkillReview>;

export const RecognisedSkill = z.strictObject({ skillId: SkillId, name: z.string().min(1) });
export type RecognisedSkill = z.infer<typeof RecognisedSkill>;

export const ProviderState = z.strictObject({
  providerId: SourceId, status: z.enum(["ok", "unchanged", "failed", "disabled"]),
  lastAttemptAt: Instant.nullable(), lastSuccessfulCheckAt: Instant.nullable(),
  errorCode: z.string().max(100).optional(), etag: z.string().optional(), lastModified: z.string().optional(),
});
export type ProviderState = z.infer<typeof ProviderState>;
export const TrendMeta = z.strictObject({
  snapshotId: SnapshotId.nullable(), policyVersion: z.literal("count-coverage-v1"),
  status: z.enum(["fresh", "partial", "unavailable", "disabled"]),
  lastSuccessfulCheckAt: Instant.nullable(), lastAttemptAt: Instant.nullable(),
  providers: z.array(ProviderState), notices: z.array(z.string().max(500)),
  deferredItemCount: z.int().nonnegative(), quarantinedItemCount: z.int().nonnegative(),
  refreshControl: z.strictObject({ state: z.enum(["ready", "busy", "cooldown"]), retryAt: Instant.nullable() }),
});
export type TrendMeta = z.infer<typeof TrendMeta>;
