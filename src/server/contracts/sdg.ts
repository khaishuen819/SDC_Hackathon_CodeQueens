import * as z from "zod";
import { RoleId, SdgId, SkillId } from "./ids.ts";

// One of the 17 UN Sustainable Development Goals.
export const SdgGoal = z
  .object({
    sdgId: SdgId,
    number: z.int().min(1).max(17),
    name: z.string().min(1),
  })
  .refine((g) => g.sdgId === `sdg-${g.number}`, {
    error: "sdgId must match number, e.g. sdg-4 for number 4",
    path: ["sdgId"],
  });
export type SdgGoal = z.infer<typeof SdgGoal>;

// Links a role to a goal, with the reason in plain text.
export const RoleSdgTag = z.object({
  roleId: RoleId,
  sdgId: SdgId,
  rationale: z.string().min(1),
  isPlaceholder: z.boolean(),
});
export type RoleSdgTag = z.infer<typeof RoleSdgTag>;

// Links a skill to a goal, with the reason in plain text.
export const SkillSdgTag = z.object({
  skillId: SkillId,
  sdgId: SdgId,
  rationale: z.string().min(1),
  isPlaceholder: z.boolean(),
});
export type SkillSdgTag = z.infer<typeof SkillSdgTag>;

// GET /api/sdg
export const SdgResponse = z.object({
  goals: z.array(SdgGoal),
  roleTags: z.array(RoleSdgTag),
  skillTags: z.array(SkillSdgTag),
});
export type SdgResponse = z.infer<typeof SdgResponse>;
