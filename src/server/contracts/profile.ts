import * as z from "zod";
import { RoleId, SkillId } from "./ids.ts";

// ---------------------------------------------------------------------------
// DRAFT profile: what CV extraction suggests. Not trusted yet.
// The graduate corrects it and turns it into a ConfirmedProfile.
// The `status` field makes the two types different, so a draft can never be
// sent to /api/match or /api/pathway by mistake.
// No name or contact details: we do not need them.
// ---------------------------------------------------------------------------

export const ExtractedSkill = z.object({
  // Our catalogue ID, or null when the skill is not in the catalogue.
  // Never an invented ID.
  skillId: SkillId.nullable(),
  // The skill as written in the CV, e.g. "Node.js".
  rawName: z.string().min(1),
  // Short quote from the CV that shows the skill.
  evidence: z.string().min(1),
  // How sure the extractor is (0 to 1). Not a measure of ability.
  confidence: z.number().min(0).max(1),
});
export type ExtractedSkill = z.infer<typeof ExtractedSkill>;

export const DraftProject = z.object({
  title: z.string().min(1),
  summary: z.string(),
  skillIds: z.array(SkillId),
});
export type DraftProject = z.infer<typeof DraftProject>;

export const DraftExperience = z.object({
  title: z.string().min(1),
  organisation: z.string().optional(),
  summary: z.string(),
});
export type DraftExperience = z.infer<typeof DraftExperience>;

export const DraftProfile = z.object({
  status: z.literal("draft"),
  extractedSkills: z.array(ExtractedSkill),
  projects: z.array(DraftProject),
  experience: z.array(DraftExperience),
  // Notes for the graduate, e.g. a skill that is not in our catalogue.
  warnings: z.array(z.string()),
});
export type DraftProfile = z.infer<typeof DraftProfile>;

// ---------------------------------------------------------------------------
// CONFIRMED profile: checked and corrected by the graduate.
// Matching and pathways use only this.
// ---------------------------------------------------------------------------

// Self-reported by the graduate.
export const SkillLevel = z.enum(["beginner", "intermediate", "advanced"]);
export type SkillLevel = z.infer<typeof SkillLevel>;

export const ConfirmedSkill = z.object({
  skillId: SkillId,
  level: SkillLevel.optional(),
});
export type ConfirmedSkill = z.infer<typeof ConfirmedSkill>;

// "preferred-route": the graduate already knows the route they want.
// "exploring": the graduate wants to compare routes first.
export const EntryPath = z.enum(["preferred-route", "exploring"]);
export type EntryPath = z.infer<typeof EntryPath>;

export const ConfirmedProfile = z
  .object({
    status: z.literal("confirmed"),
    // Final list of skills the graduate says they have (includes added ones).
    confirmedSkills: z.array(ConfirmedSkill),
    // Draft skills the graduate removed (the CV extraction was wrong).
    removedSkillIds: z.array(SkillId),
    // Skills the graduate added that the CV did not show. Also in confirmedSkills.
    addedSkillIds: z.array(SkillId),
    // Skills the graduate is not sure about. "Unconfirmed" is not zero ability.
    unconfirmedSkillIds: z.array(SkillId),
    entryPath: EntryPath,
    // Required when entryPath is "preferred-route".
    preferredRouteId: RoleId.optional(),
    confirmedAt: z.iso.datetime(),
  })
  .refine((p) => p.entryPath !== "preferred-route" || p.preferredRouteId !== undefined, {
    error: "preferredRouteId is required when entryPath is preferred-route",
    path: ["preferredRouteId"],
  })
  .refine(
    (p) => {
      const confirmed = new Set(p.confirmedSkills.map((s) => s.skillId));
      return p.addedSkillIds.every((id) => confirmed.has(id));
    },
    { error: "every addedSkillId must also be in confirmedSkills", path: ["addedSkillIds"] },
  )
  .refine(
    // A skill can be in only one group: confirmed, removed or unconfirmed.
    (p) => {
      const all = [
        ...p.confirmedSkills.map((s) => s.skillId),
        ...p.removedSkillIds,
        ...p.unconfirmedSkillIds,
      ];
      return new Set(all).size === all.length;
    },
    {
      error: "a skill can appear only once across confirmedSkills, removedSkillIds and unconfirmedSkillIds",
      path: ["confirmedSkills"],
    },
  );
export type ConfirmedProfile = z.infer<typeof ConfirmedProfile>;
