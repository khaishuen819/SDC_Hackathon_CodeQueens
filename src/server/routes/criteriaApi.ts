import { Router } from "express";
import type { HttpFetcher, PilotConfig, RoleReference } from "../contracts/trends.ts";
import type { LlmAdapter } from "../extraction/llmAdapter.ts";
import type { CriteriaStore } from "../trends/snapshotStore.ts";
import type { TrendInterpreter } from "../trends/interpreter.ts";
import { createRefreshService } from "../trends/refreshService.ts";
import { createCriteriaContextLoader, prepareCriteriaRequest } from "../trends/context.ts";
import { createRolesRouter } from "./roles.ts";
import { createProfileRouter } from "./profile.ts";
import { createMatchRouter } from "./match.ts";
import { createPathwayRouter } from "./pathway.ts";
import { createReferenceRouter } from "./reference.ts";
import { createTrendsRouter } from "./trends.ts";
import { errorHandler, notFoundHandler } from "./errors.ts";

// Composition is injected so full HTTP tests do not initialise real database
// clients, credentials or model adapters. Production constructs these in index.ts.
export function createCriteriaApiRouter(deps: {
  store: CriteriaStore; reference: RoleReference; config: PilotConfig; fetcher: HttpFetcher;
  interpreter: TrendInterpreter | null; adapter: LlmAdapter; now?: () => string;
}) {
  const router = Router();
  const loadContext = createCriteriaContextLoader({ store: deps.store, disabled: !deps.interpreter,
    ...(deps.now ? { now: () => Date.parse(deps.now!()) } : {}) });
  const readers = { loadContext, loadSnapshot: deps.store.readSnapshot.bind(deps.store) };
  const service = createRefreshService(deps);
  router.use(createTrendsRouter({ ...service, reconcile: async (profile, review) => {
    const ready = await prepareCriteriaRequest(profile, { criteriaReview: review }, readers);
    return { ...ready.result, criteria: ready.context.meta };
  } }));
  router.use(createRolesRouter(readers));
  router.use(createProfileRouter({ adapter: deps.adapter, loadCatalogue: async () => {
    const { snapshot } = await loadContext();
    return snapshot.bundle.capabilities.map((c) => ({ id: c.skillId, name: c.name })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  } }));
  router.use(createMatchRouter(readers));
  router.use(createPathwayRouter(readers));
  router.use(createReferenceRouter(readers));
  router.use("/api", notFoundHandler);
  router.use(errorHandler);
  return router;
}
