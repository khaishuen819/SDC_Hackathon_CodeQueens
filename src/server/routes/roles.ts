import { Router } from "express";
import { VersionedRolesResponse } from "../contracts/roles.ts";
import { readSnapshotQuery } from "../trends/context.ts";
import type { CriteriaContextLoader } from "../trends/context.ts";

export function createRolesRouter(deps: { loadContext: CriteriaContextLoader }) {
  const router = Router();
  router.get("/api/roles", async (req, res) => {
    const { snapshot, meta } = await deps.loadContext(readSnapshotQuery(req.query));
    const names = new Map(snapshot.bundle.capabilities.map((c) => [c.skillId, c.name]));
    res.json(VersionedRolesResponse.parse({ isPlaceholder: false, criteria: meta,
      recognisedSkills: snapshot.bundle.capabilities.map((c) => ({ skillId: c.skillId, name: c.name })),
      roles: snapshot.bundle.roles.map((r) => ({ ...r, skills: r.skills.map((s) => ({ ...s, name: names.get(s.skillId)! })) })),
    }));
  });
  return router;
}
