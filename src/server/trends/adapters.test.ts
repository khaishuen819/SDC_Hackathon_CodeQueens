import test from "node:test";
import assert from "node:assert/strict";
import { toCitationOnlyEvidence, toCountRoleInputs } from "./adapters.ts";
import { matchRoles } from "../matching/matchEngine.ts";
import { buildPathway } from "../pathway/pathwayEngine.ts";
import { bundle, profile } from "./testFixtures.ts";

for (const [confirmedCount, total, expected] of [[7, 10, 70], [7, 11, 64], [8, 11, 73], [0, 10, 0]] as const) {
  test(`one-point coverage ${confirmedCount}/${total} = ${expected}`, () => {
    const b = bundle(total), roles = toCountRoleInputs(b);
    const p = profile(b.capabilities.slice(0, confirmedCount).map((c) => c.skillId));
    assert.equal(matchRoles(p, roles, []).roles[0].score, expected);
    assert.ok(roles.every((r) => r.skills.every((s) => s.weight === 1)));
    assert.equal(matchRoles(p, roles, []).roles.find((r) => r.roleId === "qa-automation")?.preferredRouteKept, true);
  });
}

test("confirmed additions are monotonic, unrelated skills are neutral and proficiency gives no bonus", () => {
  const b = bundle(), roles = toCountRoleInputs(b);
  const p = profile(["api-basics"]);
  const score = (value: ReturnType<typeof profile>) => matchRoles(value, roles, []).roles[0].score;
  assert.equal(score(p), 10);
  assert.equal(score({ ...p, confirmedSkills: [...p.confirmedSkills, { skillId: "unrelated-extra" }] }), 10);
  assert.equal(score(profile(["api-basics", "fixture-skill-1"])), 20);
  assert.equal(score({ ...p, confirmedSkills: [{ skillId: "api-basics", level: "advanced" }] }), 10);
});

test("Not sure and omitted skills receive zero credit without blocking pathways", () => {
  const b = bundle(2), roles = toCountRoleInputs(b);
  const p = { ...profile(["api-basics"]), unconfirmedSkillIds: ["fixture-skill-1"] };
  assert.equal(matchRoles(p, roles, []).roles[0].score, 50);
  const citations = toCitationOnlyEvidence(b);
  assert.ok(citations.every((e) => e.priorityAdjustment === null && e.direction === "neutral"));
  const pathway = buildPathway(p, roles[0], b.resources, citations);
  assert.equal(pathway.steps.length, 1);
  assert.equal(pathway.steps[0].skillId, "fixture-skill-1");
  assert.ok(pathway.steps[0].evidence?.some((e) => e.evidenceId === "fictional-evidence"));
});

test("malformed legacy weights or numerical adjustments cannot leak through bundle adapters", () => {
  const b: any = bundle(); b.roles[0].skills[0].weight = 3;
  assert.throws(() => toCountRoleInputs(b));
  const evidence: any = bundle(); evidence.evidence[0].priorityAdjustment = -0.5;
  assert.throws(() => toCitationOnlyEvidence(evidence));
});
