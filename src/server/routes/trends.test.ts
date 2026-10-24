import test from "node:test";
import assert from "node:assert/strict";
import { createTrendsRouter } from "./trends.ts";
import { startApp, request, criteriaHarness } from "./criteriaTestSupport.ts";
import { createRefreshService } from "../trends/refreshService.ts";
import { prepareCriteriaRequest, createCriteriaContextLoader } from "../trends/context.ts";
import { MemoryCriteriaStore } from "../trends/snapshotStore.ts";
import { context, profile } from "../trends/testFixtures.ts";
import { TrendMeta } from "../contracts/criteria.ts";

test("trends HTTP returns real busy/cooldown metadata without fetching or interpreting", async () => {
  const h = await criteriaHarness();
  const fixture = context();
  const svc = createRefreshService({ store: h.store, reference: fixture.reference, config: fixture.config,
    fetcher: async () => { throw new Error("must not fetch"); },
    interpreter: { model: "fictional", interpretBatch: async () => { throw new Error("must not interpret"); } } });
  const base = await startApp(createTrendsRouter({ ...svc, reconcile: async (p, review) => {
    const ready = await prepareCriteriaRequest(p, { criteriaReview: review }, h);
    return { ...ready.result, criteria: ready.context.meta };
  } }));
  const r = await h.store.reserveRefresh();
  if (r.status !== "acquired") throw new Error("fixture reservation failed");
  const busy = await request(base, "/api/trends/refresh", {});
  assert.equal(busy.status, 200);
  assert.equal(TrendMeta.parse(busy.body).refreshControl.state, "busy");
  await h.store.releaseRefresh(r.generation);
  const cooldown = await request(base, "/api/trends/refresh", {});
  assert.equal(cooldown.status, 200);
  assert.equal(cooldown.body.refreshControl.state, "cooldown");
  assert.equal((await h.store.readRefreshState()).nextGeneration, 1n);
  const status = await request(base, "/api/trends");
  assert.equal(status.body.snapshotId, h.id);
  const invalid = await request(base, "/api/trends/refresh", { url: "https://untrusted.example", profile: {} });
  assert.equal(invalid.status, 400);
  assert.equal((await h.store.readRefreshState()).nextGeneration, 1n);
});

test("reconcile is optional-answer guidance and returns an updated profile without storing it", async () => {
  const h = await criteriaHarness(), fixture = context();
  const svc = createRefreshService({ store: h.store, reference: fixture.reference, config: fixture.config, fetcher: fetch, interpreter: null });
  const base = await startApp(createTrendsRouter({ ...svc, reconcile: async (p, review) => {
    const ready = await prepareCriteriaRequest(p, { criteriaReview: review }, h);
    return { ...ready.result, criteria: ready.context.meta };
  } }));
  const before = JSON.stringify(await h.store.readSnapshot());
  const response = await request(base, "/api/trends/reconcile", { profile: profile(["api-basics"]), review: { targetSnapshotId: h.id } });
  assert.equal(response.status, 200);
  assert.equal(response.body.review.questions[0].state, "unanswered");
  const later = await request(base, "/api/trends/reconcile", { profile: profile(["api-basics"]), review: { targetSnapshotId: h.id, answers: [{ skillId: "fixture-skill-1", answer: "have" }] } });
  assert.equal(later.status, 200);
  assert.deepEqual(later.body.profile.confirmedSkills.map((s: any) => s.skillId), ["api-basics", "fixture-skill-1"]);
  assert.equal(JSON.stringify(await h.store.readSnapshot()), before);
  assert.doesNotMatch(JSON.stringify((await h.store.readRefreshState()).state), /confirmedSkills|confirmedAt|answers/);
});

test("no initial snapshot returns 503 for status and refresh instead of fake current criteria", async () => {
  const store = new MemoryCriteriaStore(), fixture = context();
  const svc = createRefreshService({ store, reference: fixture.reference, config: fixture.config, fetcher: fetch, interpreter: null });
  const base = await startApp(createTrendsRouter({ ...svc, reconcile: async () => { throw new Error("unused"); } }));
  for (const result of [await request(base, "/api/trends"), await request(base, "/api/trends/refresh", {})]) {
    assert.equal(result.status, 503);
    assert.equal(result.body.error.code, "TRENDS_UNAVAILABLE");
  }
  await assert.rejects(createCriteriaContextLoader({ store, disabled: true })(), { code: "TRENDS_UNAVAILABLE" });
});

test("storage read and reservation failures return sanitized503 without logging private details", async (t) => {
  const logged: unknown[] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });
  for (const boundary of ["status", "reservation"] as const) {
    const h = await criteriaHarness(), fixture = context();
    if (boundary === "status") h.store.readRefreshState = async () => { throw new Error("FICTIONAL_PRIVATE_DB_DETAIL"); };
    else h.store.reserveRefresh = async () => { throw new Error("FICTIONAL_PRIVATE_DB_DETAIL"); };
    const svc = createRefreshService({ store: h.store, reference: fixture.reference, config: fixture.config,
      fetcher: async () => { throw new Error("must not fetch"); },
      interpreter: { model: "fictional", interpretBatch: async () => { throw new Error("must not interpret"); } } });
    const base = await startApp(createTrendsRouter({ ...svc, reconcile: async () => { throw new Error("unused"); } }));
    const result = boundary === "status" ? await request(base, "/api/trends") : await request(base, "/api/trends/refresh", {});
    assert.equal(result.status, 503);
    assert.equal(result.body.error.code, "TRENDS_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(result.body), /FICTIONAL_PRIVATE_DB_DETAIL/);
  }
  assert.equal(logged.length, 0, "handled storage outages must not reach the raw unexpected-error logger");
});
