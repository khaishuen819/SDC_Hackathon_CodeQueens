import { Router } from "express";
import { VersionedEvidenceListResponse } from "../contracts/evidence.ts";
import { VersionedSdgResponse } from "../contracts/sdg.ts";
import { readSnapshotQuery } from "../trends/context.ts";
import type { CriteriaContextLoader } from "../trends/context.ts";

export type ReferenceRouteDeps = { loadContext: CriteriaContextLoader };
export function createReferenceRouter(deps: ReferenceRouteDeps) {
  const router = Router();
  router.get("/api/sdg", async (req, res) => {
    const { snapshot, meta } = await deps.loadContext(readSnapshotQuery(req.query));
    res.json(VersionedSdgResponse.parse({ ...snapshot.bundle.sdg, criteria: meta }));
  });
  router.get("/api/evidence", async (req, res) => {
    const { snapshot, meta } = await deps.loadContext(readSnapshotQuery(req.query));
    res.json(VersionedEvidenceListResponse.parse({ items: snapshot.bundle.evidence, criteria: meta }));
  });
  return router;
}
