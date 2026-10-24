import test from "node:test";
import assert from "node:assert/strict";
import { VersionedMatchResponse } from "../contracts/match.ts";
import { createMatchRouter } from "./match.ts";
import { startApp, request, criteriaHarness } from "./criteriaTestSupport.ts";
import { bundle, profile } from "../trends/testFixtures.ts";

test("first intake returns 50 for omission, Not sure and Not yet; explicit Have gives 100", async () => {
  const h = await criteriaHarness(), base = await startApp(createMatchRouter(h));
  for (const state of ["omitted", "not-sure", "not-yet"] as const) {
    const result = await request(base, "/api/match", { ...profile(["api-basics"]), criteriaReview: { fromSnapshotId: h.id, targetSnapshotId: h.id,
      answers: state === "omitted" ? [] : [{ skillId: "fixture-skill-1", answer: state }] } });
    assert.equal(result.status, 200);
    const response = VersionedMatchResponse.parse(result.body);
    assert.deepEqual(response.roles.map((r) => r.score), [50, 50]);
    assert.equal(response.criteria.snapshotId, h.id);
    assert.equal(response.review.questions.length, state === "not-yet" ? 0 : 1);
  }
  const later = await request(base, "/api/match", { ...profile(["api-basics"]), snapshotId: h.id,
    criteriaReview: { targetSnapshotId: h.id, answers: [{ skillId: "fixture-skill-1", answer: "have" }] } });
  assert.deepEqual(VersionedMatchResponse.parse(later.body).roles.map((r) => r.score), [100, 100]);
});

test("matching validates confirmed profiles and returns real context errors with reload guidance", async () => {
  const h = await criteriaHarness(), base = await startApp(createMatchRouter(h));
  for (const bad of [{ ...profile(), status: "draft", snapshotId: h.id }, { ...profile(["unknown-skill"]), snapshotId: h.id },
    { ...profile(["api-basics", "api-basics"]), snapshotId: h.id }, { ...profile(), preferredRouteId: "unknown-role", snapshotId: h.id },
    { ...profile(), snapshotId: "invalid" }]) assert.equal((await request(base, "/api/match", bad)).status, 400);
  const missing = await request(base, "/api/match", profile(["api-basics"]));
  assert.equal(missing.status, 409); assert.equal(missing.body.review.targetSnapshotId, h.id);
  const mismatched = await request(base, "/api/match", { ...profile(["api-basics"]), snapshotId: h.id,
    criteriaReview: { targetSnapshotId: `criteria-${"f".repeat(64)}` } });
  assert.equal(mismatched.status, 409); assert.equal(mismatched.body.review.targetSnapshotId, h.id);
  const unknown = await request(base, "/api/match", { ...profile(), snapshotId: `criteria-${"f".repeat(64)}` });
  assert.equal(unknown.status, 409); assert.equal(unknown.body.error.code, "CRITERIA_UNAVAILABLE");
  const invalid = await fetch(`${base}/api/match`, { method: "POST", headers: { "content-type": "application/json" }, body: "{" });
  assert.equal(invalid.status, 400);
});

test("old and new matching stay pinned; client weights, proficiency and historical extras have no bonus or penalty", async () => {
  const h = await criteriaHarness(bundle(3)), next = bundle(3);
  for (const r of next.roles) r.skills = r.skills.filter((s) => s.skillId !== "fixture-skill-2");
  for (const d of next.criteriaDecisions) if (d.skillId === "fixture-skill-2") d.action = "retire";
  const current = await h.publish(next), base = await startApp(createMatchRouter(h));
  const p = { ...profile(["api-basics", "fixture-skill-2"]), confirmedSkills: [{ skillId: "api-basics", level: "advanced" }, { skillId: "fixture-skill-2" }] };
  const old = await request(base, "/api/match", { ...p, snapshotId: h.id });
  assert.deepEqual(old.body.roles.map((r: any) => r.score), [67, 67]);
  const updated = await request(base, "/api/match", { ...p, snapshotId: current, weights: [3, -0.5], priorityAdjustment: 0.5,
    criteriaReview: { fromSnapshotId: h.id, targetSnapshotId: current } });
  assert.equal(updated.status, 200); assert.deepEqual(updated.body.roles.map((r: any) => r.score), [50, 50]);
  assert.ok(updated.body.roles.every((r: any) => r.evidence.length > 0));
  assert.equal(updated.body.roles.find((r: any) => r.roleId === "qa-automation").preferredRouteKept, true);
});
