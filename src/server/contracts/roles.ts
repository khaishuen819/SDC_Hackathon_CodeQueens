import * as z from "zod";
import { RoleId, SkillId } from "./ids.ts";
import { RecognisedSkill, TrendMeta } from "./criteria.ts";

// GET /api/roles: the pilot roles with their skills and weights.

export const RoleSkillInfo = z.object({
  skillId: SkillId,
  name: z.string().min(1),
  // How much this skill counts for the role: 1 = nice to have, 2 = important, 3 = core.
  weight: z.number().positive(),
  isRequired: z.boolean(),
});
export type RoleSkillInfo = z.infer<typeof RoleSkillInfo>;

export const RoleInfo = z.object({
  roleId: RoleId,
  name: z.string().min(1),
  description: z.string(),
  skills: z.array(RoleSkillInfo), // highest weight first
  // true if the role, any of its skills, or any weight is unreviewed placeholder data.
  isPlaceholder: z.boolean(),
});
export type RoleInfo = z.infer<typeof RoleInfo>;

export const RolesResponse = z.object({
  // true if anything in this response is placeholder data. Never show it as real.
  isPlaceholder: z.boolean(),
  roles: z.array(RoleInfo),
});
export type RolesResponse = z.infer<typeof RolesResponse>;

export const VersionedRolesResponse = RolesResponse.extend({ criteria: TrendMeta, recognisedSkills: z.array(RecognisedSkill).min(1) })
  .refine((r) => r.criteria.snapshotId !== null && new Set(r.recognisedSkills.map((s) => s.skillId)).size === r.recognisedSkills.length &&
    r.roles.every((role) => role.skills.every((skill) => skill.weight === 1 && r.recognisedSkills.some((s) => s.skillId === skill.skillId))),
  { error: "Versioned roles require a pinned complete recognised-skills registry and one-point associations." });
export type VersionedRolesResponse = z.infer<typeof VersionedRolesResponse>;
