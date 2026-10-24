import test from "node:test";
import assert from "node:assert/strict";
import { parseRoleReference, fetchRoleReference } from "./reference.ts";

const tasks = { row: [
  { onetsoc_code: "15-1252.00", task_id: 1, task: "Develop software interfaces.", task_type: "Core", date_updated: "2025-08-01" },
  { onetsoc_code: "15-1253.00", task_id: 2, task: "Document reproducible software defects.", task_type: "Core", date_updated: "2024" },
  { onetsoc_code: "11-1011.00", task_id: 3, task: "Manage an organisation.", task_type: "Core", date_updated: "2024" },
], column: [{ name: "metadata only" }] };
const software = { row: [
  { onetsoc_code: "15-1252.00", workplace_example: "Example language", hot_technology: "Y", in_demand: "N" },
  { onetsoc_code: "15-1253.00", workplace_example: "Example testing tool", hot_technology: "N", in_demand: "Y" },
  { onetsoc_code: "11-1011.00", workplace_example: "Unrelated software", hot_technology: "N", in_demand: "N" },
] };

test("reference importer reads row data, scopes occupations and preserves date precision", () => {
  const result = parseRoleReference(tasks, software, "2026-10-24T12:00:00Z");
  assert.equal(result.version, "31.0"); assert.equal(result.tasks.length, 2);
  assert.deepEqual(result.tasks.map(t => [t.taskId, t.originalDate, t.datePrecision]), [["1", "2025-08-01", "day"], ["2", "2024", "year"]]);
  assert.equal(result.software.length, 2); assert.equal(result.software[0].hotTechnology, true);
  assert.equal(result.software[1].inDemand, true); assert.match(result.attribution, /O\*NET/);
  assert.equal(result.retrievedAt, "2026-10-24T12:00:00Z");
  assert.equal("weight" in result.software[0], false);
});

test("missing rows, selected fields, occupation coverage and invalid flags fail", () => {
  for (const invalid of [{ column: [] }, { row: [] }, { row: [tasks.row[0]] }, { row: [{ ...tasks.row[0], task: "" }, tasks.row[1]] }]) {
    assert.throws(() => parseRoleReference(invalid, software, "2026-10-24T12:00:00Z"));
  }
  assert.throws(() => parseRoleReference(tasks, { row: [{ ...software.row[0], hot_technology: "maybe" }, software.row[1]] }, "2026-10-24T12:00:00Z"));
});

test("software flags stay observations and missing source dates stay unknown", () => {
  const t = structuredClone(tasks); (t.row[0] as any).date_updated = null;
  const result = parseRoleReference(t, software, "2026-10-24T12:00:00Z");
  assert.equal(result.tasks[0].datePrecision, "unknown"); assert.equal(result.tasks[0].originalDate, null);
  assert.equal("skills" in result, false); assert.equal("roles" in result, false);
});

test("real O*NET null task classifications remain explicitly unknown", () => {
  const t = structuredClone(tasks); (t.row[1] as any).task_type = null;
  assert.equal(parseRoleReference(t, software, "2026-10-24T12:00:00Z").tasks[1].taskType, "Unknown");
});

test("fetch imports only the two pinned public tables and rejects bad responses", async () => {
  const urls: string[] = [];
  const fetcher = (async (url: string) => { urls.push(String(url)); return new Response(JSON.stringify(String(url).endsWith("task_statements.json") ? tasks : software)); }) as typeof fetch;
  const result = await fetchRoleReference(fetcher, new AbortController().signal);
  assert.equal(result.tasks.length, 2); assert.equal(urls.length, 2);
  assert.ok(urls.every(u => u.startsWith("https://www.onetcenter.org/dl_files/database/db_31_0_json/")));
  await assert.rejects(fetchRoleReference((async () => new Response("{}")) as typeof fetch, new AbortController().signal));
});
