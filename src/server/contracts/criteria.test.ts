import test from "node:test";
import assert from "node:assert/strict";
import { CriteriaReview, SkillReview, SnapshotId } from "./criteria.ts";
import { ApiError } from "./errors.ts";
import { COUNT_SCORE_MEANING, MatchRequest, VersionedMatchResponse } from "./match.ts";
import { VersionedRolesResponse } from "./roles.ts";
import { bundle, profile, SNAPSHOT } from "../trends/testFixtures.ts";

const meta = { snapshotId: SNAPSHOT, policyVersion: "count-coverage-v1", status: "fresh", lastSuccessfulCheckAt: null, lastAttemptAt: null,
  providers: [], notices: [], deferredItemCount: 0, quarantinedItemCount: 0, refreshControl: { state: "ready", retryAt: null } };

test("snapshot IDs and optional possession answers have strict transport shapes", () => {
  assert.equal(SnapshotId.safeParse(SNAPSHOT).success, true);
  assert.equal(SnapshotId.safeParse("latest").success, false);
  assert.deepEqual(CriteriaReview.parse({ targetSnapshotId: SNAPSHOT }).answers, []);
  assert.equal(CriteriaReview.safeParse({ targetSnapshotId: SNAPSHOT, answers: [{ skillId: "sql", answer: "not-sure" }, { skillId: "sql", answer: "have" }] }).success, false);
});

test("optional questions are valid alongside results; only genuine context errors carry error review", () => {
  const review = SkillReview.parse({ targetSnapshotId: SNAPSHOT, questions: [] });
  assert.equal(ApiError.safeParse({ error: { code: "CRITERIA_CONTEXT_REQUIRED", message: "Reload context." }, review }).success, true);
  assert.equal(ApiError.safeParse({ error: { code: "INVALID_INPUT", message: "Bad input." }, review }).success, false);
  assert.equal(ApiError.safeParse({ error: { code: "INVALID_INPUT", message: "Bad input." } }).success, true);
  assert.equal(ApiError.safeParse({ error: { code: "CRITERIA_CONTEXT_REQUIRED", message: "Missing context payload." } }).success, false);
});

test("match transport preserves existing confirmed-profile refinements", () => {
  assert.equal(MatchRequest.safeParse({ ...profile(["sql"]), snapshotId: SNAPSHOT }).success, true);
  assert.equal(MatchRequest.safeParse({ ...profile(["sql"]), unconfirmedSkillIds: ["sql"], snapshotId: SNAPSHOT }).success, false);
  assert.equal(MatchRequest.safeParse({ ...profile([]), addedSkillIds: ["sql"], snapshotId: SNAPSHOT }).success, false);
});

test("versioned responses require metadata and complete recognised registry", () => {
  assert.equal(VersionedRolesResponse.safeParse({ isPlaceholder: false, roles: [] }).success, false);
  assert.equal(VersionedMatchResponse.safeParse({ isPlaceholder: false, roles: [], scoreMeaning: "old" }).success, false);
  const data = bundle(2);
  const roles = { isPlaceholder: false, roles: data.roles, criteria: meta, recognisedSkills: data.capabilities.map(({ skillId, name }) => ({ skillId, name })) };
  assert.equal(VersionedRolesResponse.safeParse(roles).success, true);
  assert.equal(VersionedRolesResponse.safeParse({ ...roles, recognisedSkills: roles.recognisedSkills.slice(1) }).success, false);
});

test("versioned matching accepts optional unanswered guidance but rejects mixed context or legacy weights", () => {
  const response: any = { scoreMeaning: COUNT_SCORE_MEANING, isPlaceholder: false, criteria: meta,
    review: { targetSnapshotId: SNAPSHOT, questions: [] }, roles: [{ roleId: "backend-development", rank: 1, score: 0,
      scoreExplanation: "Zero confirmed fixture skills.", strengths: [], unconfirmedSkills: [],
      gaps: [{ skillId: "sql", weight: 1, isRequired: true }], preferredRouteKept: false }] };
  assert.equal(VersionedMatchResponse.safeParse(response).success, true);
  const mixed = structuredClone(response); mixed.review.targetSnapshotId = `criteria-${"b".repeat(64)}`;
  assert.equal(VersionedMatchResponse.safeParse(mixed).success, false);
  response.roles[0].gaps[0].weight = 3;
  assert.equal(VersionedMatchResponse.safeParse(response).success, false);
});
