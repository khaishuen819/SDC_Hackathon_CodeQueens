import test from "node:test";
import assert from "node:assert/strict";
import { Router } from "express";
import { ApiError } from "../contracts/errors.ts";
import { ApiFailure } from "./errors.ts";
import { startApp, request } from "./criteriaTestSupport.ts";

const review = { targetSnapshotId: `criteria-${"a".repeat(64)}`, questions: [{
  skillId: "api-basics", name: "API basics", roleIds: ["backend-development"], why: "Optional confirmation.",
  evidenceIds: ["fictional-evidence"], state: "unanswered" as const,
}] };

test("409 context errors preserve validated target and optional questions through middleware", async () => {
  const router = Router();
  router.get("/context", () => { throw new ApiFailure("CRITERIA_CONTEXT_REQUIRED", "Reload the catalogue.", undefined, review); });
  const result = await request(await startApp(router), "/context");
  assert.equal(result.status, 409);
  assert.deepEqual(ApiError.parse(result.body).review, review);
});

test("ordinary errors keep their original response shape and never carry review data", async () => {
  const router = Router();
  router.get("/invalid", () => { throw new ApiFailure("INVALID_INPUT", "Bad input.", [{ path: "skill", message: "Unknown." }]); });
  const result = await request(await startApp(router), "/invalid");
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: { code: "INVALID_INPUT", message: "Bad input.", details: [{ path: "skill", message: "Unknown." }] } });
  assert.throws(() => new ApiFailure("INVALID_INPUT", "Bad input.", undefined, review));
  assert.throws(() => new ApiFailure("CRITERIA_CONTEXT_REQUIRED", "Missing review."));
  assert.throws(() => new ApiFailure("CRITERIA_CONTEXT_REQUIRED", "Private review.", undefined, { ...review, cv: "private" } as any));
});
