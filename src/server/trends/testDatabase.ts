// Shared set-up for PostgreSQL store tests. They run ONLY against an explicitly
// configured, disposable database (TEST_DATABASE_URL with migrations applied),
// never the team database; otherwise they are reported as skipped, not passed.
// The *.db.test.ts files reset the same database, so run them one file at a time:
//   node --test --test-concurrency=1 src/server/trends/*.db.test.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../db/generated/prisma/client.ts";

export const TEST_DATABASE_URL = process.env["TEST_DATABASE_URL"];
export const DB_SKIP = !TEST_DATABASE_URL ? "pending: set TEST_DATABASE_URL to a disposable PostgreSQL database with migrations applied"
  : TEST_DATABASE_URL === process.env["DATABASE_URL"] ? "refused: TEST_DATABASE_URL must not be the application DATABASE_URL" : undefined;
// Slower than memory: every call is a real transaction.
export const DB_TIMING = { leaseMs: 3_000, cooldownMs: 1_500 };
export const connectTestDatabase = () => new PrismaClient({ adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL, max: 1 }) });
// Lets the server finish closing the socket; single-connection test servers
// (such as PGlite) otherwise refuse the next connection.
export async function disconnectTestDatabase(prisma: InstanceType<typeof PrismaClient>) {
  await prisma.$disconnect();
  await new Promise((resolve) => setTimeout(resolve, 200));
}

// Test-only reset of a disposable database. Snapshot triggers block deletes,
// so they are disabled for this statement only (requires table ownership).
export async function resetTestDatabase(prisma: InstanceType<typeof PrismaClient>) {
  await prisma.$executeRaw`DELETE FROM "CriteriaHead"`;
  await prisma.$executeRaw`ALTER TABLE "CriteriaSnapshot" DISABLE TRIGGER USER`;
  await prisma.$executeRaw`DELETE FROM "CriteriaSnapshot"`;
  await prisma.$executeRaw`ALTER TABLE "CriteriaSnapshot" ENABLE TRIGGER USER`;
}
