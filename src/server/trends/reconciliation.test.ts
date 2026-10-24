import test from "node:test";
import assert from "node:assert/strict";
import { reconcileCriteria, CriteriaReconciliationError } from "./reconciliation.ts";
import { criteriaSnapshotId } from "./identity.ts";
import { toCountRoleInputs } from "./adapters.ts";
import { matchRoles } from "../matching/matchEngine.ts";
import { bundle, profile } from "./testFixtures.ts";
import type { CriteriaReview } from "../contracts/criteria.ts";

const score = (p: ReturnType<typeof profile>, b: ReturnType<typeof bundle>) => matchRoles(p, toCountRoleInputs(b), []).roles[0].score;

test("first CV omission is ready at50%, with optional guidance and no fabricated absence", () => {
  const b = bundle(2), id = criteriaSnapshotId(b), p = profile(["api-basics"]);
  const result = reconcileCriteria(p, b, b, { fromSnapshotId: id, targetSnapshotId: id, answers: [] });
  assert.equal(result.status, "ready");
  assert.equal(score(result.profile, b), 50);
  assert.equal(result.review.questions[0].skillId, "fixture-skill-1");
  assert.equal(result.review.questions[0].state, "unanswered");
  assert.deepEqual(result.profile.unconfirmedSkillIds, []);
  assert.deepEqual(result.profile.removedSkillIds, []);
  assert.equal(result.profile.preferredRouteId, "qa-automation");
  assert.equal(result.profile.confirmedAt, p.confirmedAt);
});

test("Not sure and Not yet both allow50% coverage while keeping different states", () => {
  const b = bundle(2), targetSnapshotId = criteriaSnapshotId(b), p = profile(["api-basics"]);
  const unsure = reconcileCriteria(p, null, b, { targetSnapshotId, answers: [{ skillId: "fixture-skill-1", answer: "not-sure" }] });
  const notYet = reconcileCriteria(p, null, b, { targetSnapshotId, answers: [{ skillId: "fixture-skill-1", answer: "not-yet" }] });
  assert.equal(score(unsure.profile, b), 50); assert.equal(score(notYet.profile, b), 50);
  assert.deepEqual(unsure.profile.unconfirmedSkillIds, ["fixture-skill-1"]);
  assert.equal(unsure.review.questions[0].state, "not-sure");
  assert.deepEqual(notYet.profile.unconfirmedSkillIds, []);
  assert.deepEqual(notYet.profile.removedSkillIds, []);
  assert.deepEqual(notYet.review.questions, []);
});

test("later I already have this updates possession and coverage without CV reupload", () => {
  const b = bundle(2), id = criteriaSnapshotId(b);
  const p = { ...profile(["api-basics"]), unconfirmedSkillIds: ["fixture-skill-1"] };
  const before = structuredClone(p);
  const result = reconcileCriteria(p, null, b, { targetSnapshotId: id, answers: [{ skillId: "fixture-skill-1", answer: "have" }] });
  assert.equal(score(result.profile, b), 100);
  assert.deepEqual(result.profile.addedSkillIds, ["fixture-skill-1"]);
  assert.deepEqual(result.profile.unconfirmedSkillIds, []);
  assert.deepEqual(result.review.questions, []);
  assert.deepEqual(p, before);
});

test("have clears removed state and preserves the added subset rule", () => {
  const b = bundle(2), id = criteriaSnapshotId(b);
  const p = { ...profile([]), removedSkillIds: ["api-basics"] };
  const result = reconcileCriteria(p, null, b, { targetSnapshotId: id, answers: [{ skillId: "api-basics", answer: "have" }] });
  assert.deepEqual(result.profile.removedSkillIds, []);
  assert.deepEqual(result.profile.addedSkillIds, ["api-basics"]);
  assert.ok(result.profile.addedSkillIds.every((id) => result.profile.confirmedSkills.some((s) => s.skillId === id)));
});

test("already confirmed skills are not asked again and existing added membership survives", () => {
  const b = bundle(2), id = criteriaSnapshotId(b);
  const p = { ...profile(["api-basics"]), addedSkillIds: ["api-basics"] };
  const result = reconcileCriteria(p, null, b, { targetSnapshotId: id, answers: [{ skillId: "api-basics", answer: "have" }] });
  assert.equal(result.review.questions.some((q) => q.skillId === "api-basics"), false);
  assert.deepEqual(result.profile.addedSkillIds, ["api-basics"]);
});

test("explicit Not yet can correct possession without pretending CV extraction was wrong", () => {
  const b = bundle(2), id = criteriaSnapshotId(b);
  const p = { ...profile(["api-basics"]), addedSkillIds: ["api-basics"] };
  const result = reconcileCriteria(p, null, b, { targetSnapshotId: id, answers: [{ skillId: "api-basics", answer: "not-yet" }] });
  assert.deepEqual(result.profile.confirmedSkills, []);
  assert.deepEqual(result.profile.addedSkillIds, []);
  assert.deepEqual(result.profile.removedSkillIds, []);
});

test("changed criteria update7/10 to7/11 without blocking for an answer", () => {
  const from = bundle(10), target = bundle(11), p = profile(from.capabilities.slice(0, 7).map((c) => c.skillId));
  const review = { fromSnapshotId: criteriaSnapshotId(from), targetSnapshotId: criteriaSnapshotId(target), answers: [] };
  const result = reconcileCriteria(p, from, target, review);
  assert.equal(score(p, from), 70); assert.equal(score(result.profile, target), 64);
  assert.ok(result.review.questions.some((q) => q.skillId === "fixture-skill-10"));
  const known = reconcileCriteria(result.profile, from, target, { ...review, answers: [{ skillId: "fixture-skill-10", answer: "have" }] });
  assert.equal(score(known.profile, target), 73);
});

test("retired recognised skills remain in possession without counting or prompting", () => {
  const from = bundle(2), target = structuredClone(from), p = profile(["fixture-skill-1"]);
  target.roles.forEach((r) => { r.skills = r.skills.filter((s) => s.skillId !== "fixture-skill-1"); });
  target.criteriaDecisions.forEach((d) => { if (d.skillId === "fixture-skill-1") d.action = "retire"; });
  const result = reconcileCriteria(p, from, target);
  assert.deepEqual(result.profile.confirmedSkills, [{ skillId: "fixture-skill-1" }]);
  assert.equal(score(result.profile, target), 0);
  assert.equal(result.review.questions.some((q) => q.skillId === "fixture-skill-1"), false);
});

test("missing answers are allowed; conflicting/unknown answers and malformed profiles are not", () => {
  const b = bundle(2), id = criteriaSnapshotId(b), p = profile([]);
  assert.equal(reconcileCriteria(p, null, b).status, "ready");
  assert.equal(reconcileCriteria(p, null, b, { targetSnapshotId: id }).status, "ready");
  const bad = { targetSnapshotId: id, answers: [{ skillId: "api-basics", answer: "have" }, { skillId: "api-basics", answer: "not-yet" }] };
  assert.throws(() => reconcileCriteria(p, null, b, bad as CriteriaReview));
  assert.throws(() => reconcileCriteria(p, null, b, { targetSnapshotId: id, answers: [{ skillId: "made-up", answer: "have" }] }));
  assert.throws(() => reconcileCriteria(profile(["made-up"]), null, b));
  assert.throws(() => reconcileCriteria({ ...profile(["api-basics"]), unconfirmedSkillIds: ["api-basics"] }, null, b));
});

test("only genuine mismatched context causes a context error", () => {
  const b = bundle(2), id = criteriaSnapshotId(b);
  assert.throws(() => reconcileCriteria(profile([]), null, b, { targetSnapshotId: `criteria-${"b".repeat(64)}`, answers: [] }),
    (e: unknown) => e instanceof CriteriaReconciliationError && e.code === "CRITERIA_CONTEXT_REQUIRED");
  assert.throws(() => reconcileCriteria(profile([]), null, b, { targetSnapshotId: id, fromSnapshotId: `criteria-${"b".repeat(64)}`, answers: [] }));
  assert.equal(reconcileCriteria(profile([]), null, b, { targetSnapshotId: id, fromSnapshotId: id, answers: [] }).status, "ready");
});

test("learning choices cannot be possession answers or grant score credit", () => {
  const b = bundle(2), id = criteriaSnapshotId(b), p = profile(["api-basics"]);
  for (const choice of ["add-to-plan", "not-now"]) {
    assert.throws(() => reconcileCriteria(p, null, b, { targetSnapshotId: id, answers: [{ skillId: "fixture-skill-1", answer: choice }] } as CriteriaReview));
  }
  assert.equal(score(reconcileCriteria(p, null, b).profile, b), 50);
});
