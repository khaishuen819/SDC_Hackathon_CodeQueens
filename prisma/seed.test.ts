import test from "node:test";
import assert from "node:assert/strict";
import { seedDemoData } from "./seed.ts";

test("seed reruns insert missing demo rows without overwriting reviewed content or snapshots", async () => {
  const tables = new Map<string, Map<string, any>>();
  const db: any = {};
  for (const name of ["role", "skill", "resource", "roleSkill", "sdgGoal", "roleSdg", "skillSdg"]) {
    const rows = new Map(); tables.set(name, rows);
    db[name] = { upsert: async ({ where, update, create }: any) => {
      const key = JSON.stringify(where), current = rows.get(key);
      rows.set(key, current ? { ...current, ...update } : structuredClone(create));
    } };
  }
  const head = Object.freeze({ snapshotId: "fictional-reviewed-head", generation: 7 });
  db.criteriaHead = new Proxy({}, { get() { throw new Error("Seed must not access criteria snapshots/head."); } });
  db.criteriaSnapshot = db.criteriaHead;
  await seedDemoData(db);
  for (const [name, rows] of tables) {
    if (name === "sdgGoal") continue;
    for (const [key, row] of rows) rows.set(key, { ...row, isPlaceholder: false,
      name: "Reviewed name", weight: 1, url: "https://learning.example/reviewed", rationale: "Reviewed rationale" });
  }
  const before = structuredClone(tables);
  // Also prove missing content can still be installed on a rerun.
  const key = JSON.stringify({ id: "typescript" });
  tables.get("skill")!.delete(key);
  await seedDemoData(db);
  assert.equal(tables.get("skill")!.get(key).isPlaceholder, true);
  tables.get("skill")!.set(key, before.get("skill")!.get(key));
  assert.deepEqual(tables, before);
  assert.deepEqual(head, { snapshotId: "fictional-reviewed-head", generation: 7 });
});
