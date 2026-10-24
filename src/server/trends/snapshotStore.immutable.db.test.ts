// The migration's triggers keep stored criteria versions immutable even for
// direct SQL. Disposable database only (see testDatabase.ts). Each blocked
// statement uses its own connection, because some test servers close the
// connection after an error.
import test from "node:test";
import assert from "node:assert/strict";
import { PrismaCriteriaStore } from "./snapshotStore.ts";
import { DB_SKIP, connectTestDatabase, disconnectTestDatabase, resetTestDatabase } from "./testDatabase.ts";
import { bundle } from "./testFixtures.ts";

// Prisma reports the trigger's message in the driver error details.
const immutable = (e: unknown) => /CriteriaSnapshot rows are immutable/.test(JSON.stringify((e as { meta?: unknown }).meta ?? String(e)));

test("postgres store: snapshot rows cannot be updated or deleted by direct SQL", { skip: DB_SKIP }, async () => {
  const setup = connectTestDatabase();
  let id = "";
  try { await resetTestDatabase(setup); id = await new PrismaCriteriaStore(setup).bootstrap(bundle()); } finally { await disconnectTestDatabase(setup); }
  for (const attempt of ["update", "delete"] as const) {
    const prisma = connectTestDatabase();
    try {
      await assert.rejects(attempt === "update" ? prisma.$executeRaw`UPDATE "CriteriaSnapshot" SET "policyVersion" = 'changed' WHERE "id" = ${id}`
        : prisma.$executeRaw`DELETE FROM "CriteriaSnapshot" WHERE "id" = ${id}`, immutable, attempt);
    } finally { await disconnectTestDatabase(prisma); }
  }
  const check = connectTestDatabase();
  try { assert.deepEqual((await new PrismaCriteriaStore(check).readSnapshot())?.bundle, bundle(), "the stored version is unchanged"); }
  finally { await disconnectTestDatabase(check); }
});
