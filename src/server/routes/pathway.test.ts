// Tests for POST /api/pathway. No database: the route gets fake loaders.
// Run with: npm test

import { after, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { ApiError, PathwayResponse } from "../contracts/index.ts";
import { exampleConfirmedProfile, exampleExtractResponse, examplePathwayResponse } from "../contracts/examples.ts";
import { exampleEvidence, exampleResources, exampleRoles } from "../matching/exampleInputs.ts";
import { errorHandler } from "./errors.ts";
import { createPathwayRouter } from "./pathway.ts";

const knownSkillIds = [...new Set(exampleRoles.flatMap((r) => r.skills.map((s) => s.skillId))), "python"];

const servers: Server[] = [];
after(() => servers.forEach((s) => s.close()));

async function startApp(): Promise<string> {
  const app = express();
  app.use(
    createPathwayRouter({
      loadRoles: async () => exampleRoles,
      loadKnownSkillIds: async () => knownSkillIds,
      loadResources: async (skillIds) => exampleResources.filter((r) => skillIds.includes(r.skillId)),
      loadEvidence: async () => exampleEvidence,
    }),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once("listening", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function postPathway(body: unknown) {
  const res = await fetch(`${await startApp()}/api/pathway`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as unknown };
}

function assertError(result: { status: number; body: unknown }, status: number, code: string) {
  assert.equal(result.status, status);
  const error = ApiError.parse(result.body).error;
  assert.equal(error.code, code);
  return error;
}

test("a valid request returns the example pathway, which passes the schema", async () => {
  const result = await postPathway({ profile: exampleConfirmedProfile, roleId: "qa-automation" });
  assert.equal(result.status, 200);
  assert.deepEqual(PathwayResponse.parse(result.body), examplePathwayResponse);
});

test("the pathway is for the requested role, not the preferred route", async () => {
  // The example graduate prefers QA automation, but asks for backend here.
  const result = await postPathway({ profile: exampleConfirmedProfile, roleId: "backend-development" });
  assert.equal(PathwayResponse.parse(result.body).roleId, "backend-development");
});

// (f)
test("a draft profile returns INVALID_INPUT", async () => {
  const error = assertError(await postPathway({ profile: exampleExtractResponse, roleId: "qa-automation" }), 400, "INVALID_INPUT");
  assert.match(error.message, /draft profile/);
});

test("an unknown roleId returns NOT_FOUND", async () => {
  const error = assertError(await postPathway({ profile: exampleConfirmedProfile, roleId: "data-science" }), 404, "NOT_FOUND");
  assert.match(error.message, /data-science/);
});

test("an unknown skill ID returns INVALID_INPUT with a detail", async () => {
  const profile = { ...exampleConfirmedProfile, unconfirmedSkillIds: ["docker", "made-up-skill"] };
  const error = assertError(await postPathway({ profile, roleId: "qa-automation" }), 400, "INVALID_INPUT");
  assert.deepEqual(error.details, [{ path: "unconfirmedSkillIds.1", message: 'Unknown skillId "made-up-skill".' }]);
});

test("a body without roleId returns INVALID_INPUT", async () => {
  const error = assertError(await postPathway({ profile: exampleConfirmedProfile }), 400, "INVALID_INPUT");
  assert.ok(error.details?.some((d) => d.path === "roleId"));
});
