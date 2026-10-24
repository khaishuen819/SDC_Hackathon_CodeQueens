// Fictional inputs for pure state/display rules; no model, database or network.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as trends from "../public/js/trends.js";

const S = "criteria-" + "a".repeat(64);
const PREVIOUS = "criteria-" + "b".repeat(64);
const profile = {
  status: "confirmed", confirmedSkills: [{ skillId: "api-basics", level: "beginner" }],
  removedSkillIds: ["wrong-extraction"], addedSkillIds: [], unconfirmedSkillIds: ["fixture-skill-1"],
  entryPath: "preferred-route", preferredRouteId: "qa-automation", confirmedAt: "2026-10-24T10:00:00Z",
};
const meta = {
  snapshotId: S, policyVersion: "count-coverage-v1", status: "partial",
  lastSuccessfulCheckAt: "2026-10-22T10:00:00Z", lastAttemptAt: "2026-10-24T10:00:00Z",
  providers: [], notices: ["Fictional saved criteria."], deferredItemCount: 0, quarantinedItemCount: 0,
  refreshControl: { state: "ready", retryAt: null },
};
const question = {
  skillId: "fixture-skill-1", name: "Fictional capability", roleIds: ["qa-automation"],
  why: "Fictional task-to-skill explanation.", evidenceIds: ["fixture-source"], state: "unanswered",
};

function helper(name) {
  assert.equal(typeof trends[name], "function", `${name} needs to implement the planned state/display rule`);
  return trends[name];
}

function session() {
  return {
    profile: structuredClone(profile), acceptedSnapshotId: S, loadingSnapshotId: null,
    requestId: 1, criteria: structuredClone(meta), review: { targetSnapshotId: S, questions: [structuredClone(question)] },
    answersBySnapshotId: {}, learningChoicesBySkillId: {},
  };
}

test("Have clears incompatible groups, preserves proficiency and route, and does not mutate input", () => {
  const merge = helper("mergeSkillAnswers");
  const input = structuredClone(profile);
  const have = merge(input, [{ skillId: "fixture-skill-1", answer: "have" }]);
  assert.deepEqual(have.confirmedSkills, [{ skillId: "api-basics", level: "beginner" }, { skillId: "fixture-skill-1" }]);
  assert.deepEqual(have.addedSkillIds, ["fixture-skill-1"]);
  assert.deepEqual(have.unconfirmedSkillIds, []);
  assert.equal(have.preferredRouteId, "qa-automation");
  assert.equal(have.confirmedAt, "2026-10-24T10:00:00Z");
  assert.deepEqual(input, profile);
  const corrected = merge(have, [{ skillId: "wrong-extraction", answer: "have" }, { skillId: "api-basics", answer: "have" }]);
  assert.deepEqual(corrected.removedSkillIds, []);
  assert.deepEqual(corrected.addedSkillIds, ["fixture-skill-1", "wrong-extraction"]);
  assert.equal(corrected.confirmedSkills.find(s => s.skillId === "api-basics").level, "beginner");
});

test("Not sure remains unconfirmed, Not yet removes possession without fabricating extraction errors", () => {
  const merge = helper("mergeSkillAnswers");
  const unsure = merge(profile, [{ skillId: "api-basics", answer: "not-sure" }, { skillId: "wrong-extraction", answer: "not-sure" }]);
  assert.deepEqual(unsure.confirmedSkills, []);
  assert.deepEqual(unsure.removedSkillIds, []);
  assert.deepEqual(unsure.unconfirmedSkillIds, ["api-basics", "fixture-skill-1", "wrong-extraction"]);
  const notYet = merge(profile, [{ skillId: "fixture-skill-1", answer: "not-yet" }, { skillId: "api-basics", answer: "not-yet" }]);
  assert.deepEqual(notYet.confirmedSkills, []);
  assert.deepEqual(notYet.unconfirmedSkillIds, []);
  assert.deepEqual(notYet.removedSkillIds, ["wrong-extraction"]);
  assert.deepEqual(notYet.addedSkillIds, []);
  assert.deepEqual(merge(profile, []), profile, "omission does not invent a possession answer");
});

test("invalid or duplicate possession answers cannot silently change a profile", () => {
  const merge = helper("mergeSkillAnswers");
  for (const answers of [null, {}, [{ skillId: "bad ID", answer: "have" }],
    [{ skillId: "api-basics", answer: "add" }],
    [{ skillId: "api-basics", answer: "have", extra: true }],
    [{ skillId: "api-basics", answer: "have" }, { skillId: "api-basics", answer: "not-yet" }],
  ]) assert.throws(() => merge(profile, answers), /answer/i);
  assert.throws(() => merge({ ...profile, status: "draft" }, []), /confirmed/i);
});

test("the snapshot answer ledger retains Not yet across unrelated edits and replaces an answer once", () => {
  const record = helper("recordSkillAnswer");
  const initial = session();
  const first = record(initial, "fixture-skill-1", "not-yet");
  const second = record(first, "other-skill", "have");
  assert.deepEqual(second.answersBySnapshotId[S], [
    { skillId: "fixture-skill-1", answer: "not-yet" }, { skillId: "other-skill", answer: "have" },
  ]);
  assert.deepEqual(second.profile.confirmedSkills.map(s => s.skillId), ["api-basics", "other-skill"]);
  assert.deepEqual(second.profile.unconfirmedSkillIds, []);
  const third = record(second, "fixture-skill-1", "have");
  assert.deepEqual(third.answersBySnapshotId[S], [
    { skillId: "fixture-skill-1", answer: "have" }, { skillId: "other-skill", answer: "have" },
  ]);
  assert.deepEqual(first.answersBySnapshotId[S], [{ skillId: "fixture-skill-1", answer: "not-yet" }]);
  assert.deepEqual(initial.answersBySnapshotId, {});
  assert.deepEqual(initial.profile, profile);
  assert.equal(third.profile.preferredRouteId, "qa-automation");
  assert.deepEqual(third.criteria, meta);
});

test("answers stay scoped to their accepted snapshot and require a valid target", () => {
  const record = helper("recordSkillAnswer");
  const previous = record({ ...session(), acceptedSnapshotId: PREVIOUS }, "fixture-skill-1", "not-yet");
  const current = record({ ...previous, acceptedSnapshotId: S }, "other-skill", "not-sure");
  assert.deepEqual(current.answersBySnapshotId[PREVIOUS], [{ skillId: "fixture-skill-1", answer: "not-yet" }]);
  assert.deepEqual(current.answersBySnapshotId[S], [{ skillId: "other-skill", answer: "not-sure" }]);
  assert.throws(() => record({ ...session(), acceptedSnapshotId: null }, "other-skill", "have"), /version|snapshot/i);
});

test("learning choices change only learning intent and never possession, answers or criteria", () => {
  const choose = helper("learningChoice");
  const before = session();
  const afterAdd = choose(before, "fixture-skill-1", "add");
  assert.deepEqual(afterAdd.learningChoicesBySkillId, { "fixture-skill-1": "add" });
  const afterNotNow = choose(afterAdd, "fixture-skill-1", "not-now");
  assert.deepEqual(afterNotNow.learningChoicesBySkillId, { "fixture-skill-1": "not-now" });
  for (const after of [afterAdd, afterNotNow]) {
    assert.deepEqual(after.profile, before.profile);
    assert.deepEqual(after.answersBySnapshotId, before.answersBySnapshotId);
    assert.deepEqual(after.criteria, before.criteria);
    assert.deepEqual(after.review, before.review);
    assert.equal(after.requestId, before.requestId);
  }
  assert.deepEqual(before.learningChoicesBySkillId, {});
  assert.throws(() => choose(before, "fixture-skill-1", "have"), /learning/i);
  assert.throws(() => choose(before, "bad ID", "add"), /skill/i);
});

test("optional guidance preserves server reasons, filters possession and leaves unanswered questions usable", () => {
  const questions = helper("buildOptionalQuestions");
  const review = { targetSnapshotId: S, questions: [
    { ...question, skillId: "api-basics" }, question,
    { ...question, skillId: "later-skill", name: "Another fictional capability" },
  ] };
  const before = structuredClone(review);
  const result = questions(review, profile, [{ skillId: "later-skill", answer: "not-yet" }]);
  assert.deepEqual(result, [question]);
  assert.deepEqual(review, before);
  const unsure = questions(review, profile, [{ skillId: "fixture-skill-1", answer: "not-sure" }]);
  assert.equal(unsure[0].state, "not-sure");
  assert.equal(unsure[0].why, "Fictional task-to-skill explanation.");
  assert.deepEqual(unsure[0].evidenceIds, ["fixture-source"]);
  assert.deepEqual(questions({ targetSnapshotId: S, questions: [] }, profile, []), []);
  assert.deepEqual(profile.confirmedSkills, [{ skillId: "api-basics", level: "beginner" }], "viewing guidance does not confirm a skill");
});

test("malformed guidance is rejected instead of inventing questions", () => {
  const questions = helper("buildOptionalQuestions");
  for (const review of [null, { targetSnapshotId: S, answers: [] },
    { targetSnapshotId: "wrong", questions: [] },
    { targetSnapshotId: S, questions: [question, question] },
    { targetSnapshotId: S, questions: [{ ...question, why: "" }] },
    { targetSnapshotId: S, questions: [{ ...question, roleIds: [] }] },
    { targetSnapshotId: S, questions: [{ ...question, evidenceIds: ["bad ID"] }] },
  ]) assert.throws(() => questions(review, profile, []), /review|guidance/i);
});

test("source dates retain publication precision and never borrow check dates", () => {
  const format = helper("formatEvidenceDate");
  const inputs = [
    { item: { datePrecision: "year", originalDate: "2025", publishedDate: "2025-01-01", dateBasis: "published" }, expected: "Published 2025 (year only)" },
    { item: { datePrecision: "month", originalDate: "2026-09", publishedDate: "2026-09-01", dateBasis: "updated" }, expected: "Updated 2026-09 (month only)" },
    { item: { datePrecision: "day", originalDate: "2026-10-20", publishedDate: "2026-10-20", dateBasis: "published" }, expected: "Published 2026-10-20" },
    { item: { datePrecision: "day", originalDate: null, publishedDate: "2026-10-19", dateBasis: "updated" }, expected: "Updated 2026-10-19" },
    { item: { datePrecision: "unknown", originalDate: null, publishedDate: null, dateBasis: "published" }, expected: "Publication date unknown" },
    { item: { datePrecision: "year", originalDate: null, publishedDate: "2025-01-01", dateBasis: "published" }, expected: "Publication date unknown" },
  ];
  for (const { item, expected } of inputs) {
    const actual = format({ ...item, checkedAt: "2026-10-24T10:00:00Z", retrievedAt: "2026-10-24" });
    assert.equal(actual, expected);
    assert.ok(!actual.includes("2026-10-24"));
  }
});

test("trend notices distinguish fresh, partial, disabled and unavailable without inventing freshness", () => {
  const notices = helper("trendNotices");
  const cases = [
    { status: "fresh", wanted: /completed/i }, { status: "partial", wanted: /partial/i },
    { status: "disabled", wanted: /disabled/i }, { status: "unavailable", wanted: /unavailable/i },
  ];
  for (const entry of cases) {
    const lines = notices({ ...meta, status: entry.status });
    assert.match(lines.join("\n"), entry.wanted);
    assert.ok(lines.some(line => line.includes("2026-10-22T10:00:00Z")), "show the actual saved success time");
    assert.ok(lines.some(line => line.includes("2026-10-24T10:00:00Z")), "show the actual attempt separately");
    assert.ok(lines.includes("Fictional saved criteria."));
    if (entry.status !== "fresh") assert.doesNotMatch(lines.join("\n"), /check completed/i);
  }
  const empty = notices({ ...meta, snapshotId: null, status: "unavailable", lastSuccessfulCheckAt: null });
  assert.match(empty.join("\n"), /no saved criteria/i);
  assert.doesNotMatch(empty.join("\n"), /using saved criteria/i);
  assert.match(notices(null).join("\n"), /unavailable/i);
});

test("busy and cooldown show retry metadata without calling it a new successful check", () => {
  const notices = helper("trendNotices");
  for (const state of ["busy", "cooldown"]) {
    const lines = notices({ ...meta, refreshControl: { state, retryAt: "2026-10-24T10:01:00Z" } });
    assert.match(lines.join("\n"), new RegExp(state, "i"));
    assert.ok(lines.some(line => line.includes("2026-10-24T10:01:00Z")));
    assert.doesNotMatch(lines.join("\n"), /check completed|automatically retry/i);
  }
});

test("provider failures and deferred or quarantined work do not imply declining skills or expired data", () => {
  const notices = helper("trendNotices");
  const state = {
    ...meta, deferredItemCount: 2, quarantinedItemCount: 1,
    providers: [{ providerId: "fixture-feed", status: "failed", lastAttemptAt: "2026-10-24T09:00:00Z",
      lastSuccessfulCheckAt: "2026-10-20T08:00:00Z", errorCode: "SOURCE_UNAVAILABLE" }],
  };
  const before = structuredClone(state);
  const lines = notices(state);
  const text = lines.join("\n");
  assert.match(text, /fixture-feed.*failed/i);
  assert.match(text, /2.*deferred/i);
  assert.match(text, /1.*quarantined/i);
  assert.ok(text.includes("2026-10-20T08:00:00Z"));
  assert.ok(text.includes("2026-10-24T09:00:00Z"));
  assert.doesNotMatch(text, /declin|expired|reset|removed|human.reviewed/i);
  assert.deepEqual(state, before);
});
