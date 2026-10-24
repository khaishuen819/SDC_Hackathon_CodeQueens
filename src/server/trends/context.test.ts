import test from "node:test";
import assert from "node:assert/strict";
import { createCriteriaContextLoader, prepareCriteriaRequest } from "./context.ts";
import { MemoryCriteriaStore, emptyPublicState } from "./snapshotStore.ts";
import { bundle, profile, NOW } from "./testFixtures.ts";

const UNKNOWN = `criteria-${"f".repeat(64)}`;
test("context rejects absent, unknown and malformed versions without a fabricated baseline", async () => {
  const store = new MemoryCriteriaStore();
  const load = createCriteriaContextLoader({ store, disabled: true });
  await assert.rejects(load(), { code: "TRENDS_UNAVAILABLE" });
  await assert.rejects(load(UNKNOWN), { code: "CRITERIA_UNAVAILABLE" });
  await assert.rejects(load("not-a-version"), { code: "INVALID_INPUT" });
  assert.equal(await store.readSnapshot(), null);
});

test("a retained pinned version stays usable and never inherits a newer version's check time", async () => {
  const store = new MemoryCriteriaStore({ now: () => Date.parse(NOW) });
  const old = await store.bootstrap(bundle(2));
  const r = await store.reserveRefresh();
  if (r.status !== "acquired") throw new Error("fixture reservation failed");
  const published = await store.publishIfCurrent(old, r.generation, bundle(3), emptyPublicState(), true);
  await store.releaseRefresh(r.generation);
  const load = createCriteriaContextLoader({ store, disabled: false, now: () => Date.parse(NOW) });
  const pinned = await load(old);
  assert.equal(pinned.snapshot.bundle.roles[0].skills.length, 2);
  assert.equal(pinned.meta.snapshotId, old);
  assert.equal(pinned.meta.lastSuccessfulCheckAt, null);
  assert.match(pinned.meta.notices.join(" "), /saved criteria/i);
  const current = await load();
  assert.equal(current.snapshot.id, published.snapshot?.id);
  assert.equal(current.meta.snapshotId, current.snapshot.id);
  assert.equal(current.snapshot.bundle.roles[0].skills.length, 3);
});

test("a head change between reads cannot mix the requested bundle and metadata", async () => {
  const backing = MemoryCriteriaStore.emptyBacking();
  const store = new MemoryCriteriaStore({ backing });
  const old = await store.bootstrap(bundle(2));
  const r = await store.reserveRefresh();
  if (r.status !== "acquired") throw new Error("fixture reservation failed");
  const next = await store.publishIfCurrent(old, r.generation, bundle(3), emptyPublicState(), false);
  backing.head!.snapshotId = old;
  const original = store.readSnapshot.bind(store);
  store.readSnapshot = async (id) => {
    assert.equal(id, old, "the loader pins the captured head before reading a payload");
    backing.head!.snapshotId = next.snapshot!.id;
    return original(id);
  };
  const ctx = await createCriteriaContextLoader({ store, disabled: true })();
  assert.equal(ctx.snapshot.id, old);
  assert.equal(ctx.meta.snapshotId, old);
  assert.equal(ctx.snapshot.bundle.roles[0].skills.length, 2);
});

test("storage failure is unavailable rather than a pretend source fallback", async () => {
  const store = new MemoryCriteriaStore();
  store.readRefreshState = async () => { throw new Error("private database detail"); };
  await assert.rejects(createCriteriaContextLoader({ store, disabled: true })(), (error: any) => {
    assert.equal(error.code, "TRENDS_UNAVAILABLE");
    assert.doesNotMatch(error.message, /private database detail/);
    return true;
  });
});

test("missing or mismatched version context carries reload guidance but unanswered skills remain ready", async () => {
  const store = new MemoryCriteriaStore();
  const id = await store.bootstrap(bundle(2));
  const deps = { loadContext: createCriteriaContextLoader({ store, disabled: true }), loadSnapshot: store.readSnapshot.bind(store) };
  await assert.rejects(prepareCriteriaRequest(profile(["api-basics"]), {}, deps), (error: any) => {
    assert.equal(error.code, "CRITERIA_CONTEXT_REQUIRED");
    assert.equal(error.review.targetSnapshotId, id);
    assert.equal(error.review.questions[0].skillId, "fixture-skill-1");
    return true;
  });
  await assert.rejects(prepareCriteriaRequest(profile(), { snapshotId: id, criteriaReview: { targetSnapshotId: UNKNOWN } }, deps), { code: "CRITERIA_CONTEXT_REQUIRED" });
  await assert.rejects(prepareCriteriaRequest(profile(), { criteriaReview: { fromSnapshotId: UNKNOWN, targetSnapshotId: id } }, deps), { code: "CRITERIA_UNAVAILABLE" });
  const ready = await prepareCriteriaRequest(profile(["api-basics"]), { snapshotId: id }, deps);
  assert.equal(ready.result.status, "ready");
  assert.equal(ready.result.review.questions[0].state, "unanswered");
  assert.deepEqual(ready.result.profile.unconfirmedSkillIds, []);
});
