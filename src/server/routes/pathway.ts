import express, { Router } from "express";
import { PathwayRequest, PathwayResponse } from "../contracts/index.ts";
import { findUnknownIds, type EvidenceInput, type RoleInput } from "../matching/matchEngine.ts";
import { buildPathway, type ResourceInput } from "../pathway/pathwayEngine.ts";
import { ApiFailure, zodDetails } from "./errors.ts";

// What this route needs. Passed in (not imported) so tests run with no database.
export type PathwayRouteDeps = {
  loadRoles: () => Promise<RoleInput[]>;
  loadKnownSkillIds: () => Promise<string[]>;
  loadResources: (skillIds: string[]) => Promise<ResourceInput[]>;
  loadEvidence: () => Promise<EvidenceInput[]>; // reviewed evidence only
};

export function createPathwayRouter(deps: PathwayRouteDeps) {
  const router = Router();

  // POST /api/pathway: { profile: ConfirmedProfile, roleId } -> PathwayResponse.
  router.post("/api/pathway", express.json({ limit: "100kb" }), async (req, res) => {
    const parsed = PathwayRequest.safeParse(req.body);
    if (!parsed.success) {
      const isDraft = typeof req.body === "object" && req.body?.profile?.status === "draft";
      const message = isDraft
        ? "This is a draft profile. The graduate must check and confirm it before getting a pathway."
        : "The pathway request is not valid.";
      throw new ApiFailure("INVALID_INPUT", message, zodDetails(parsed.error));
    }
    const { profile, roleId } = parsed.data;

    const [roles, knownSkillIds] = await Promise.all([deps.loadRoles(), deps.loadKnownSkillIds()]);
    const role = roles.find((r) => r.roleId === roleId);
    if (!role) {
      throw new ApiFailure("NOT_FOUND", `There is no role "${roleId}".`);
    }
    // The pathway is for roleId; the preferred route is not used here, so it is not checked.
    const unknown = findUnknownIds(profile, knownSkillIds, null);
    if (unknown.length > 0) {
      throw new ApiFailure("INVALID_INPUT", "The profile uses skill IDs we do not know.", unknown);
    }

    // Trend evidence is optional: if it cannot be read, use base weights.
    let evidence: EvidenceInput[] | null;
    try {
      evidence = await deps.loadEvidence();
    } catch (err) {
      console.error("Trend evidence read failed:", err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
      evidence = null;
    }

    const resources = await deps.loadResources(role.skills.map((s) => s.skillId));

    // Check our own output against the contract before sending it.
    res.json(PathwayResponse.parse(buildPathway(profile, role, resources, evidence)));
  });

  return router;
}
