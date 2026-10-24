import test from "node:test";
import assert from "node:assert/strict";
import { createRolesRouter } from "./roles.ts";
import { VersionedRolesResponse } from "../contracts/roles.ts";
import { startApp, request, criteriaHarness } from "./criteriaTestSupport.ts";
import { bundle } from "../trends/testFixtures.ts";

test("roles recognise retired skills without counting them in current associations", async () => {
  const h = await criteriaHarness(), next = bundle(2);
  for (const r of next.roles) r.skills = r.skills.filter((s) => s.skillId !== "api-basics");
  for (const d of next.criteriaDecisions) if (d.skillId === "api-basics") d.action = "retire";
  const current = await h.publish(next), base = await startApp(createRolesRouter(h));
  const result = await request(base, "/api/roles");
  assert.equal(result.status, 200);
  const response = VersionedRolesResponse.parse(result.body);
  assert.equal(response.criteria.snapshotId, current);
  assert.ok(response.recognisedSkills.some((s) => s.skillId === "api-basics" && s.name === "API basics"));
  assert.ok(response.roles.every((r) => r.skills.length === 1 && r.skills[0].weight === 1));
  const before = await request(base, `/api/roles?snapshotId=${h.id}`);
  assert.equal(before.body.criteria.snapshotId, h.id); assert.ok(before.body.roles.every((r: any) => r.skills.length === 2));
});
