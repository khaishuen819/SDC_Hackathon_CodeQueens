// Release step (Feature 2, Phase 7): store the verified pilot baseline as the first
// criteria version, only when none exists. It never replaces a current version.
//   node scripts/bootstrap-criteria.ts           read-only check (default)
//   node scripts/bootstrap-criteria.ts --apply   store the baseline if no version exists
// Uses DATABASE_URL. Apply the additive migration first: npx prisma migrate deploy
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { bootstrapPilotBaseline, loadPilotBaseline } from "../src/server/trends/bootstrap.ts";
import { PrismaCriteriaStore } from "../src/server/trends/snapshotStore.ts";

export async function runBootstrap(argv: string[]): Promise<number> {
  const apply = argv.includes("--apply");
  const { bundle } = await loadPilotBaseline();
  console.log(`Verified baseline: ${bundle.capabilities.length} skills; ${bundle.roles.map((r) => `${r.roleId} ${r.skills.length}`).join(", ")}.`);
  // Imported here so a missing DATABASE_URL fails after the baseline check, with the client's own message.
  let prisma: (typeof import("../src/server/db/client.ts"))["prisma"];
  try { ({ prisma } = await import("../src/server/db/client.ts")); }
  catch (error) { console.error(error instanceof Error ? error.message : "Database client could not start."); return 1; }
  try {
    const result = await bootstrapPilotBaseline(new PrismaCriteriaStore(prisma), bundle, apply);
    if (result.action === "would-create") console.log(`No criteria version exists yet. Re-run with --apply to store ${result.baselineId}.`);
    if (result.action === "created") console.log(`Stored the verified baseline as the current criteria version: ${result.headId}.`);
    if (result.action === "kept-existing") console.log(`A current criteria version already exists and was kept: ${result.headId}` +
      (result.headMatchesBaseline ? " (it is the verified baseline)." : " (it differs from the baseline; nothing was replaced)."));
    return 0;
  } catch (error) {
    const detail = JSON.stringify({ code: (error as { code?: unknown }).code, meta: (error as { meta?: unknown }).meta });
    console.error(/P2021|42P01/.test(detail) ? "Criteria tables were not found. Apply the migration first: npx prisma migrate deploy"
      : `Bootstrap failed: ${error instanceof Error ? error.message.split("\n")[0] : "unknown error"}`);
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runBootstrap(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
