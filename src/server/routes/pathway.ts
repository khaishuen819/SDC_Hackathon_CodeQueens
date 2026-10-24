import express, { Router } from "express";
import { PathwayRequest } from "../contracts/pathway.ts";
import { prepareCriteriaRequest } from "../trends/context.ts";
import type { CriteriaRequestDeps } from "../trends/context.ts";
import { presentPathway } from "../trends/presentation.ts";
import { ApiFailure, zodDetails } from "./errors.ts";

export type PathwayRouteDeps = CriteriaRequestDeps;
export function createPathwayRouter(deps: PathwayRouteDeps) {
  const router = Router();
  router.post("/api/pathway", express.json({ limit: "100kb" }), async (req, res) => {
    const parsed = PathwayRequest.safeParse(req.body);
    if (!parsed.success) throw new ApiFailure("INVALID_INPUT", req.body?.profile?.status === "draft"
      ? "This is a draft profile. Confirm it before getting a pathway." : "The pathway request is not valid.", zodDetails(parsed.error));
    const { profile, roleId, criteriaReview } = parsed.data;
    const ready = await prepareCriteriaRequest(profile, parsed.data, deps);
    res.json(presentPathway(ready.result.profile, roleId, ready.context, ready.result.review, criteriaReview?.answers));
  });
  return router;
}
