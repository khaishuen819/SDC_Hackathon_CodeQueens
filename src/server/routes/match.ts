import express, { Router } from "express";
import { MatchRequest, MatchResponse } from "../contracts/index.ts";
import { findUnknownIds, matchRoles, type EvidenceInput, type RoleInput } from "../matching/matchEngine.ts";
import { ApiFailure, zodDetails } from "./errors.ts";

// What this route needs. Passed in (not imported) so tests run with no database.
export type MatchRouteDeps = {
  loadRoles: () => Promise<RoleInput[]>;
  loadKnownSkillIds: () => Promise<string[]>;
  loadEvidence: () => Promise<EvidenceInput[]>;
};

export function createMatchRouter(deps: MatchRouteDeps) {
  const router = Router();

  // POST /api/match: body = ConfirmedProfile -> MatchResponse.
  router.post("/api/match", express.json({ limit: "100kb" }), async (req, res) => {
    const parsed = MatchRequest.safeParse(req.body);
    if (!parsed.success) {
      const isDraft = typeof req.body === "object" && req.body?.status === "draft";
      const message = isDraft
        ? "This is a draft profile. The graduate must check and confirm it before matching."
        : "The confirmed profile is not valid.";
      throw new ApiFailure("INVALID_INPUT", message, zodDetails(parsed.error));
    }
    const profile = parsed.data;

    const [roles, knownSkillIds] = await Promise.all([deps.loadRoles(), deps.loadKnownSkillIds()]);
    const unknown = findUnknownIds(profile, knownSkillIds, roles.map((r) => r.roleId));
    if (unknown.length > 0) {
      throw new ApiFailure("INVALID_INPUT", "The profile uses skill or role IDs we do not know.", unknown);
    }

    // Trend evidence is optional: if it cannot be read, match with base weights.
    let evidence: EvidenceInput[] | null;
    try {
      evidence = await deps.loadEvidence();
    } catch (err) {
      console.error("Trend evidence read failed:", err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
      evidence = null;
    }

    // Check our own output against the contract before sending it.
    res.json(MatchResponse.parse(matchRoles(profile, roles, evidence)));
  });

  return router;
}
