import express, { Router } from "express";
import { MatchRequest } from "../contracts/match.ts";
import { ConfirmedProfile } from "../contracts/profile.ts";
import { findUnknownIds } from "../matching/matchEngine.ts";
import { prepareCriteriaRequest } from "../trends/context.ts";
import type { CriteriaRequestDeps } from "../trends/context.ts";
import { presentMatch } from "../trends/presentation.ts";
import { ApiFailure, zodDetails } from "./errors.ts";

export type MatchRouteDeps = CriteriaRequestDeps;
export function createMatchRouter(deps: MatchRouteDeps) {
  const router = Router();
  router.post("/api/match", express.json({ limit: "100kb" }), async (req, res) => {
    const parsed = MatchRequest.safeParse(req.body);
    if (!parsed.success) throw new ApiFailure("INVALID_INPUT", req.body?.status === "draft"
      ? "This is a draft profile. Confirm it before matching." : "The confirmed profile is not valid.", zodDetails(parsed.error));
    const ready = await prepareCriteriaRequest(ConfirmedProfile.parse(parsed.data), parsed.data, deps);
    const bundle = ready.context.snapshot.bundle;
    const unknown = findUnknownIds(ready.result.profile, bundle.capabilities.map((c) => c.skillId), bundle.roles.map((r) => r.roleId));
    if (unknown.length) throw new ApiFailure("INVALID_INPUT", "The profile uses skill or role IDs we do not know.", unknown);
    res.json(presentMatch(ready.result.profile, ready.context, ready.result.review, ready.previous));
  });
  return router;
}
