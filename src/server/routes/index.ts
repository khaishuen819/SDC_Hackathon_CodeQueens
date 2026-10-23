import "../env.ts";
import { Router } from "express";
import { prisma } from "../db/client.ts";
import { createLlmAdapter } from "../extraction/llmAdapter.ts";
import { errorHandler, notFoundHandler } from "./errors.ts";
import { createProfileRouter } from "./profile.ts";
import { rolesRouter } from "./roles.ts";

// All /api routes. server.ts mounts this once; new routes are added here,
// so server.ts does not need to change again.
export const apiRouter = Router();

apiRouter.use(rolesRouter);

const adapter = createLlmAdapter(); // stops start-up if LLM settings are wrong
console.log(`CV extraction provider: ${adapter.name}`);

apiRouter.use(
  createProfileRouter({
    adapter,
    // The skill catalogue from the database, so the model maps to our skillIds.
    loadCatalogue: () => prisma.skill.findMany({ select: { id: true, name: true }, orderBy: { id: "asc" } }),
  }),
);

// Unknown /api paths get a JSON 404. Any error becomes our standard error shape.
apiRouter.use("/api", notFoundHandler);
apiRouter.use(errorHandler);
