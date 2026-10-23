import { Router } from "express";
import { rolesRouter } from "./roles.ts";

// All /api routes. server.ts mounts this once; new routes are added here,
// so server.ts does not need to change again.
export const apiRouter = Router();

apiRouter.use(rolesRouter);
