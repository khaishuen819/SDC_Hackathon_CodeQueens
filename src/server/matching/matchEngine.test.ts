// Tests for the pure match engine. No database: roles and evidence are passed in.
// Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { MatchResponse, type ConfirmedProfile } from "../contracts/index.ts";
import { exampleConfirmedProfile, exampleMatchResponse } from "../contracts/examples.ts";
import { exampleEvidence, exampleRoles, skill } from "./exampleInputs.ts";
import { matchRoles, type EvidenceInput, type RoleInput } from "./matchEngine.ts";

// The ILLUSTRATIVE inputs behind exampleMatchResponse (not the database seed).
const roles = exampleRoles;

const profile: ConfirmedProfile = exampleConfirmedProfile;
const byId = (response: MatchResponse, roleId: string) => {
  const role = response.roles.find((r) => r.roleId === roleId);
  assert.ok(role, `role ${roleId} missing`);
  return role;
};
const ids = (list: Array<{ skillId: string }>) => list.map((s) => s.skillId);

// (a) and (h)
test("the example profile gives exactly the example match response", () => {
  const response = matchRoles(profile, roles, exampleEvidence);
  assert.deepEqual(response, exampleMatchResponse);
  MatchResponse.parse(response); // (h)
});

test("score maths without evidence: 14/18 = 78 and 10/15 = 67", () => {
  const response = matchRoles(profile, roles, []);
  assert.equal(byId(response, "backend-development").score, 78);
  assert.equal(byId(response, "qa-automation").score, 67);
  assert.match(byId(response, "qa-automation").scoreExplanation, /10 \/ 15 x 100 = 67 \(rounded\)/);
});

// (b)
test("a confirmed profile with no skills scores 0 everywhere, without crashing", () => {
  const empty = { ...profile, confirmedSkills: [], addedSkillIds: [], unconfirmedSkillIds: [] };
  const response = matchRoles(empty, roles, []);
  for (const role of response.roles) {
    assert.equal(role.score, 0);
    assert.equal(role.strengths.length, 0);
    assert.match(role.scoreExplanation, /no confirmed skills yet, so the score is 0/);
  }
  MatchResponse.parse(response);
});

// (c)
test("the preferred route ranks lower by score but keeps preferredRouteKept", () => {
  const response = matchRoles(profile, roles, []);
  assert.deepEqual(response.roles.map((r) => r.roleId), ["backend-development", "qa-automation"]);
  const qa = byId(response, "qa-automation");
  assert.equal(qa.rank, 2);
  assert.equal(qa.preferredRouteKept, true);
  assert.equal(byId(response, "backend-development").preferredRouteKept, false);
  assert.match(qa.scoreExplanation, /This is your preferred route, so it stays your route/);
});

test("ties are broken by role id, and exploring graduates have no preferred route", () => {
  const exploring = { ...profile, entryPath: "exploring" as const, preferredRouteId: undefined };
  const twins: RoleInput[] = [
    { roleId: "zz-role", name: "Z", isPlaceholder: false, skills: [skill("git", 1, false, false)] },
    { roleId: "aa-role", name: "A", isPlaceholder: false, skills: [skill("git", 1, false, false)] },
  ];
  const response = matchRoles(exploring, twins, []);
  assert.deepEqual(response.roles.map((r) => r.roleId), ["aa-role", "zz-role"]);
  assert.ok(response.roles.every((r) => !r.preferredRouteKept));
});

// (d)
test("an unconfirmed skill is not counted and is not a gap", () => {
  const backend = byId(matchRoles(profile, roles, []), "backend-development");
  assert.deepEqual(ids(backend.unconfirmedSkills), ["docker"]);
  assert.ok(!ids(backend.gaps).includes("docker"));
  assert.ok(!ids(backend.strengths).includes("docker"));
  assert.match(backend.scoreExplanation, /Not counted \(you marked as not sure\): Docker/);
});

// (e)
test("a removed skill is a gap", () => {
  const removedSql = {
    ...profile,
    confirmedSkills: profile.confirmedSkills.filter((s) => s.skillId !== "sql"),
    removedSkillIds: [...profile.removedSkillIds, "sql"],
  };
  const backend = byId(matchRoles(removedSql, roles, []), "backend-development");
  assert.ok(ids(backend.gaps).includes("sql"));
  assert.match(backend.scoreExplanation, /not on your confirmed profile\): .*SQL \(weight 3, required\)/);
});

test("explanations never say 'missing' or 'you lack'", () => {
  for (const role of matchRoles(profile, roles, exampleEvidence).roles) {
    assert.doesNotMatch(role.scoreExplanation, /missing|you lack/i);
  }
});

// (f)
test("one +1 evidence row changes the score and is cited; removing it restores the score", () => {
  // nodejs is a backend strength (base weight 3).
  const plusOne: EvidenceInput[] = [
    { evidenceId: "test-evidence-1", skillId: "nodejs", direction: "rising", priorityAdjustment: 1, explanation: "Test row." },
  ];
  const before = byId(matchRoles(profile, roles, []), "backend-development");
  const withEvidence = byId(matchRoles(profile, roles, plusOne), "backend-development");
  const after = byId(matchRoles(profile, roles, []), "backend-development");

  assert.equal(before.score, 78); // 14 / 18
  assert.equal(withEvidence.score, 79); // 15 / 19 = 78.9
  assert.equal(after.score, before.score);
  assert.match(withEvidence.scoreExplanation, /Node\.js from 3 to 4 \(\+1 from evidence test-evidence-1\)/);
  const nodejs = withEvidence.strengths.find((s) => s.skillId === "nodejs");
  assert.equal(nodejs?.weight, 4);
  assert.equal(nodejs?.baseWeight, 3);
  assert.equal(nodejs?.evidenceAdjustments?.[0]?.evidenceId, "test-evidence-1");
  assert.equal(after.strengths.find((s) => s.skillId === "nodejs")?.baseWeight, undefined);
});

test("evidence is limited to -1..+1 in total, and a weight never goes below 0.5", () => {
  const rows: EvidenceInput[] = [
    { evidenceId: "up-a", skillId: "nodejs", direction: "rising", priorityAdjustment: 1, explanation: null },
    { evidenceId: "up-b", skillId: "nodejs", direction: "rising", priorityAdjustment: 0.5, explanation: null },
    { evidenceId: "down-a", skillId: "testing-basics", direction: "declining", priorityAdjustment: -1, explanation: null },
  ];
  const backend = byId(matchRoles(profile, roles, rows), "backend-development");
  const nodejs = backend.strengths.find((s) => s.skillId === "nodejs");
  const testing = backend.strengths.find((s) => s.skillId === "testing-basics");
  assert.equal(nodejs?.weight, 4); // 3 + min(1.5, 1)
  assert.equal(testing?.weight, 0.5); // 1 - 1 = 0, raised to 0.5
  assert.match(backend.scoreExplanation, /\+1\.5 from evidence up-a, up-b, limited to \+1/);
  assert.match(backend.scoreExplanation, /from 1 to 0\.5 .*lowest allowed weight is 0\.5/);
  MatchResponse.parse({ ...matchRoles(profile, roles, rows), roles: [backend] });
});

test("when evidence could not be read, base weights are used and the explanation says so", () => {
  const response = matchRoles(profile, roles, null);
  assert.equal(byId(response, "backend-development").score, 78);
  for (const role of response.roles) {
    assert.match(role.scoreExplanation, /Trend evidence was not available, so base weights were used\./);
  }
});

// Part A: isPlaceholder on the match response
test("isPlaceholder is false only when no role, role skill or skill used is placeholder", () => {
  const reviewed: RoleInput[] = [
    { roleId: "aa-role", name: "A", isPlaceholder: false, skills: [skill("git", 2, true, false), skill("sql", 1, false, false)] },
  ];
  assert.equal(matchRoles(profile, reviewed, []).isPlaceholder, false);

  const oneSkillPlaceholder = [{ ...reviewed[0]!, skills: [skill("git", 2, true, false), skill("sql", 1, false, true)] }];
  assert.equal(matchRoles(profile, oneSkillPlaceholder, []).isPlaceholder, true);

  const rolePlaceholder = [{ ...reviewed[0]!, isPlaceholder: true }];
  assert.equal(matchRoles(profile, rolePlaceholder, []).isPlaceholder, true);
});
