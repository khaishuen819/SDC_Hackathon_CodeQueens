import * as z from "zod";
import { EvidenceId, SkillId } from "./ids.ts";
import { Instant, TrendMeta } from "./criteria.ts";

// PROPOSED, to be agreed with M3/M4.
// Feature 2 (trend evidence) belongs to M3/M4. M2 only provides this slot so
// their evidence can plug into pathways. Field names may change after review.

export const EvidenceItem = z.object({
  id: EvidenceId,
  title: z.string().min(1),
  publisher: z.string().min(1),
  url: z.url(),
  publishedDate: z.iso.date(), // "YYYY-MM-DD"
  retrievedAt: z.iso.date(), // when the team last checked the source
  // The one claim this source supports.
  supportedClaim: z.string().min(1),
  // What this source does NOT show (sample, region, date, etc.).
  limitation: z.string().min(1),
  linkedSkillIds: z.array(SkillId),
});
export type EvidenceItem = z.infer<typeof EvidenceItem>;

// A shared leaf schema keeps bundle and HTTP metadata aligned without a
// response -> bundle -> response import cycle. Unknown days remain null.
export const DatedEvidenceItem = EvidenceItem.omit({ publishedDate: true }).extend({
  publishedDate: z.iso.date().nullable(), publishedAt: Instant.nullable(), originalDate: z.string().nullable(),
  datePrecision: z.enum(["day", "month", "year", "unknown"]), dateBasis: z.enum(["published", "updated"]), checkedAt: Instant,
});
export type DatedEvidenceItem = z.infer<typeof DatedEvidenceItem>;
export const VersionedEvidenceListResponse = z.object({ items: z.array(DatedEvidenceItem), criteria: TrendMeta })
  .refine((r) => r.criteria.snapshotId !== null, "Evidence requires a pinned version.");
export type VersionedEvidenceListResponse = z.infer<typeof VersionedEvidenceListResponse>;

// Whether a source says a skill's demand is going up or down.
export const TrendDirection = z.enum(["rising", "declining", "neutral", "uncertain"]);
export type TrendDirection = z.infer<typeof TrendDirection>;

// A pointer from somewhere else (e.g. a pathway step) to an EvidenceItem.
// An object, not a bare ID, so fields can be added later without breaking M1.
export const EvidenceRef = z.object({
  evidenceId: EvidenceId,
});
export type EvidenceRef = z.infer<typeof EvidenceRef>;

// GET /api/evidence
export const EvidenceListResponse = z.object({
  items: z.array(EvidenceItem),
});
export type EvidenceListResponse = z.infer<typeof EvidenceListResponse>;
