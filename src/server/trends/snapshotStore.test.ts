import test from "node:test";
import assert from "node:assert/strict";
import { MemoryCriteriaStore, decideReservation, leaseHeld, emptyPublicState, REFRESH_TIMING } from "./snapshotStore.ts";
import type { MemoryBacking } from "./snapshotStore.ts";
import { describeCriteriaStore, CONTRACT_TIMING } from "./storeContract.ts";
import { bundle } from "./testFixtures.ts";

describeCriteriaStore("memory store", async () => {
  const backing: MemoryBacking = MemoryCriteriaStore.emptyBacking();
  const make = () => new MemoryCriteriaStore({ backing, ...CONTRACT_TIMING });
  return { a: make(), b: make(), restart: async () => make(), cleanup: async () => {} };
});

const head = (overrides = {}) => ({ snapshotId: null, nextGeneration: 4n, publishedGeneration: 3n, leaseGeneration: null, leaseExpiresAt: null,
  nextAllowedAt: null, lastAttemptAt: null, lastSuccessfulCheckAt: null, state: emptyPublicState(), ...overrides });
const T = Date.parse("2026-10-24T10:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

test("reservation rules: 75 s lease and 60 s between starts, using the store's clock", () => {
  assert.deepEqual(REFRESH_TIMING, { leaseMs: 75_000, cooldownMs: 60_000 });
  assert.deepEqual(decideReservation(head(), T, REFRESH_TIMING),
    { status: "acquired", generation: 5n, leaseExpiresAt: iso(T + 75_000), nextAllowedAt: iso(T + 60_000) });
  assert.deepEqual(decideReservation(head({ leaseGeneration: 4n, leaseExpiresAt: iso(T + 1) }), T, REFRESH_TIMING), { status: "busy", retryAt: iso(T + 1) });
  assert.deepEqual(decideReservation(head({ nextAllowedAt: iso(T + 1) }), T, REFRESH_TIMING), { status: "cooldown", retryAt: iso(T + 1) });
  assert.equal(decideReservation(head({ leaseGeneration: 4n, leaseExpiresAt: iso(T), nextAllowedAt: iso(T) }), T, REFRESH_TIMING).status, "acquired");
  assert.equal(leaseHeld(head({ leaseGeneration: 4n, leaseExpiresAt: iso(T + 1) }), 4n, T), true);
  assert.equal(leaseHeld(head({ leaseGeneration: 4n, leaseExpiresAt: iso(T) }), 4n, T), false);
  assert.equal(leaseHeld(head({ leaseGeneration: 5n, leaseExpiresAt: iso(T + 1) }), 4n, T), false);
});

test("the last valid snapshot is still served after more than 24 hours without a successful check", async () => {
  let now = T;
  const backing = MemoryCriteriaStore.emptyBacking();
  const store = new MemoryCriteriaStore({ backing, now: () => now });
  const id = await store.bootstrap(bundle());
  now += 25 * 3_600_000;
  const run = await store.reserveRefresh();
  if (run.status !== "acquired") return assert.fail("expected a reservation");
  await store.recordFailure(run.generation, null);
  await store.releaseRefresh(run.generation);
  const restarted = new MemoryCriteriaStore({ backing, now: () => now });
  assert.equal((await restarted.readSnapshot())?.id, id);
  assert.equal((await restarted.readRefreshState()).lastSuccessfulCheckAt, null, "a failure never invents a successful check");
  assert.equal((await restarted.readRefreshState()).lastAttemptAt, iso(now));
});

test("stored snapshots are checked against their content hash on every read", async () => {
  const backing = MemoryCriteriaStore.emptyBacking();
  const store = new MemoryCriteriaStore({ backing });
  const id = await store.bootstrap(bundle());
  const row = backing.snapshots.get(id)!;
  backing.snapshots.set(id, { ...row, payload: row.payload.replace("FICTIONAL", "TAMPERED") });
  await assert.rejects(store.readSnapshot(id), /integrity/);
});
