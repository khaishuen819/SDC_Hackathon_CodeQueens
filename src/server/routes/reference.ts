import { Router } from "express";
import { EvidenceListResponse, SdgResponse } from "../contracts/index.ts";

// What these routes need. Passed in (not imported) so tests run with no database.
export type ReferenceRouteDeps = {
  loadSdg: () => Promise<SdgResponse>;
  loadEvidenceList: () => Promise<EvidenceListResponse>;
};

export function createReferenceRouter(deps: ReferenceRouteDeps) {
  const router = Router();

  // GET /api/sdg: the 17 UN goals, plus role and skill SDG tags (each with isPlaceholder).
  router.get("/api/sdg", async (_req, res) => {
    // Check our own output against the contract before sending it.
    res.json(SdgResponse.parse(await deps.loadSdg()));
  });

  // GET /api/evidence: reviewed trend evidence only. Empty items when there is none yet.
  router.get("/api/evidence", async (_req, res) => {
    res.json(EvidenceListResponse.parse(await deps.loadEvidenceList()));
  });

  return router;
}
