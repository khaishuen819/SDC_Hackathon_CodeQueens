// Checks that every example in examples.ts matches its schema,
// and that the schemas reject a few inputs that break product rules.
// Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import * as z from "zod";
import {
  ApiError,
  ConfirmedProfile,
  DraftProfile,
  EvidenceListResponse,
  MatchRequest,
  MatchResponse,
  PathwayRequest,
  PathwayResponse,
  RolesResponse,
  SdgResponse,
} from "./index.ts";
import * as ex from "./examples.ts";

// Parses `value` and fails the test with a readable Zod message if it is invalid.
function assertValid(schema: z.ZodType, value: unknown) {
  const result = schema.safeParse(value);
  assert.ok(result.success, result.success ? "" : z.prettifyError(result.error));
}

const cases: Array<[string, z.ZodType, unknown]> = [
  ["extract response (DraftProfile)", DraftProfile, ex.exampleExtractResponse],
  ["confirmed profile", ConfirmedProfile, ex.exampleConfirmedProfile],
  ["match request", MatchRequest, ex.exampleMatchRequest],
  ["match response", MatchResponse, ex.exampleMatchResponse],
  ["pathway request", PathwayRequest, ex.examplePathwayRequest],
  ["pathway response", PathwayResponse, ex.examplePathwayResponse],
  ["roles response", RolesResponse, ex.exampleRolesResponse],
  ["sdg response", SdgResponse, ex.exampleSdgResponse],
  ["evidence response", EvidenceListResponse, ex.exampleEvidenceResponse],
  ["error response", ApiError, ex.exampleErrorResponse],
];

for (const [name, schema, example] of cases) {
  test(`example is valid: ${name}`, () => assertValid(schema, example));
}

test("a draft profile is not accepted as a confirmed profile", () => {
  assert.equal(ConfirmedProfile.safeParse(ex.exampleExtractResponse).success, false);
});

test("preferred-route without preferredRouteId is rejected", () => {
  const { preferredRouteId: _removed, ...profile } = ex.exampleConfirmedProfile;
  assert.equal(ConfirmedProfile.safeParse(profile).success, false);
});

test("a skill cannot be both confirmed and removed", () => {
  const profile = { ...ex.exampleConfirmedProfile, removedSkillIds: ["python", "sql"] };
  assert.equal(ConfirmedProfile.safeParse(profile).success, false);
});

test("a score above 100 is rejected", () => {
  const [first, ...rest] = ex.exampleMatchResponse.roles;
  const response = { ...ex.exampleMatchResponse, roles: [{ ...first, score: 101 }, ...rest] };
  assert.equal(MatchResponse.safeParse(response).success, false);
});
