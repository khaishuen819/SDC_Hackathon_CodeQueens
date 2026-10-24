import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { fetchRoleReference } from "../src/server/trends/reference.ts";

export async function importRoleReference() {
  const reference = await fetchRoleReference();
  const destination = new URL("../src/server/trends/data/role-reference-31.0.json", import.meta.url);
  await mkdir(new URL(".", destination), { recursive: true });
  await writeFile(destination, JSON.stringify(reference, null, 2) + "\n", "utf8");
  console.log(`Imported O*NET ${reference.version}: ${reference.tasks.length} tasks, ${reference.software.length} software examples. No role weights were inferred.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  importRoleReference().catch(error => { console.error(error instanceof Error ? error.message : "Reference import failed."); process.exitCode = 1; });
}
