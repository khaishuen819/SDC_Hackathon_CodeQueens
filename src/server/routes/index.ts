import "../env.ts";
import { prisma } from "../db/client.ts";
import { createLlmAdapter } from "../extraction/llmAdapter.ts";
import { loadPilotBaseline } from "../trends/bootstrap.ts";
import { pilotConfig } from "../trends/pilotConfig.ts";
import { PrismaCriteriaStore } from "../trends/snapshotStore.ts";
import { trendInterpreterFromEnv } from "../trends/interpreter.ts";
import { createCriteriaApiRouter } from "./criteriaApi.ts";

// Validate public inputs/configuration at startup, without reading or seeding
// a database head. Migration and baseline bootstrap are explicit release steps.
const { reference } = await loadPilotBaseline();
const trend = trendInterpreterFromEnv();
const adapter = createLlmAdapter();
console.log(`CV extraction provider: ${adapter.name}; trend interpretation: ${trend.provider}`);
export const apiRouter = createCriteriaApiRouter({ store: new PrismaCriteriaStore(prisma), reference, config: pilotConfig,
  fetcher: fetch, interpreter: trend.provider === "gemini" ? trend.interpreter : null, adapter });
