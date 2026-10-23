import * as z from "zod";

// IDs are lowercase "slugs", e.g. "backend-development" or "sql".
// They are plain strings checked by a regex (no Zod brands), so example JSON
// and database rows can be used as they are.
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MESSAGE = "must be a lowercase slug, e.g. backend-development";

export const RoleId = z.string().regex(SLUG, SLUG_MESSAGE);
export type RoleId = z.infer<typeof RoleId>;

export const SkillId = z.string().regex(SLUG, SLUG_MESSAGE);
export type SkillId = z.infer<typeof SkillId>;

export const SourceId = z.string().regex(SLUG, SLUG_MESSAGE);
export type SourceId = z.infer<typeof SourceId>;

export const ResourceId = z.string().regex(SLUG, SLUG_MESSAGE);
export type ResourceId = z.infer<typeof ResourceId>;

export const EvidenceId = z.string().regex(SLUG, SLUG_MESSAGE);
export type EvidenceId = z.infer<typeof EvidenceId>;

// "sdg-1" to "sdg-17"
export const SdgId = z.string().regex(/^sdg-(?:[1-9]|1[0-7])$/, "must be sdg-1 to sdg-17");
export type SdgId = z.infer<typeof SdgId>;

// The two routes in the preliminary pilot.
export const PILOT_ROLE_IDS = ["backend-development", "qa-automation"] as const;
