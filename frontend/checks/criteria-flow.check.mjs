// Fictional API boundary fixtures; browser/layout and real HTTP acceptance are separate.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as flowModule from "../public/js/criteria-flow.js";
import { api as browserApi, ApiError } from "../public/js/api.js";
import { mergeSkillAnswers } from "../public/js/trends.js";

const S = "criteria-" + "a".repeat(64), T = "criteria-" + "b".repeat(64);
const profile = {
  status: "confirmed", confirmedSkills: [{ skillId: "api-basics" }],
  removedSkillIds: [], addedSkillIds: [], unconfirmedSkillIds: [],
  entryPath: "preferred-route", preferredRouteId: "qa-automation", confirmedAt: "2026-10-24T10:00:00Z",
};
const scoreMeaning = "The score is the percentage of this role's listed skills confirmed in your profile; each skill counts once. " +
  "Unconfirmed skills receive no credit yet and can be updated later. It is not a proficiency assessment or hiring probability.";
const meta = (id = S, extra = {}) => ({
  snapshotId: id, policyVersion: "count-coverage-v1", status: "disabled", providers: [], notices: [],
  lastSuccessfulCheckAt: null, lastAttemptAt: null, deferredItemCount: 0, quarantinedItemCount: 0,
  refreshControl: { state: "ready", retryAt: null }, ...extra,
});
const review = (id = S) => ({ targetSnapshotId: id, questions: [{
  skillId: "test-design", name: "Test design", roleIds: ["qa-automation"],
  why: "Fictional task bridge.", evidenceIds: ["fixture-evidence"], state: "unanswered",
}] });
const requestReview = (id = S, answers = []) => ({ targetSnapshotId: id, answers });
const roles = (id = S) => ({
  isPlaceholder: true, criteria: meta(id), recognisedSkills: [
    { skillId: "api-basics", name: "API basics" }, { skillId: "test-design", name: "Test design" },
    { skillId: "historical-skill", name: "Historical skill" },
  ],
  roles: [
    { roleId: "backend-development", name: "Backend Development", description: "Fictional", isPlaceholder: true,
      skills: [{ skillId: "api-basics", name: "API basics", weight: 1, isRequired: true }] },
    { roleId: "qa-automation", name: "QA Automation", description: "Fictional", isPlaceholder: true,
      skills: [{ skillId: "api-basics", name: "API basics", weight: 1, isRequired: true },
        { skillId: "test-design", name: "Test design", weight: 1, isRequired: true }] },
  ],
});
const match = (id = S) => ({
  criteria: meta(id), review: review(id), scoreMeaning, isPlaceholder: true,
  roles: [
    { roleId: "backend-development", rank: 1, score: 100, scoreExplanation: "Fictional 1/1.", preferredRouteKept: false,
      strengths: [{ skillId: "api-basics", weight: 1, isRequired: true }], gaps: [], unconfirmedSkills: [], evidence: [] },
    { roleId: "qa-automation", rank: 2, score: 50, scoreExplanation: "Fictional 1/2.", preferredRouteKept: true,
      strengths: [{ skillId: "api-basics", weight: 1, isRequired: true }],
      gaps: [{ skillId: "test-design", weight: 1, isRequired: true }], unconfirmedSkills: [], evidence: [] },
  ],
});
const pathway = (id = S, roleId = "qa-automation") => ({
  criteria: meta(id), review: review(id), roleId, isPlaceholder: true,
  steps: [{ order: 1, skillId: "test-design", why: "Fictional learning step.", estimatedHours: null,
    resources: [], prerequisites: [], evidence: [], possessionState: "unconfirmed" }],
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(overrides = {}) {
  const calls = [];
  const defaults = {
    refreshTrends: async () => meta(), roles: async (id = S) => roles(id),
    reconcile: async (p, r) => ({ status: "ready", profile: mergeSkillAnswers(p, r.answers ?? []),
      snapshotId: r.targetSnapshotId, review: review(r.targetSnapshotId), criteria: meta(r.targetSnapshotId) }),
    match: async (_p, c) => match(c.snapshotId), pathway: async (_p, role, c) => pathway(c.snapshotId, role),
    evidence: async id => ({ criteria: meta(id), items: [] }),
    sdg: async id => ({ criteria: meta(id), goals: [], roleTags: [], skillTags: [] }),
  };
  const api = Object.fromEntries(Object.keys(defaults).map(name => [name, async (...args) => {
    calls.push({ name, args: structuredClone(args) });
    return (overrides[name] ?? defaults[name])(...args);
  }]));
  return { api, calls, defaults };
}
function create(api) {
  assert.equal(typeof flowModule.createCriteriaFlow, "function", "the version coordinator is missing");
  return flowModule.createCriteriaFlow(api);
}
const contextError = id => new ApiError("CRITERIA_CONTEXT_REQUIRED", "Reload the catalogue.", [], { status: 409, review: review(id) });

test("confirm_refreshes_once_then_pins_roles_reconcile_match", async () => {
  const authoritative = { ...profile, unconfirmedSkillIds: ["test-design"] };
  const h = harness({ reconcile: async (_p, r) => ({ status: "ready", profile: authoritative,
    snapshotId: r.targetSnapshotId, criteria: meta(), review: review() }) });
  const ready = await create(h.api).confirm(profile, { fromSnapshotId: T });
  assert.deepEqual(h.calls.map(c => c.name), ["refreshTrends", "roles", "reconcile", "match"]);
  assert.equal(ready.status, "ready");
  assert.deepEqual(ready.profile, authoritative);
  assert.deepEqual(h.calls[1].args, [S]);
  assert.deepEqual(h.calls[2].args, [profile, { fromSnapshotId: T, targetSnapshotId: S, answers: [] }]);
  assert.deepEqual(h.calls[3].args, [authoritative, { snapshotId: S, criteriaReview: { fromSnapshotId: T, targetSnapshotId: S, answers: [] } }]);
  assert.deepEqual([ready.snapshotId, ready.rolesResponse.criteria.snapshotId, ready.criteria.snapshotId,
    ready.matchResponse.criteria.snapshotId, ready.review.targetSnapshotId], [S, S, S, S, S]);
  assert.equal(ready.review.questions.length, 1, "optional questions must not gate results");
});

test("context_retry_is_once_without_another_refresh", async () => {
  let attempts = 0;
  const h = harness({ match: async (_p, c) => { if (++attempts === 1) throw contextError(T); return match(c.snapshotId); } });
  const ready = await create(h.api).confirm(profile);
  assert.equal(ready.snapshotId, T);
  assert.equal(h.calls.filter(c => c.name === "refreshTrends").length, 1);
  assert.deepEqual(h.calls.filter(c => c.name === "roles").map(c => c.args[0]), [S, T]);
  assert.equal(attempts, 2);
  let failures = 0;
  const second = harness({ match: async () => { failures++; throw contextError(T); } });
  await assert.rejects(create(second.api).confirm(profile), e => e.code === "CRITERIA_CONTEXT_REQUIRED");
  assert.equal(failures, 2, "a second conflict must surface instead of looping");
  assert.equal(second.calls.filter(c => c.name === "refreshTrends").length, 1);
});

test("ordinary_and_malformed_errors_never_trigger_context_recovery", async () => {
  for (const error of [new ApiError("CRITERIA_UNAVAILABLE", "Unknown.", [], { status: 409 }),
    new ApiError("NETWORK", "Offline."),
    new ApiError("CRITERIA_CONTEXT_REQUIRED", "Malformed.", [], { status: 409, review: { targetSnapshotId: S, answers: [] } }),
  ]) {
    const h = harness({ match: async () => { throw error; } });
    await assert.rejects(create(h.api).confirm(profile), e => e === error);
    assert.equal(h.calls.filter(c => c.name === "match").length, 1);
    assert.equal(h.calls.filter(c => c.name === "roles").length, 1);
  }
});

test("stale_replies_never_commit_caches_or_results", async () => {
  for (const stage of ["refreshTrends", "roles", "reconcile", "match"]) {
    const gate = deferred(), entered = deferred();
    let first = true, refreshes = 0, pendingArgs;
    const overrides = { refreshTrends: async () => meta(++refreshes === 1 ? S : T) };
    const h = harness(overrides);
    const normal = stage === "refreshTrends" ? overrides.refreshTrends : h.defaults[stage];
    overrides[stage] = async (...args) => {
      if (first) { first = false; pendingArgs = args; entered.resolve(); return gate.promise; }
      return stage === "refreshTrends" ? meta(T) : normal(...args);
    };
    const flow = create(h.api), old = flow.confirm(profile);
    await entered.promise;
    const latest = await flow.confirm(profile);
    const count = h.calls.length;
    gate.resolve(stage === "refreshTrends" ? meta(S) : await normal(...pendingArgs));
    assert.deepEqual(await old, { status: "stale" }, stage);
    assert.equal(latest.snapshotId, T);
    assert.equal(h.calls.length, count, "a stale result must not start another dependent request");
  }
});

test("late_pathway_and_panel_replies_are_discarded_after_invalidation", async () => {
  for (const stage of ["pathway", "evidence", "sdg"]) {
    const gate = deferred(), entered = deferred();
    const h = harness({ [stage]: async () => { entered.resolve(); return gate.promise; } });
    const flow = create(h.api), pending = flow.loadPathway(profile, "qa-automation", requestReview());
    await entered.promise;
    flow.invalidate();
    gate.resolve(stage === "pathway" ? pathway() : await h.defaults[stage](S));
    assert.deepEqual(await pending, { status: "stale" });
  }
});

test("later_have_uses_the_same_snapshot_and_full_answer_ledger", async () => {
  const answers = [{ skillId: "historical-skill", answer: "not-yet" }, { skillId: "test-design", answer: "have" }];
  const h = harness(), flow = create(h.api);
  const ready = await flow.updatePossession(profile, requestReview(S, answers));
  assert.deepEqual(h.calls.map(c => c.name), ["roles", "reconcile", "match"]);
  assert.deepEqual(ready.profile.confirmedSkills.map(s => s.skillId), ["api-basics", "test-design"]);
  assert.equal(ready.profile.preferredRouteId, "qa-automation");
  assert.deepEqual(h.calls[2].args[1].criteriaReview.answers, answers);
  const moved = harness({ match: async () => { throw contextError(T); } });
  await assert.rejects(create(moved.api).updatePossession(profile, requestReview(S, answers)), e => {
    assert.equal(e.code, "CRITERIA_CONTEXT_REQUIRED");
    assert.match(e.message, /update|reload/i);
    return true;
  });
  assert.deepEqual(moved.calls.filter(c => c.name === "roles").map(c => c.args[0]), [S], "a possession edit cannot silently switch versions");
});

test("pathway_keeps_optional_panel_failures_explicit_and_pinned", async () => {
  const unavailable = new ApiError("TRENDS_UNAVAILABLE", "Unavailable.", [], { status: 503 });
  const h = harness({ evidence: async () => { throw unavailable; }, sdg: async () => ({ ...await harness().defaults.sdg(T) }) });
  const view = await create(h.api).loadPathway(profile, "qa-automation", requestReview());
  assert.equal(view.status, "ready");
  assert.equal(view.snapshotId, S);
  assert.equal(view.pathway.criteria.snapshotId, S);
  assert.equal(view.evidence, null);
  assert.equal(view.sdg, null);
  assert.equal(view.panelErrors.evidence, unavailable);
  assert.ok(view.panelErrors.sdg instanceof ApiError);
  assert.ok(h.calls.every(c => c.name === "pathway" ? c.args[2].snapshotId === S : c.args[0] === S));
});

test("a_pathway_context_retry_stays_on_its_target_and_is_bounded", async () => {
  let attempts = 0;
  const h = harness({ pathway: async () => { if (++attempts === 1) throw contextError(S); return pathway(); } });
  const view = await create(h.api).loadPathway(profile, "qa-automation", requestReview());
  assert.equal(view.snapshotId, S);
  assert.equal(attempts, 2);
  assert.equal(h.calls.filter(c => c.name === "roles").length, 1, "one context reload before resubmission");
  assert.equal(h.calls.filter(c => c.name === "refreshTrends").length, 0);
  const moved = harness({ pathway: async () => { throw contextError(T); } });
  await assert.rejects(create(moved.api).loadPathway(profile, "qa-automation", requestReview()), e => e.code === "CRITERIA_CONTEXT_REQUIRED");
  assert.equal(moved.calls.filter(c => c.name === "pathway").length, 1);
});

test("mismatched_metadata_and_lost_recognition_never_produce_a_ready_view", async () => {
  const cases = [
    { roles: async () => roles(T) },
    { roles: async () => ({ ...roles(), recognisedSkills: [] }) },
    { roles: async () => ({ ...roles(), recognisedSkills: [{ skillId: "test-design", name: "Only one skill" }] }) },
    { reconcile: async () => ({ status: "ready", profile, snapshotId: T, review: review(T), criteria: meta(T) }) },
    { match: async () => match(T) },
    { match: async () => ({ ...match(), review: review(T) }) },
    { roles: async () => ({ ...roles(), roles: [] }), match: async () => ({ ...match(), roles: [] }) },
    { roles: async () => ({ ...roles(), roles: roles().roles.slice(0, 1) }),
      match: async () => ({ ...match(), roles: match().roles.slice(0, 1) }) },
    { match: async () => ({ ...match(), scoreMeaning: null }) },
  ];
  for (const override of cases) await assert.rejects(create(harness(override).api).confirm(profile), e => e instanceof ApiError);
  await assert.rejects(create(harness({ pathway: async () => pathway(T) }).api).loadPathway(profile, "qa-automation", requestReview()), e => e instanceof ApiError);
});

test("outage_keeps_saved_view_but_empty_or_unavailable_storage_does_not_fake_results", async () => {
  let current = meta(S, { status: "fresh", lastSuccessfulCheckAt: "2026-10-22T08:00:00Z" });
  const h = harness({
    refreshTrends: async () => current,
    roles: async id => ({ ...roles(id), criteria: current }),
    reconcile: async (p, r) => ({ status: "ready", profile: p, snapshotId: r.targetSnapshotId, review: review(), criteria: current }),
    match: async () => ({ ...match(), criteria: current }),
  });
  const flow = create(h.api), old = await flow.confirm(profile);
  current = meta(S, { status: "partial", lastSuccessfulCheckAt: "2026-10-22T08:00:00Z", lastAttemptAt: "2026-10-23T10:00:00Z",
    notices: ["Fictional source failure after 26 hours."] });
  const saved = await flow.confirm(old.profile, { fromSnapshotId: S });
  assert.equal(saved.snapshotId, S);
  assert.equal(saved.criteria.status, "partial");
  assert.equal(saved.matchResponse.roles[1].score, 50);
  assert.equal(old.criteria.status, "fresh");
  assert.equal(h.calls.filter(c => c.name === "roles").length, 2, "same-ID refresh must reload check metadata");
  for (const override of [async () => { throw new ApiError("TRENDS_UNAVAILABLE", "No baseline.", [], { status: 503 }); }, async () => meta(null, { status: "unavailable" })]) {
    const empty = harness({ refreshTrends: override });
    await assert.rejects(create(empty.api).confirm(profile), e => e.code === "TRENDS_UNAVAILABLE");
    assert.deepEqual(empty.calls.map(c => c.name), ["refreshTrends"]);
  }
});

test("response_questions_are_not_accepted_as_request_answers", async () => {
  const h = harness();
  await assert.rejects(create(h.api).updatePossession(profile, review()), e => e.code === "INVALID_INPUT");
  assert.deepEqual(h.calls, []);
});

test("invalid_answers_and_previous_versions_are_rejected_before_any_refresh", async () => {
  const h = harness(), flow = create(h.api);
  await assert.rejects(flow.updatePossession(profile, { targetSnapshotId: S, answers: null }), e => e.code === "INVALID_INPUT");
  await assert.rejects(flow.confirm(profile, { fromSnapshotId: "" }), e => e.code === "INVALID_INPUT");
  assert.deepEqual(h.calls, []);
});

test("actual_app_discards_late_reference_caches_and_pins_both_entry_paths", async () => {
  const handlers = new Map(), nodes = Object.fromEntries(["app", "stepper", "live"].map(id => [id, { innerHTML: "", textContent: "", querySelector: () => null }]));
  const oldGlobals = { window: globalThis.window, document: globalThis.document };
  const originalApi = { ...browserApi };
  const startup = deferred(), oldEvidence = deferred(), evidenceEntered = deferred();
  let roleReads = 0, evidenceReads = 0;
  const h = harness({
    roles: async (id = S) => { if (++roleReads === 1) return startup.promise; return roles(id); },
    evidence: async id => {
      if (++evidenceReads === 1) { evidenceEntered.resolve(); return oldEvidence.promise; }
      return { criteria: meta(id), items: [] };
    },
  });
  const draft = { status: "draft", extractedSkills: [{ skillId: "api-basics", rawName: "API", evidence: "Fictional CV", confidence: 1 }], projects: [], experience: [], warnings: [] };
  const settle = async () => { await new Promise(setImmediate); await new Promise(setImmediate); };
  const click = (action, rest = {}) => handlers.get("click")({ target: { closest: () => ({ dataset: { action, ...rest }, disabled: false }) } });
  const selectFile = () => handlers.get("change")({ target: { id: "cv-input", files: [{ name: "fictional.txt", size: 100 }] } });
  try {
    globalThis.window = { innerWidth: 1000, scrollTo() {}, confirm: () => true, addEventListener() {} };
    globalThis.document = { activeElement: null, body: { style: {} }, getElementById: id => nodes[id] ?? null,
      querySelector: () => null, addEventListener: (event, handler) => handlers.set(event, handler) };
    Object.assign(browserApi, h.api, { extract: async () => structuredClone(draft) });
    await import("../public/js/app.js?criteria-flow-check");
    click("restart");
    const stale = roles(); stale.roles[0].name = "STALE STARTUP ROLE";
    startup.resolve(stale); await settle();
    assert.ok(!nodes.app.innerHTML.includes("STALE STARTUP ROLE"));
    selectFile(); click("read"); await settle();
    assert.ok(nodes.app.innerHTML.includes("Check what we found"));
    click("route", { value: "qa-automation" }); click("confirm"); await settle();
    assert.ok(nodes.app.innerHTML.includes("Your route: QA Automation"));
    click("choose", { role: "qa-automation" }); await evidenceEntered.promise;
    click("restart");
    oldEvidence.resolve({ criteria: meta(), items: [{ title: "STALE EVIDENCE", publisher: "Fictional", url: "https://fixture.example/old",
      publishedDate: "2026-10-20", retrievedAt: "2026-10-24", supportedClaim: "Old fixture", limitation: "Fictional", linkedSkillIds: ["test-design"] }] });
    await settle();
    selectFile(); click("read"); await settle();
    click("route", { value: "explore" }); click("confirm"); await settle();
    assert.ok(nodes.app.innerHTML.includes("Routes that match your CV"));
    click("choose", { role: "qa-automation" }); await settle();
    assert.ok(nodes.app.innerHTML.includes("Sources and trend evidence"));
    assert.ok(!nodes.app.innerHTML.includes("STALE EVIDENCE"));
    assert.equal(evidenceReads, 2, "restart cannot reuse an old optional-panel cache");
    const matches = h.calls.filter(c => c.name === "match");
    assert.equal(matches.length, 2);
    assert.deepEqual(matches.map(c => c.args[1].snapshotId), [S, S]);
    assert.equal(matches[0].args[0].preferredRouteId, "qa-automation");
    assert.equal(matches[1].args[0].entryPath, "exploring");
    assert.ok(h.calls.filter(c => c.name === "pathway").every(c => c.args[2].snapshotId === S));
  } finally {
    Object.assign(browserApi, originalApi);
    for (const [key, value] of Object.entries(oldGlobals)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});

// Controlled API state for UI actions. These are fictional outcomes, not accuracy evidence.
function uiHarness({ prerequisite = false } = {}) {
  const model = { meta: meta(), failMatch: false, refresh: null, retireTestDesign: false };
  function guidance(p, r) {
    const answer = r.answers?.find(a => a.skillId === "test-design")?.answer;
    const known = p.confirmedSkills.some(s => s.skillId === "test-design");
    return { ...review(r.targetSnapshotId), ...(r.fromSnapshotId ? { fromSnapshotId: r.fromSnapshotId } : {}),
      questions: known || answer === "not-yet" || model.retireTestDesign ? [] : [{ ...review().questions[0],
        state: p.unconfirmedSkillIds.includes("test-design") ? "not-sure" : "unanswered" }] };
  }
  const criteria = id => ({ ...model.meta, snapshotId: id });
  const h = harness({
    refreshTrends: async () => model.refresh ? model.refresh() : structuredClone(model.meta),
    roles: async (id = S) => {
      const result = roles(id);
      if (model.retireTestDesign) result.roles[1].skills = result.roles[1].skills.filter(skill => skill.skillId !== "test-design");
      return { ...result, criteria: criteria(id) };
    },
    reconcile: async (p, r) => {
      const updated = mergeSkillAnswers(p, r.answers);
      return { status: "ready", profile: updated, snapshotId: r.targetSnapshotId,
        criteria: criteria(r.targetSnapshotId), review: guidance(updated, r) };
    },
    match: async (p, c) => {
      if (model.failMatch) throw new ApiError("TRENDS_UNAVAILABLE", "Fictional storage outage.", [], { status: 503 });
      const result = match(c.snapshotId), qa = result.roles[1];
      const have = p.confirmedSkills.some(s => s.skillId === "test-design"), unsure = p.unconfirmedSkillIds.includes("test-design");
      const skill = { skillId: "test-design", weight: 1, isRequired: true };
      qa.score = have ? 100 : 50;
      qa.strengths = have ? [...qa.strengths, skill] : qa.strengths;
      qa.gaps = !have && !unsure ? [skill] : [];
      qa.unconfirmedSkills = unsure ? [skill] : [];
      qa.scoreExplanation = have ? "Fictional confirmed coverage: 2/2." : "Fictional confirmed coverage: 1/2.";
      if (model.retireTestDesign) {
        qa.score = 100; qa.strengths = [qa.strengths[0]]; qa.gaps = []; qa.unconfirmedSkills = [];
        qa.scoreExplanation = "Fictional saved version retired a role association; the skill remains recognised.";
      }
      return { ...result, criteria: criteria(c.snapshotId), review: guidance(p, c.criteriaReview) };
    },
    pathway: async (p, role, c) => {
      const path = pathway(c.snapshotId, role);
      path.criteria = criteria(c.snapshotId); path.review = guidance(p, c.criteriaReview);
      if (model.retireTestDesign || p.confirmedSkills.some(s => s.skillId === "test-design")) path.steps = [];
      else if (prerequisite) {
        path.steps = [{ order: 1, skillId: "historical-skill", why: "Fictional foundation for the next step.",
          estimatedHours: 2, resources: [], prerequisites: [], isPrerequisite: true, estimateBasis: "app",
          estimateNote: "Fictional practice estimate.", evidence: [{ evidenceId: "fixture-evidence" }], possessionState: "unconfirmed" },
        { ...path.steps[0], order: 2, prerequisites: ["historical-skill"], estimatedHours: 3, estimateBasis: "provider",
          estimateNote: "Fictional provider duration.", resources: [{ resourceId: "fixture-resource", title: "Fictional tutorial",
            provider: "Fictional provider", url: "https://fixture.example/course", cost: "free", sourceNote: "Fictional fixture only.",
            isPlaceholder: false, checkedAt: "2026-10-24T08:00:00Z", estimateBasis: "provider", estimateNote: "Fictional duration." }] }];
      }
      return path;
    },
    evidence: async id => ({ criteria: criteria(id), items: prerequisite ? [{
      id: "fixture-evidence", title: "<img src=x onerror=alert(1)>", publisher: "Fictional publisher",
      url: "javascript:alert(1)", publishedDate: "2025-01-01", originalDate: "2025", publishedAt: null,
      datePrecision: "year", dateBasis: "published", retrievedAt: "2026-01-01", checkedAt: "2026-10-24T09:00:00Z",
      supportedClaim: "Fictional evidence only.", limitation: "No real-world claim.", linkedSkillIds: ["historical-skill", "test-design"],
    }] : [] }),
  });
  return { ...h, model };
}

async function mountUi(h, label) {
  const handlers = new Map(), nodes = Object.fromEntries(["app", "stepper", "live"].map(id => [id, { innerHTML: "", textContent: "", querySelector: () => null }]));
  const saved = { window: globalThis.window, document: globalThis.document, CSS: globalThis.CSS }, originalApi = { ...browserApi };
  globalThis.window = { innerWidth: 1000, scrollTo() {}, confirm: () => true, addEventListener() {} };
  globalThis.CSS = { escape: value => String(value) };
  globalThis.document = { activeElement: null, body: { style: {} }, getElementById: id => nodes[id] ?? null,
    querySelector: () => null, addEventListener: (event, handler) => handlers.set(event, handler) };
  Object.assign(browserApi, h.api, { extract: async () => {
    h.calls.push({ name: "extract", args: [] });
    return { status: "draft", extractedSkills: [{ skillId: "api-basics", rawName: "API", evidence: "Fictional CV", confidence: 1 }], projects: [], experience: [], warnings: [] };
  } });
  await import(`../public/js/app.js?ui-${label}`);
  const ui = {
    html: () => nodes.app.innerHTML,
    settle: async () => { await new Promise(setImmediate); await new Promise(setImmediate); },
    click: (action, rest = {}) => handlers.get("click")({ target: { closest: () => ({ dataset: { action, ...rest }, disabled: false }) } }),
    close() {
      Object.assign(browserApi, originalApi);
      for (const [key, value] of Object.entries(saved)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
    },
  };
  await ui.settle();
  handlers.get("change")({ target: { id: "cv-input", files: [{ name: "fictional.txt", size: 100 }] } });
  ui.click("read"); await ui.settle();
  ui.click("route", { value: "qa-automation" });
  return ui;
}

test("skill_controls_keep_learning_separate_and_update_coverage_without_another_CV", async () => {
  const h = uiHarness(), ui = await mountUi(h, "skills");
  try {
    ui.click("confirm"); await ui.settle();
    assert.match(ui.html(), /See why it matters/);
    assert.match(ui.html(), /Add to my learning plan/);
    assert.match(ui.html(), /Not now/);
    assert.doesNotMatch(ui.html(), /nice to have|weight 1/);
    const initialMatches = h.calls.filter(c => c.name === "match").length;
    ui.click("learning", { skill: "test-design", value: "add" }); await ui.settle();
    assert.match(ui.html(), /Added to your learning plan/);
    assert.match(ui.html(), /this session/i);
    assert.equal(h.calls.filter(c => c.name === "match").length, initialMatches);
    assert.match(ui.html(), /class="score">50</);
    ui.click("possession", { skill: "test-design", value: "not-yet" }); await ui.settle();
    assert.match(ui.html(), /Not yet/);
    ui.click("learning", { skill: "test-design", value: "not-now" }); await ui.settle();
    assert.match(ui.html(), /class="score">50</);
    ui.click("possession", { skill: "test-design", value: "not-sure" }); await ui.settle();
    assert.doesNotMatch(ui.html(), /you have every skill/i);
    assert.match(ui.html(), /class="score">50</);
    ui.click("possession", { skill: "test-design", value: "have" }); await ui.settle();
    assert.match(ui.html(), /class="score">100</);
    const matches = h.calls.filter(c => c.name === "match");
    assert.deepEqual(matches.at(-1).args[1].criteriaReview.answers, [{ skillId: "test-design", answer: "have" }]);
    assert.ok(matches.every(c => c.args[1].snapshotId === S));
    assert.equal(h.calls.filter(c => c.name === "refreshTrends").length, 1);
    assert.equal(h.calls.filter(c => c.name === "extract").length, 1);
    ui.click("go", { screen: "review" }); await ui.settle();
    assert.match(ui.html(), /aria-pressed="true"[^>]*data-action="choice"[^>]*data-skill="test-design"[^>]*data-value="have"/);
  } finally { ui.close(); }
});

test("an_initial_Not_sure_only_gap_is_never_presented_as_full_coverage", async () => {
  const h = uiHarness(), ui = await mountUi(h, "not-sure");
  try {
    ui.click("choice", { skill: "test-design", value: "notsure" });
    ui.click("confirm"); await ui.settle();
    assert.match(ui.html(), /class="score">50</);
    assert.doesNotMatch(ui.html(), /you have every skill/i);
    assert.match(ui.html(), /Not sure/);
  } finally { ui.close(); }
});

test("prerequisite_drawers_show_named_details_original_dates_and_estimate_basis_safely", async () => {
  const h = uiHarness({ prerequisite: true }), ui = await mountUi(h, "prerequisite");
  try {
    ui.click("confirm"); await ui.settle();
    const count = h.calls.filter(c => c.name === "match").length;
    ui.click("why", { skill: "test-design", role: "qa-automation" }); await ui.settle();
    assert.match(ui.html(), /id="drawer-title">Test design</);
    assert.equal(h.calls.filter(c => c.name === "match").length, count, "reading an explanation must not change possession");
    assert.match(ui.html(), /Provider-estimated/);
    assert.doesNotMatch(ui.html(), /href="https:\/\/fixture.example\/course"/);
    ui.click("close"); ui.click("open", { skill: "historical-skill" }); await ui.settle();
    assert.match(ui.html(), /id="drawer-title">Historical skill</);
    assert.match(ui.html(), /prerequisite/i);
    assert.match(ui.html(), /does not add.*coverage/i);
    assert.match(ui.html(), /App-estimated/);
    assert.match(ui.html(), /Published 2025 \(year only\)/);
    assert.match(ui.html(), /2026-10-24T09:00:00Z/);
    assert.doesNotMatch(ui.html(), /2025-01-01|checked 2026-01-01|href="javascript:|<img src=x/);
    assert.match(ui.html(), /&lt;img src=x/);
    assert.doesNotMatch(ui.html(), /ordered required first, then by weight|No reviewed trend evidence/);
  } finally { ui.close(); }
});

test("manual_updates_are_single_flight_and_honour_cooldown_without_timer_work", async () => {
  const h = uiHarness(), ui = await mountUi(h, "updates");
  try {
    ui.click("confirm"); await ui.settle();
    const gate = deferred();
    h.model.refresh = async () => gate.promise;
    ui.click("refresh"); ui.click("refresh"); await ui.settle();
    assert.equal(h.calls.filter(c => c.name === "refreshTrends").length, 2, "one initial refresh and one manual update");
    assert.match(ui.html(), /data-action="refresh"[^>]*disabled/);
    h.model.meta = meta(S, { status: "partial", refreshControl: { state: "cooldown", retryAt: "2099-10-24T10:01:00Z" } });
    gate.resolve(h.model.meta); await ui.settle();
    assert.match(ui.html(), /cooldown/);
    assert.match(ui.html(), /2099-10-24T10:01:00Z/);
    ui.click("refresh"); await ui.settle();
    assert.equal(h.calls.filter(c => c.name === "refreshTrends").length, 2);
  } finally { ui.close(); }
});

test("a_failed_possession_update_keeps_the_previous_profile_score_and_learning_choice", async () => {
  const h = uiHarness(), ui = await mountUi(h, "failed-answer");
  try {
    ui.click("confirm"); await ui.settle();
    ui.click("learning", { skill: "test-design", value: "add" });
    h.model.failMatch = true;
    ui.click("possession", { skill: "test-design", value: "have" }); await ui.settle();
    assert.match(ui.html(), /Fictional storage outage/);
    assert.match(ui.html(), /class="score">50</);
    assert.match(ui.html(), /Added to your learning plan/);
    h.model.failMatch = false;
    ui.click("possession", { skill: "test-design", value: "not-sure" }); await ui.settle();
    const sent = h.calls.filter(c => c.name === "match").at(-1).args[1].criteriaReview.answers;
    assert.deepEqual(sent, [{ skillId: "test-design", answer: "not-sure" }]);
  } finally { ui.close(); }
});

test("a_saved_version_without_the_open_station_closes_details_and_restores_scrolling", async () => {
  const h = uiHarness(), ui = await mountUi(h, "retired-detail");
  try {
    ui.click("confirm"); await ui.settle();
    ui.click("why", { skill: "test-design", role: "qa-automation" }); await ui.settle();
    assert.match(ui.html(), /role="dialog"/);
    h.model.retireTestDesign = true;
    h.model.meta = meta(T);
    ui.click("refresh"); await ui.settle();
    assert.doesNotMatch(ui.html(), /role="dialog"/);
    assert.equal(globalThis.document.body.style.overflow, "");
    assert.equal(h.calls.filter(c => c.name === "match").at(-1).args[1].snapshotId, T);
    assert.match(ui.html(), /QA Automation line/);
  } finally { ui.close(); }
});
