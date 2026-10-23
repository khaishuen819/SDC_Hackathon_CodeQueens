// Tests for POST /api/match. No database: the route gets fake loaders.
// Run with: npm test

import { after, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { ApiError, MatchResponse } from "../contracts/index.ts";
import { exampleConfirmedProfile, exampleExtractResponse } from "../contracts/examples.ts";
import type { EvidenceInput, RoleInput } from "../matching/matchEngine.ts";
import { errorHandler } from "./errors.ts";
import { createMatchRouter, type MatchRouteDeps } from "./match.ts";

const roles: RoleInput[] = [
  {
    roleId: "backend-development",
    name: "Backend Development",
    isPlaceholder: false,
    skills: [
      { skillId: "nodejs", name: "Node.js", weight: 3, isRequired: true, isPlaceholder: false },
      { skillId: "sql", name: "SQL", weight: 3, isRequired: true, isPlaceholder: false },
      { skillId: "docker", name: "Docker", weight: 2, isRequired: false, isPlaceholder: false },
    ],
  },
  {
    roleId: "qa-automation",
    name: "QA Automation",
    isPlaceholder: true, // one placeholder role makes the whole match placeholder
    skills: [
      { skillId: "testing-basics", name: "Testing basics", weight: 3, isRequired: true, isPlaceholder: false },
      { skillId: "git", name: "Git", weight: 2, isRequired: true, isPlaceholder: false },
    ],
  },
];
const knownSkillIds = ["javascript", "nodejs", "sql", "git", "testing-basics", "api-basics", "python", "docker"];

const servers: Server[] = [];
after(() => servers.forEach((s) => s.close()));

async function startApp(overrides: Partial<MatchRouteDeps> = {}): Promise<string> {
  const app = express();
  app.use(
    createMatchRouter({
      loadRoles: async () => roles,
      loadKnownSkillIds: async () => knownSkillIds,
      loadEvidence: async () => [],
      ...overrides,
    }),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function postMatch(baseUrl: string, body: unknown) {
  const res = await fetch(`${baseUrl}/api/match`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as unknown };
}

function assertInvalidInput(result: { status: number; body: unknown }) {
  assert.equal(result.status, 400);
  const error = ApiError.parse(result.body).error;
  assert.equal(error.code, "INVALID_INPUT");
  return error;
}

// (h)
test("a confirmed profile returns a valid MatchResponse", async () => {
  const result = await postMatch(await startApp(), exampleConfirmedProfile);
  assert.equal(result.status, 200);
  const response = MatchResponse.parse(result.body);
  // With these test roles: QA 5 of 5 = 100, backend 6 of 8 = 75.
  assert.deepEqual(response.roles.map((r) => [r.roleId, r.score]), [["qa-automation", 100], ["backend-development", 75]]);
  assert.equal(response.isPlaceholder, true);
});

// (g)
test("a draft profile is rejected with INVALID_INPUT", async () => {
  const error = assertInvalidInput(await postMatch(await startApp(), exampleExtractResponse));
  assert.match(error.message, /draft profile/);
  assert.ok(error.details?.some((d) => d.path === "status"));
});

test("an unknown skill ID is rejected with INVALID_INPUT and a detail", async () => {
  const profile = {
    ...exampleConfirmedProfile,
    confirmedSkills: [...exampleConfirmedProfile.confirmedSkills, { skillId: "made-up-skill" }],
  };
  const error = assertInvalidInput(await postMatch(await startApp(), profile));
  assert.deepEqual(error.details, [{ path: "confirmedSkills.6.skillId", message: 'Unknown skillId "made-up-skill".' }]);
});

test("an unknown preferredRouteId is rejected with INVALID_INPUT", async () => {
  const profile = { ...exampleConfirmedProfile, preferredRouteId: "data-science" };
  const error = assertInvalidInput(await postMatch(await startApp(), profile));
  assert.deepEqual(error.details, [{ path: "preferredRouteId", message: 'Unknown roleId "data-science".' }]);
});

test("a body that fails the schema returns INVALID_INPUT with details", async () => {
  const error = assertInvalidInput(await postMatch(await startApp(), { status: "confirmed" }));
  assert.ok((error.details?.length ?? 0) > 0);
});

test("a body that is not JSON returns INVALID_INPUT", async () => {
  assertInvalidInput(await postMatch(await startApp(), "{not json"));
});

// Evidence hook through the route
test("evidence from the loader changes the score; a failed evidence read still returns a match", async () => {
  const evidence: EvidenceInput[] = [];
  const url = await startApp({ loadEvidence: async () => evidence });
  const backendScore = async () => {
    const response = MatchResponse.parse((await postMatch(url, exampleConfirmedProfile)).body);
    return response.roles.find((r) => r.roleId === "backend-development");
  };

  const before = await backendScore(); // nodejs 3 + sql 3 of 3 + 3 + 2 = 75
  evidence.push({ evidenceId: "route-evidence-1", skillId: "nodejs", direction: "rising", priorityAdjustment: 1, explanation: "Test." });
  const withEvidence = await backendScore(); // 7 of 9 = 78
  evidence.pop();
  const after = await backendScore();
  assert.equal(before?.score, 75);
  assert.equal(withEvidence?.score, 78);
  assert.match(withEvidence?.scoreExplanation ?? "", /route-evidence-1/);
  assert.equal(after?.score, 75);

  const failing = await startApp({
    loadEvidence: async () => {
      throw new Error("fake database outage");
    },
  });
  const result = await postMatch(failing, exampleConfirmedProfile);
  assert.equal(result.status, 200);
  const response = MatchResponse.parse(result.body);
  assert.ok(response.roles.every((r) => r.scoreExplanation.includes("Trend evidence was not available")));
});
