import test from "node:test";
import assert from "node:assert/strict";
import { presentMatch, presentPathway } from "./presentation.ts";
import { reconcileCriteria } from "./reconciliation.ts";
import { bundle, profile } from "./testFixtures.ts";
import { criteriaHarness } from "../routes/criteriaTestSupport.ts";

test("one-point presentation gives 50 percent for an omitted or unsure skill, then 100 after explicit confirmation", async () => {
  const h = await criteriaHarness(), ctx = await h.loadContext();
  for (const unsure of [false, true]) {
    const p = { ...profile(["api-basics"]), unconfirmedSkillIds: unsure ? ["fixture-skill-1"] : [] };
    const ready = reconcileCriteria(p, null, ctx.snapshot.bundle);
    const response = presentMatch(ready.profile, ctx, ready.review);
    assert.deepEqual(response.roles.map((r) => r.score), [50, 50]);
    assert.match(response.roles[0].scoreExplanation, /1 of 2/);
    assert.doesNotMatch(response.roles[0].scoreExplanation, /weight|lost ability/i);
    assert.deepEqual(response.roles[0].evidence, [{ evidenceId: "fictional-evidence" }]);
    const path = presentPathway(ready.profile, "qa-automation", ctx, ready.review);
    assert.equal(path.steps[0].skillId, "fixture-skill-1");
    assert.equal(path.steps[0].possessionState, "unconfirmed");
    assert.equal(path.steps[0].estimateBasis, "app");
    const later = reconcileCriteria(p, null, ctx.snapshot.bundle, { targetSnapshotId: h.id, answers: [{ skillId: "fixture-skill-1", answer: "have" }] });
    assert.equal(presentMatch(later.profile, ctx, later.review).roles[0].score, 100);
    assert.equal(presentPathway(later.profile, "qa-automation", ctx, later.review).steps.length, 0);
  }
});

test("criterion changes explain the changed comparison without penalising unrelated skills or preferences", async () => {
  const h = await criteriaHarness(bundle(10)), old = await h.store.readSnapshot(h.id);
  const p = profile(["api-basics", ...Array.from({ length: 6 }, (_, n) => `fixture-skill-${n + 1}`)]);
  await h.publish(bundle(11));
  const ctx = await h.loadContext(), ready = reconcileCriteria(p, old!.bundle, ctx.snapshot.bundle, { fromSnapshotId: h.id, targetSnapshotId: ctx.snapshot.id });
  const response = presentMatch(ready.profile, ctx, ready.review, old);
  assert.equal(response.roles[0].score, 64);
  assert.match(response.roles[0].scoreExplanation, /10 to 11/);
  assert.match(response.roles[0].scoreExplanation, /fictional-evidence/);
  assert.equal(response.roles.find((r) => r.roleId === "qa-automation")?.preferredRouteKept, true);
  assert.ok(response.roles.flatMap((r) => [...r.strengths, ...r.gaps, ...r.unconfirmedSkills]).every((s) => s.weight === 1 && !s.evidenceAdjustments?.length));
});

test("pathways expand unconfirmed prerequisites without adding them to the score denominator", async () => {
  const b = bundle(3);
  // A retained capability may be needed as preparation even outside current role scoring.
  for (const role of b.roles) role.skills = role.skills.filter((s) => s.skillId !== "api-basics");
  for (const decision of b.criteriaDecisions) if (decision.skillId === "api-basics") decision.action = "retire";
  b.capabilities[1].prerequisiteSkillIds = ["api-basics"];
  b.prerequisiteEdges = [{ skillId: "fixture-skill-1", prerequisiteSkillId: "api-basics" }];
  b.roles[1].skills[1].isRequired = false;
  const h = await criteriaHarness(b), ctx = await h.loadContext();
  const ready = reconcileCriteria(profile(), null, b, { targetSnapshotId: h.id, answers: [{ skillId: "fixture-skill-1", answer: "not-yet" }] });
  const result = presentPathway(ready.profile, "qa-automation", ctx, ready.review, [{ skillId: "fixture-skill-1", answer: "not-yet" }]);
  assert.deepEqual(result.steps.map((s) => s.skillId), ["api-basics", "fixture-skill-1", "fixture-skill-2"]);
  assert.deepEqual(result.steps[1].prerequisites, ["api-basics"]);
  assert.equal(result.steps[0].isPrerequisite, true);
  assert.equal(result.steps[1].possessionState, "not-yet");
  assert.match(result.steps[0].why, /prerequisite/i);
  assert.equal(presentMatch(ready.profile, ctx, ready.review).roles[0].gaps.length, 2);
  assert.deepEqual(result.steps.map((s) => s.order), [1, 2, 3]);
});

test("a shrinking denominator explains and cites the retirement correction, not just remaining admissions", async () => {
  const h = await criteriaHarness(bundle(3)), before = await h.store.readSnapshot(h.id);
  const next = bundle(3);
  next.evidence.push({ ...next.evidence[0], id: "retirement-correction", title: "FICTIONAL correction",
    supportedClaim: "The fictional criterion duplicates another practice.", linkedSkillIds: ["fixture-skill-2"] });
  next.capabilities[2].evidenceIds.push("retirement-correction");
  for (const role of next.roles) role.skills = role.skills.filter((s) => s.skillId !== "fixture-skill-2");
  for (const d of next.criteriaDecisions) if (d.skillId === "fixture-skill-2") {
    d.action = "retire"; d.reason = "FICTIONAL correction: this criterion overlaps an existing practice."; d.evidenceIds = ["retirement-correction"];
  }
  await h.publish(next);
  const ctx = await h.loadContext(), ready = reconcileCriteria(profile(["api-basics"]), before!.bundle, ctx.snapshot.bundle, { fromSnapshotId: h.id, targetSnapshotId: ctx.snapshot.id });
  const response = presentMatch(ready.profile, ctx, ready.review, before);
  assert.equal(response.roles[0].score, 50);
  assert.match(response.roles[0].scoreExplanation, /retirement-correction/);
  assert.match(response.roles[0].scoreExplanation, /overlaps an existing practice/);
  assert.ok(response.roles[0].evidence?.some((e) => e.evidenceId === "retirement-correction"));
});
