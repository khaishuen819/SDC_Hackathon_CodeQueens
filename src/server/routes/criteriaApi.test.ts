import test from "node:test";
import assert from "node:assert/strict";
import { createCriteriaApiRouter } from "./criteriaApi.ts";
import { startApp, request, criteriaHarness } from "./criteriaTestSupport.ts";
import { bundle, context, profile } from "../trends/testFixtures.ts";
import { MemoryCriteriaStore } from "../trends/snapshotStore.ts";

test("the composed API pins all readers and extracts CVs against the full recognition registry", async () => {
  const h = await criteriaHarness(), fixture = context(), b = bundle(2);
  for (const r of b.roles) r.skills = r.skills.filter((s) => s.skillId !== "api-basics");
  for (const d of b.criteriaDecisions) if (d.skillId === "api-basics") d.action = "retire";
  const current = await h.publish(b);
  const base = await startApp(createCriteriaApiRouter({ store: h.store, reference: fixture.reference, config: fixture.config,
    fetcher: async () => { throw new Error("No external requests in integration tests."); }, interpreter: null,
    adapter: { name: "mock", extractProfile: async (_text, catalogue) => {
      assert.ok(catalogue.some((s) => s.id === "api-basics" && s.name === "API basics"), "extraction recognises retired skills");
      return { status: "draft", extractedSkills: [{ skillId: "api-basics", rawName: "API basics", evidence: "FICTIONAL CV", confidence: 0.9 }], projects: [], experience: [], warnings: [] };
    } } }));
  for (const path of ["/api/roles", "/api/evidence", "/api/sdg"]) {
    const old = await request(base, `${path}?snapshotId=${h.id}`);
    assert.equal(old.status, 200); assert.equal(old.body.criteria.snapshotId, h.id);
    assert.equal((await request(base, path)).body.criteria.snapshotId, current);
  }
  const match = await request(base, "/api/match", { ...profile(["api-basics"]), snapshotId: h.id });
  const pathway = await request(base, "/api/pathway", { profile: profile(["api-basics"]), roleId: "qa-automation", snapshotId: h.id });
  assert.equal(match.status, 200); assert.equal(pathway.status, 200);
  assert.deepEqual([match.body.criteria.snapshotId, pathway.body.criteria.snapshotId], [h.id, h.id]);
  assert.deepEqual(match.body.roles.map((r: any) => r.score), [50, 50]);
  const form = new FormData(); form.set("cv", new Blob(["FICTIONAL CV: demonstrated API basics in a synthetic student project."], { type: "text/plain" }), "fictional.txt");
  const extracted = await fetch(`${base}/api/profile/extract`, { method: "POST", body: form });
  assert.equal(extracted.status, 200); assert.equal((await extracted.json()).extractedSkills[0].skillId, "api-basics");
  assert.equal((await request(base, "/api/trends")).body.snapshotId, current);
});

test("a real failed refresh after 26 hours keeps source-backed scores and pathways available", async () => {
  const h = await criteriaHarness(), fixture = context();
  h.advance(26 * 60 * 60 * 1000);
  const base = await startApp(createCriteriaApiRouter({ store: h.store, reference: fixture.reference, config: fixture.config, now: h.now,
    fetcher: async () => new Response("unavailable", { status: 503 }),
    interpreter: { model: "fictional", interpretBatch: async () => { throw new Error("No source means no model call."); } },
    adapter: { name: "mock", extractProfile: async () => { throw new Error("unused"); } } }));
  const refreshed = await request(base, "/api/trends/refresh", {});
  assert.equal(refreshed.status, 200); assert.equal(refreshed.body.status, "partial");
  assert.equal(refreshed.body.snapshotId, h.id);
  assert.ok(refreshed.body.providers.every((p: any) => p.status === "failed"));
  const match = await request(base, "/api/match", { ...profile(["api-basics"]), snapshotId: h.id });
  const pathway = await request(base, "/api/pathway", { profile: profile(["api-basics"]), roleId: "qa-automation", snapshotId: h.id });
  assert.equal(match.status, 200); assert.equal(pathway.status, 200);
  assert.deepEqual(match.body.roles.map((r: any) => r.score), [50, 50]);
  assert.deepEqual(pathway.body.steps[0].evidence, [{ evidenceId: "fictional-evidence" }]);
});

test("the composed API reports unavailable on an empty store and never bootstraps implicitly", async () => {
  const store = new MemoryCriteriaStore(), fixture = context();
  const base = await startApp(createCriteriaApiRouter({ store, reference: fixture.reference, config: fixture.config, fetcher: fetch, interpreter: null,
    adapter: { name: "mock", extractProfile: async () => { throw new Error("unused"); } } }));
  for (const path of ["/api/roles", "/api/evidence", "/api/sdg", "/api/trends"]) {
    const result = await request(base, path);
    assert.equal(result.status, 503); assert.equal(result.body.error.code, "TRENDS_UNAVAILABLE");
  }
  assert.equal(await store.readSnapshot(), null);
});
