import express, { Router } from "express";
import * as z from "zod";
import { ConfirmedProfile } from "../contracts/profile.ts";
import { CriteriaReview, SkillReview, SnapshotId, TrendMeta } from "../contracts/criteria.ts";
import type { ReconcileResult } from "../contracts/trends.ts";
import { ApiFailure, zodDetails } from "./errors.ts";

export type TrendsRouteDeps = {
  refresh: () => Promise<TrendMeta>;
  loadState: () => Promise<TrendMeta>;
  reconcile: (profile: ConfirmedProfile, review: CriteriaReview) => Promise<ReconcileResult & { criteria: TrendMeta }>;
};
const Request = z.strictObject({ profile: ConfirmedProfile, review: CriteriaReview });
const Response = z.strictObject({ status: z.literal("ready"), profile: ConfirmedProfile, snapshotId: SnapshotId, review: SkillReview, criteria: TrendMeta })
  .refine((r) => r.snapshotId === r.criteria.snapshotId && r.snapshotId === r.review.targetSnapshotId, "Reconciliation requires one version.");

export function createTrendsRouter(deps: TrendsRouteDeps) {
  const router = Router();
  const current = (input: TrendMeta) => {
    const meta = TrendMeta.parse(input);
    if (!meta.snapshotId) throw new ApiFailure("TRENDS_UNAVAILABLE", "No valid criteria are available yet. The baseline must be prepared first.");
    return meta;
  };
  const readState = async (operation: () => Promise<TrendMeta>) => {
    try { return await operation(); }
    catch (error) {
      if (error instanceof ApiFailure) throw error;
      throw new ApiFailure("TRENDS_UNAVAILABLE", "Criteria storage is unavailable. Please try again later.");
    }
  };
  router.get("/api/trends", async (_req, res) => { res.json(current(await readState(deps.loadState))); });
  router.post("/api/trends/refresh", express.json({ limit: "1kb" }), async (req, res) => {
    const sentBody = req.headers["transfer-encoding"] || Number(req.headers["content-length"] ?? 0) > 0;
    if ((sentBody && req.body === undefined) || !z.strictObject({}).safeParse(req.body ?? {}).success) {
      throw new ApiFailure("INVALID_INPUT", "Refresh accepts no profile, URL or other input fields.");
    }
    res.json(current(await readState(deps.refresh)));
  });
  router.post("/api/trends/reconcile", express.json({ limit: "100kb" }), async (req, res) => {
    const parsed = Request.safeParse(req.body);
    if (!parsed.success) throw new ApiFailure("INVALID_INPUT", "The confirmed profile and criteria context are not valid.", zodDetails(parsed.error));
    res.json(Response.parse(await deps.reconcile(parsed.data.profile, parsed.data.review)));
  });
  return router;
}
