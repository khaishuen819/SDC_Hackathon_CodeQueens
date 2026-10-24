import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import * as fixture from "../fixtures/criteria-server.mjs";
import { createApi } from "../public/js/api.js";
import { createCriteriaFlow } from "../public/js/criteria-flow.js";
import { buildConfirmedProfile, reviewModel, skillCatalogue } from "../public/js/profile.js";
import { VersionedRolesResponse } from "../../src/server/contracts/roles.ts";
import { VersionedMatchResponse } from "../../src/server/contracts/match.ts";
import { VersionedPathwayResponse } from "../../src/server/contracts/pathway.ts";

async function start(t, options) {
  assert.equal(typeof fixture.startCriteriaFixtureServer, "function", "the local real-route fixture server is missing");
  const server = await fixture.startCriteriaFixtureServer(options);
  t.after(() => server.close());
  return server;
}
async function sample(name = "backend-graduate.txt") {
  const bytes = await readFile(new URL(`../public/samples/${name}`, import.meta.url));
  return new File([bytes], name, { type: "text/plain" });
}
async function confirmed(api, route = "qa-automation") {
  const draft = await api.extract(await sample());
  const catalogue = skillCatalogue(await api.roles());
  const model = reviewModel(draft, catalogue);
  return { draft, profile: buildConfirmedProfile({ choices: model.choices, levels: {},
    foundIds: model.found.map(s => s.skillId), route, now: new Date("2026-10-24T10:00:00Z") }) };
}

test("the_fixture_import_does_not_start_a_server_or_need_production_configuration", () => {
  const url = new URL("../fixtures/criteria-server.mjs", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `await import(${JSON.stringify(url)});`], {
    timeout: 10_000, encoding: "utf8", env: { SystemRoot: process.env.SystemRoot ?? "" },
  });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "");
});

test("the_loopback_server_serves_real_assets_and_a_persistent_fictional_banner", async t => {
  const server = await start(t);
  assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.match(server.snapshotId, /^criteria-[a-f0-9]{64}$/);
  for (const path of ["/", "/fixtures/coverage/", "/fixtures/historical/", "/fixtures/prerequisite/", "/fixtures/empty/"]) {
    const response = await fetch(server.url + path);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /FICTIONAL \/ NOT LIVE EVIDENCE/);
    assert.ok(html.indexOf("FICTIONAL / NOT LIVE EVIDENCE") < html.indexOf('<main id="app"'));
    assert.match(html, /<base href="\/">/);
    assert.match(html, /CQ_API_BASE/);
    assert.doesNotMatch(html, /href="https:\/\/fonts\./);
  }
  const js = await fetch(server.url + "/js/app.js");
  assert.equal(js.status, 200);
  assert.match(js.headers.get("content-type"), /javascript/);
  assert.match(await js.text(), /createCriteriaFlow/);
  for (const path of ["/.env", "/package.json", "/fixtures/missing/"]) assert.equal((await fetch(server.url + path)).status, 404);
});

test("real_HTTP_client_and_coordinator_cover_50_to_100_without_another_upload_or_refresh", async t => {
  const server = await start(t), calls = [];
  const api = createApi({ base: server.url, fetchImpl: (url, options) => {
    calls.push({ url, options }); return fetch(url, options);
  } });
  const { draft, profile } = await confirmed(api);
  assert.match(draft.warnings.join(" "), /synthetic|fictional/i);
  const flow = createCriteriaFlow(api), initial = await flow.confirm(profile);
  VersionedRolesResponse.parse(initial.rolesResponse);
  VersionedMatchResponse.parse(initial.matchResponse);
  assert.equal(initial.status, "ready");
  assert.equal(initial.profile.preferredRouteId, "qa-automation");
  assert.deepEqual(initial.matchResponse.roles.map(r => [r.roleId, r.score]), [["backend-development", 100], ["qa-automation", 50]]);
  assert.ok(initial.review.questions.some(q => q.skillId === "fixture-skill-1"));
  for (const answer of ["not-sure", "not-yet"]) {
    const review = { targetSnapshotId: initial.snapshotId, answers: [{ skillId: "fixture-skill-1", answer }] };
    const ready = await flow.updatePossession(initial.profile, review);
    const path = await flow.loadPathway(ready.profile, "qa-automation", review);
    VersionedPathwayResponse.parse(path.pathway);
    assert.equal(path.status, "ready");
    assert.equal(ready.matchResponse.roles.find(r => r.roleId === "qa-automation").score, 50);
    assert.equal(path.pathway.steps[0].possessionState, answer === "not-yet" ? "not-yet" : "unconfirmed");
  }
  const ready = await flow.updatePossession(initial.profile, { targetSnapshotId: initial.snapshotId,
    answers: [{ skillId: "fixture-skill-1", answer: "have" }] });
  assert.equal(ready.matchResponse.roles.find(r => r.roleId === "qa-automation").score, 100);
  assert.equal(ready.snapshotId, initial.snapshotId);
  assert.equal(ready.profile.preferredRouteId, "qa-automation");
  assert.equal(calls.filter(c => c.url.endsWith("/api/profile/extract")).length, 1);
  assert.equal(calls.filter(c => c.url.endsWith("/api/trends/refresh")).length, 1);
  assert.deepEqual(JSON.parse(calls.find(c => c.url.endsWith("/api/trends/refresh")).options.body), {});
});

test("the_explorer_and_historical_scenarios_keep_retained_canonical_skills_recognised", async t => {
  const server = await start(t);
  const api = createApi({ base: server.url + "/fixtures/historical" });
  const { profile } = await confirmed(api, "explore");
  const ready = await createCriteriaFlow(api).confirm(profile);
  assert.equal(ready.profile.entryPath, "exploring");
  assert.equal(Object.hasOwn(ready.profile, "preferredRouteId"), false);
  assert.ok(ready.profile.confirmedSkills.some(s => s.skillId === "api-basics"));
  assert.ok(ready.rolesResponse.recognisedSkills.some(s => s.skillId === "api-basics"));
  assert.ok(ready.rolesResponse.roles.every(role => !role.skills.some(s => s.skillId === "api-basics")));
  assert.ok(ready.matchResponse.roles.every(role => role.score === 0), "recognition alone cannot add scored requirements");
});

test("the_prerequisite_scenario_uses_real_ordering_and_explicitly_synthetic_partial_metadata", async t => {
  const server = await start(t), api = createApi({ base: server.url + "/fixtures/prerequisite" });
  const { profile } = await confirmed(api), flow = createCriteriaFlow(api), ready = await flow.confirm(profile);
  const view = await flow.loadPathway(ready.profile, "qa-automation", { targetSnapshotId: ready.snapshotId, answers: [] });
  assert.deepEqual(view.pathway.steps.map(s => s.skillId), ["fixture-skill-2", "fixture-skill-1"]);
  assert.equal(view.pathway.steps[0].isPrerequisite, true);
  assert.ok(!ready.rolesResponse.roles.find(r => r.roleId === "qa-automation").skills.some(s => s.skillId === "fixture-skill-2"));
  assert.equal(ready.matchResponse.roles.find(r => r.roleId === "qa-automation").score, 50);
  assert.equal(ready.criteria.status, "partial");
  assert.equal(ready.criteria.deferredItemCount, 1);
  assert.equal(ready.criteria.quarantinedItemCount, 1);
  assert.match(ready.criteria.notices.join(" "), /fictional|synthetic/i);
  assert.equal(view.evidence.items[0].datePrecision, "year");
  assert.equal(view.evidence.items[0].originalDate, "2020");
  assert.equal(view.evidence.items[0].publishedDate, null);
  assert.equal(view.evidence.items[0].publishedAt, null);
});

test("an_empty_store_returns_real_unavailable_errors_and_cannot_fake_a_recommendation", async t => {
  const server = await start(t, { scenario: "empty" });
  assert.equal(server.snapshotId, null);
  const api = createApi({ base: server.url });
  await assert.rejects(api.roles(), e => e.status === 503 && e.code === "TRENDS_UNAVAILABLE");
  await assert.rejects(createCriteriaFlow(api).confirm({ status: "confirmed", confirmedSkills: [], addedSkillIds: [],
    removedSkillIds: [], unconfirmedSkillIds: [], entryPath: "exploring", confirmedAt: "2026-10-24T10:00:00Z" }),
  e => e.status === 503 && e.code === "TRENDS_UNAVAILABLE");
});
