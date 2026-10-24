import test from "node:test";
import assert from "node:assert/strict";
import { VersionedPathwayResponse } from "../contracts/pathway.ts";
import { createPathwayRouter } from "./pathway.ts";
import { startApp, request, criteriaHarness } from "./criteriaTestSupport.ts";
import { bundle, profile } from "../trends/testFixtures.ts";

test("pathways offer omitted and unsure skills immediately and remove them after explicit Have", async () => {
  const h = await criteriaHarness(), base = await startApp(createPathwayRouter(h));
  for (const answer of [undefined, "not-sure", "not-yet"] as const) {
    const result = await request(base, "/api/pathway", { profile: profile(["api-basics"]), roleId: "qa-automation", criteriaReview: {
      fromSnapshotId: h.id, targetSnapshotId: h.id, answers: answer ? [{ skillId: "fixture-skill-1", answer }] : [] } });
    assert.equal(result.status, 200);
    const response = VersionedPathwayResponse.parse(result.body), step = response.steps[0];
    assert.deepEqual(response.steps.map((s) => s.skillId), ["fixture-skill-1"]);
    assert.equal(step.possessionState, answer === "not-yet" ? "not-yet" : "unconfirmed");
    assert.equal(step.estimatedHours, 1); assert.equal(step.estimateBasis, "app");
    assert.equal(step.resources[0].isPlaceholder, false); assert.deepEqual(step.evidence, [{ evidenceId: "fictional-evidence" }]);
  }
  const later = await request(base, "/api/pathway", { profile: profile(["api-basics"]), roleId: "qa-automation", snapshotId: h.id,
    criteriaReview: { targetSnapshotId: h.id, answers: [{ skillId: "fixture-skill-1", answer: "have" }] } });
  assert.deepEqual(later.body.steps, []);
});

test("pathways preserve the requested route and validate profile, role and version inputs", async () => {
  const h = await criteriaHarness(), base = await startApp(createPathwayRouter(h)), good = { profile: profile(), roleId: "backend-development", snapshotId: h.id };
  assert.equal((await request(base, "/api/pathway", good)).body.roleId, "backend-development");
  for (const bad of [{ ...good, profile: { ...profile(), status: "draft" } }, { ...good, profile: profile(["unknown-skill"]) }, { ...good, snapshotId: "bad" }]) {
    assert.equal((await request(base, "/api/pathway", bad)).status, 400);
  }
  assert.equal((await request(base, "/api/pathway", { ...good, roleId: "unknown-role" })).status, 404);
  const missing = await request(base, "/api/pathway", { profile: profile(), roleId: "qa-automation" });
  assert.equal(missing.status, 409); assert.equal(missing.body.review.targetSnapshotId, h.id);
});

test("a retained pinned pathway keeps its resources when the current version changes", async () => {
  const h = await criteriaHarness(), base = await startApp(createPathwayRouter(h));
  await h.publish(bundle(3));
  const result = await request(base, "/api/pathway", { profile: profile(["api-basics"]), roleId: "qa-automation", snapshotId: h.id });
  assert.equal(result.status, 200); assert.equal(result.body.criteria.snapshotId, h.id);
  assert.deepEqual(result.body.steps.map((s: any) => s.skillId), ["fixture-skill-1"]);
});
