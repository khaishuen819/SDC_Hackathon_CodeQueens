// PostgreSQL store against the shared CriteriaStore contract. Disposable
// database only (see testDatabase.ts); skipped, not passed, without one.
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaCriteriaStore } from "./snapshotStore.ts";
import { describeCriteriaStore } from "./storeContract.ts";
import { DB_SKIP, DB_TIMING, connectTestDatabase, disconnectTestDatabase, resetTestDatabase } from "./testDatabase.ts";

// One client for the file: the store keeps no in-process state, so a new
// instance must reread everything from the database, like a restarted server.
const shared = DB_SKIP ? null : connectTestDatabase();
test.after(async () => { if (shared) await disconnectTestDatabase(shared); });

describeCriteriaStore("postgres store", async () => {
  await resetTestDatabase(shared!);
  return {
    a: new PrismaCriteriaStore(shared!, DB_TIMING), b: new PrismaCriteriaStore(shared!, DB_TIMING),
    restart: async () => new PrismaCriteriaStore(shared!, DB_TIMING), cleanup: async () => {},
  };
}, { skip: DB_SKIP, timing: DB_TIMING });

test("postgres store: lease expiry follows database time", { skip: DB_SKIP }, async () => {
  await resetTestDatabase(shared!);
  const [{ now }] = await shared!.$queryRaw<Array<{ now: Date }>>`SELECT now() AS "now"`;
  const run = await new PrismaCriteriaStore(shared!, DB_TIMING).reserveRefresh();
  assert.equal(run.status, "acquired");
  const offset = Date.parse(run.status === "acquired" ? run.leaseExpiresAt : "") - now.getTime() - DB_TIMING.leaseMs;
  assert.ok(Math.abs(offset) < 2_000, `offset ${offset} ms`);
});

// Needs a server that accepts several connections (PGlite accepts one).
const concurrencySkip = DB_SKIP ?? (process.env["TEST_DATABASE_CONCURRENCY"] ? undefined : "pending: set TEST_DATABASE_CONCURRENCY=1 on a multi-connection disposable PostgreSQL");
test("postgres store: simultaneous reservations from separate connections yield one worker", { skip: concurrencySkip }, async () => {
  await resetTestDatabase(shared!);
  const clients = Array.from({ length: 4 }, connectTestDatabase);
  try {
    const results = await Promise.all(clients.map((c) => new PrismaCriteriaStore(c, DB_TIMING).reserveRefresh()));
    assert.deepEqual(results.map((r) => r.status).sort(), ["acquired", "busy", "busy", "busy"]);
  } finally { await Promise.all(clients.map(disconnectTestDatabase)); }
});
