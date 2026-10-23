// Tests for the pure pathway engine. No database: role, resources and evidence are passed in.
// Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { PathwayResponse, type ConfirmedProfile } from "../contracts/index.ts";
import { exampleConfirmedProfile, examplePathwayResponse } from "../contracts/examples.ts";
import { loadReviewedEvidence } from "../db/matchData.ts";
import { exampleEvidence, exampleResources, exampleRoles } from "../matching/exampleInputs.ts";
import type { EvidenceInput, RoleInput } from "../matching/matchEngine.ts";
import { buildPathway, type ResourceInput } from "./pathwayEngine.ts";

const profile: ConfirmedProfile = exampleConfirmedProfile;
const backend = exampleRoles.find((r) => r.roleId === "backend-development") as RoleInput;
const qa = exampleRoles.find((r) => r.roleId === "qa-automation") as RoleInput;
const stepIds = (response: PathwayResponse) => response.steps.map((s) => s.skillId);
const step = (response: PathwayResponse, skillId: string) => {
  const found = response.steps.find((s) => s.skillId === skillId);
  assert.ok(found, `no step for ${skillId}`);
  return found;
};

// (a)
test("the example profile gives the expected ordered steps for both roles", () => {
  const qaPath = buildPathway(profile, qa, exampleResources, exampleEvidence);
  assert.deepEqual(qaPath, examplePathwayResponse); // exactly the example M1 builds against
  PathwayResponse.parse(qaPath);

  // Backend: neither step is required and both weigh 2, so they are ordered by skill id.
  const backendPath = buildPathway(profile, backend, exampleResources, exampleEvidence);
  assert.deepEqual(stepIds(backendPath), ["database-design", "docker"]);
  assert.deepEqual(backendPath.steps.map((s) => s.order), [1, 2]);
  PathwayResponse.parse(backendPath);
});

test("required skills come first, even above a heavier optional skill", () => {
  // Without evidence, CI/CD basics (2) and Test automation (3, required).
  // With +1 evidence CI/CD basics also weighs 3, but required still goes first.
  assert.deepEqual(stepIds(buildPathway(profile, qa, exampleResources, exampleEvidence)), ["test-automation", "ci-cd-basics"]);
});

// (b)
test("a graduate with every skill of the role gets an empty steps array", () => {
  const everything = {
    ...profile,
    confirmedSkills: backend.skills.map((s) => ({ skillId: s.skillId })),
    addedSkillIds: [],
    removedSkillIds: [],
    unconfirmedSkillIds: [],
  };
  const response = buildPathway(everything, backend, exampleResources, []);
  assert.deepEqual(response.steps, []);
  PathwayResponse.parse(response);
});

// (c)
test("an unconfirmed skill is in the pathway with the check-first wording", () => {
  const docker = step(buildPathway(profile, backend, exampleResources, []), "docker");
  assert.match(docker.why, /You marked it as not sure, so check first whether you already have it/);
});

test("a removed skill is in the pathway", () => {
  const removedSql = {
    ...profile,
    confirmedSkills: profile.confirmedSkills.filter((s) => s.skillId !== "sql"),
    removedSkillIds: [...profile.removedSkillIds, "sql"],
  };
  const response = buildPathway(removedSql, backend, exampleResources, []);
  assert.equal(stepIds(response)[0], "sql"); // required, weight 3: first
  assert.match(step(response, "sql").why, /SQL is required for Backend Development \(weight 3\)\. You removed it/);
});

test("why texts never say 'missing' or 'you lack'", () => {
  for (const role of exampleRoles) {
    for (const s of buildPathway(profile, role, exampleResources, exampleEvidence).steps) {
      assert.doesNotMatch(s.why, /missing|you lack/i);
    }
  }
});

// (d)
test("a reviewed evidence row moves a skill up and is cited", () => {
  const dockerUp: EvidenceInput[] = [
    { evidenceId: "reviewed-docker-1", skillId: "docker", direction: "rising", priorityAdjustment: 1, explanation: "Test." },
  ];
  const before = buildPathway(profile, backend, exampleResources, []);
  const after = buildPathway(profile, backend, exampleResources, dockerUp);
  assert.deepEqual(stepIds(before), ["database-design", "docker"]);
  assert.deepEqual(stepIds(after), ["docker", "database-design"]); // 3 beats 2 now
  assert.match(step(after, "docker").why, /from 2 to 3 \(\+1 from evidence reviewed-docker-1\)/);
  assert.deepEqual(step(after, "docker").evidence, [{ evidenceId: "reviewed-docker-1" }]);
});

test("a placeholder evidence row does nothing", async () => {
  // The database returns a placeholder row; the loader drops it, so the pathway is unchanged.
  const placeholderRow = {
    id: "placeholder-docker-1",
    skillId: "docker",
    direction: "rising" as const,
    priorityAdjustment: 1,
    adjustmentExplanation: "Not reviewed.",
    isPlaceholder: true,
  };
  const fakeDb = { trendEvidence: { findMany: async () => [placeholderRow] } };
  const evidence = await loadReviewedEvidence(fakeDb as unknown as Parameters<typeof loadReviewedEvidence>[0]);
  assert.deepEqual(evidence, []);

  const response = buildPathway(profile, backend, exampleResources, evidence);
  assert.deepEqual(stepIds(response), ["database-design", "docker"]);
  assert.deepEqual(step(response, "docker").evidence, []);
  assert.doesNotMatch(step(response, "docker").why, /evidence/);
});

test("reviewed evidence without an adjustment is cited but does not change the weight", () => {
  const citeOnly: EvidenceInput[] = [
    { evidenceId: "cite-only-1", skillId: "docker", direction: "rising", priorityAdjustment: null, explanation: null },
  ];
  const docker = step(buildPathway(profile, backend, exampleResources, citeOnly), "docker");
  assert.deepEqual(docker.evidence, [{ evidenceId: "cite-only-1" }]);
  assert.match(docker.why, /counts with weight 2\./);
});

// (e)
test("resources and hours come only from the resource rows; nothing is invented", () => {
  const rows: ResourceInput[] = [
    // Two rows for Docker, given out of order: hours come from the first by resource id.
    { ...exampleResources[0]!, resourceId: "docker-b", skillId: "docker", estimatedHours: 7, isPlaceholder: false },
    { ...exampleResources[0]!, resourceId: "docker-a", skillId: "docker", estimatedHours: 4, isPlaceholder: true },
    // No row at all for database-design.
  ];
  const response = buildPathway(profile, backend, rows, []);

  const docker = step(response, "docker");
  assert.deepEqual(docker.resources.map((r) => r.resourceId), ["docker-a", "docker-b"]);
  assert.equal(docker.estimatedHours, 4);
  assert.deepEqual(
    docker.resources.map((r) => [r.title, r.url, r.isPlaceholder]),
    [
      [rows[1]!.title, rows[1]!.url, true],
      [rows[0]!.title, rows[0]!.url, false],
    ],
  );

  const dbDesign = step(response, "database-design");
  assert.deepEqual(dbDesign.resources, []);
  assert.equal(dbDesign.estimatedHours, null); // never an invented hour count
  assert.match(dbDesign.why, /No learning resource is listed for this skill yet\./);
  assert.ok(response.steps.every((s) => s.prerequisites.length === 0)); // no prerequisite data yet
  PathwayResponse.parse(response);
});

test("isPlaceholder is true if the role, a skill or a resource is placeholder", () => {
  const reviewedRole: RoleInput = {
    ...backend,
    isPlaceholder: false,
    skills: backend.skills.map((s) => ({ ...s, isPlaceholder: false })),
  };
  const reviewedResources = exampleResources.map((r) => ({ ...r, isPlaceholder: false }));
  assert.equal(buildPathway(profile, reviewedRole, reviewedResources, []).isPlaceholder, false);
  assert.equal(buildPathway(profile, reviewedRole, exampleResources, []).isPlaceholder, true);
  assert.equal(buildPathway(profile, { ...reviewedRole, isPlaceholder: true }, reviewedResources, []).isPlaceholder, true);
});
