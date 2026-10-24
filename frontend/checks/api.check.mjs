// Transport checks use fictional responses and an injected fetch: no server or paid calls.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as client from "../public/js/api.js";

const S = "criteria-" + "a".repeat(64);
const PREVIOUS = "criteria-" + "b".repeat(64);
const confirmedProfile = {
  status: "confirmed",
  confirmedSkills: [{ skillId: "api-basics" }],
  removedSkillIds: [], addedSkillIds: [], unconfirmedSkillIds: [],
  entryPath: "preferred-route", preferredRouteId: "qa-automation",
  confirmedAt: "2026-10-24T10:00:00Z",
};
const serverReview = {
  fromSnapshotId: PREVIOUS, targetSnapshotId: S,
  questions: [{
    skillId: "test-design", name: "Test design", roleIds: ["qa-automation"],
    why: "Fictional guidance for this transport check.", evidenceIds: ["fixture-evidence"],
    state: "unanswered",
  }],
};
const criteriaReview = {
  fromSnapshotId: PREVIOUS, targetSnapshotId: S,
  answers: [{ skillId: "test-design", answer: "not-yet" }],
};
const criteria = {
  snapshotId: S, policyVersion: "count-coverage-v1", status: "partial",
  lastSuccessfulCheckAt: null, lastAttemptAt: "2026-10-24T10:00:00Z",
  providers: [], notices: ["Fictional saved criteria."],
  deferredItemCount: 0, quarantinedItemCount: 0,
  refreshControl: { state: "ready", retryAt: null },
};

function makeClient(options) {
  assert.equal(typeof client.createApi, "function", "the client needs an injectable versioned API factory");
  return client.createApi(options);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("pins_reference_queries_and_preserves_request_shapes", async () => {
  const calls = [];
  const api = makeClient({ base: "https://fixture.example/", fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return json({ fixture: true });
  } });
  await api.roles(S);
  await api.evidence(S);
  await api.sdg(S);
  await api.roles();
  await api.evidence();
  await api.sdg();
  await api.match(confirmedProfile, { snapshotId: S, criteriaReview, ignored: "do not forward" });
  await api.pathway(confirmedProfile, "qa-automation", { snapshotId: S, criteriaReview });
  await api.reconcile(confirmedProfile, criteriaReview);
  await api.match(confirmedProfile);
  await api.pathway(confirmedProfile, "qa-automation");
  assert.deepEqual(calls.map(c => c.url), [
    `https://fixture.example/api/roles?snapshotId=${S}`,
    `https://fixture.example/api/evidence?snapshotId=${S}`,
    `https://fixture.example/api/sdg?snapshotId=${S}`,
    "https://fixture.example/api/roles", "https://fixture.example/api/evidence", "https://fixture.example/api/sdg",
    "https://fixture.example/api/match", "https://fixture.example/api/pathway",
    "https://fixture.example/api/trends/reconcile", "https://fixture.example/api/match", "https://fixture.example/api/pathway",
  ]);
  for (const call of calls.slice(6)) {
    assert.equal(call.options.method, "POST");
    assert.equal(call.options.headers["content-type"], "application/json");
  }
  const bodies = calls.slice(6).map(c => JSON.parse(c.options.body));
  const [matchBody, pathwayBody] = bodies;
  assert.equal(matchBody.snapshotId, S);
  assert.equal(Object.hasOwn(matchBody, "profile"), false);
  assert.deepEqual(matchBody, { ...confirmedProfile, snapshotId: S, criteriaReview });
  assert.deepEqual(pathwayBody.profile, confirmedProfile);
  assert.equal(pathwayBody.criteriaReview.targetSnapshotId, S);
  assert.deepEqual(pathwayBody, { profile: confirmedProfile, roleId: "qa-automation", snapshotId: S, criteriaReview });
  assert.deepEqual(bodies[2], { profile: confirmedProfile, review: criteriaReview });
  assert.deepEqual(bodies[3], confirmedProfile);
  assert.deepEqual(bodies[4], { profile: confirmedProfile, roleId: "qa-automation" });
  assert.equal(Object.hasOwn(confirmedProfile, "snapshotId"), false);
});

test("keeps_200_optional_review_and_409_context_payload", async () => {
  const success = {
    isPlaceholder: true, roles: [], criteria, review: serverReview,
    scoreMeaning: "The score is the percentage of this role's listed skills confirmed in your profile; each skill counts once. " +
      "Unconfirmed skills receive no credit yet and can be updated later. It is not a proficiency assessment or hiring probability.",
  };
  const details = [{ path: "snapshotId", message: "Reload the version." }];
  let attempts = 0;
  const api = makeClient({ fetchImpl: async () => {
    attempts++;
    return attempts === 1 ? json(success) : json({
      error: { code: "CRITERIA_CONTEXT_REQUIRED", message: "Reload the catalogue.", details },
      review: serverReview,
    }, 409);
  } });
  assert.deepEqual(await api.match(confirmedProfile, { snapshotId: S }), success);
  await assert.rejects(api.match(confirmedProfile), error => {
    assert.ok(error instanceof client.ApiError);
    assert.equal(error.status, 409);
    assert.equal(error.code, "CRITERIA_CONTEXT_REQUIRED");
    assert.equal(error.message, "Reload the catalogue.");
    assert.deepEqual(error.details, details);
    assert.deepEqual(error.review, serverReview);
    return true;
  });
  assert.equal(attempts, 2, "transport must not retry or trigger refresh");

  const minimalReview = { targetSnapshotId: S, questions: [] };
  const minimal = makeClient({ fetchImpl: async () => json({
    error: { code: "CRITERIA_CONTEXT_REQUIRED", message: "Reload." }, review: minimalReview,
  }, 409) });
  await assert.rejects(minimal.match(confirmedProfile), e => {
    assert.deepEqual(e.review, minimalReview);
    return true;
  });
});

test("malformed_or_unrelated_errors_never_supply_recoverable_review", async () => {
  const question = serverReview.questions[0];
  const malformed = [
    null, [], {}, criteriaReview,
    { ...serverReview, targetSnapshotId: "criteria-wrong" },
    { ...serverReview, fromSnapshotId: null },
    { ...serverReview, questions: null },
    { ...serverReview, questions: [question, question] },
    { ...serverReview, extra: "unexpected" },
    ...[
      { skillId: "Not a slug" }, { name: "" }, { roleIds: [] }, { roleIds: ["QA"] },
      { why: "" }, { evidenceIds: [42] }, { evidenceIds: ["bad id"] },
      { state: "have" }, { extra: "unexpected" },
    ].map(change => ({ ...serverReview, questions: [{ ...question, ...change }] })),
  ];
  const cases = [
    ...malformed.map(review => ({ status: 409, code: "CRITERIA_CONTEXT_REQUIRED", review })),
    { status: 400, code: "CRITERIA_CONTEXT_REQUIRED", review: serverReview },
    { status: 409, code: "CRITERIA_UNAVAILABLE", review: serverReview },
    { status: 503, code: "TRENDS_UNAVAILABLE", review: serverReview },
  ];
  for (const entry of cases) {
    let attempts = 0;
    const api = makeClient({ fetchImpl: async () => {
      attempts++;
      return json({ error: { code: entry.code, message: "Cannot continue." }, review: entry.review }, entry.status);
    } });
    await assert.rejects(api.match(confirmedProfile), error => {
      assert.equal(error.status, entry.status);
      assert.equal(error.code, entry.code);
      assert.equal(error.review, null, JSON.stringify(entry));
      return true;
    });
    assert.equal(attempts, 1);
  }
});

test("refresh_sends_no_personal_fields", async () => {
  const calls = [];
  const api = makeClient({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return json(criteria);
  } });
  assert.deepEqual(await api.trends(), criteria);
  assert.deepEqual(await api.refreshTrends({ profile: confirmedProfile, url: "https://fixture.example/private" }), criteria);
  assert.deepEqual(calls.map(c => c.url), ["/api/trends", "/api/trends/refresh"]);
  assert.equal(calls[1].options.method, "POST");
  const refreshBody = JSON.parse(calls[1].options.body);
  assert.deepEqual(refreshBody, {});
});

test("ordinary_network_and_non_json_errors_remain_errors", async () => {
  const cases = [
    { fetchImpl: async () => { throw new TypeError("offline"); }, code: "NETWORK", status: 0 },
    { fetchImpl: async () => new Response("not JSON"), code: "INTERNAL_ERROR", status: 200 },
    { fetchImpl: async () => new Response("bad gateway", { status: 502 }), code: "INTERNAL_ERROR", status: 502 },
    { fetchImpl: async () => json(null), code: "INTERNAL_ERROR", status: 200 },
    { fetchImpl: async () => json({ error: { code: "INVALID_INPUT", message: "Invalid profile." } }, 400), code: "INVALID_INPUT", status: 400 },
  ];
  for (const entry of cases) {
    const api = makeClient({ fetchImpl: entry.fetchImpl });
    await assert.rejects(api.roles(), error => {
      assert.ok(error instanceof client.ApiError);
      assert.equal(error.code, entry.code);
      assert.equal(error.status, entry.status);
      assert.deepEqual(error.details, []);
      assert.equal(error.review, null);
      return true;
    });
  }
  const legacyError = new client.ApiError("INVALID_INPUT", "Existing caller");
  assert.deepEqual(legacyError.details, []);
  assert.equal(legacyError.status, 0);
  assert.equal(legacyError.review, null);
});

test("extract_keeps_multipart_upload_and_returns_the_draft", async () => {
  const draft = { status: "draft", extractedSkills: [], projects: [], experience: [], warnings: ["Fictional test CV."] };
  let sent;
  const api = makeClient({ fetchImpl: async (url, options) => {
    sent = { url, options };
    return json(draft);
  } });
  const file = new File(["Fictional CV for transport testing."], "fictional-cv.txt", { type: "text/plain" });
  assert.deepEqual(await api.extract(file), draft);
  assert.equal(sent.url, "/api/profile/extract");
  assert.equal(sent.options.method, "POST");
  assert.equal(sent.options.headers, undefined, "fetch supplies the multipart boundary");
  assert.ok(sent.options.body instanceof FormData);
  assert.deepEqual([...sent.options.body.keys()], ["cv"]);
  assert.equal(sent.options.body.get("cv").name, "fictional-cv.txt");
  assert.equal(await sent.options.body.get("cv").text(), "Fictional CV for transport testing.");
});
