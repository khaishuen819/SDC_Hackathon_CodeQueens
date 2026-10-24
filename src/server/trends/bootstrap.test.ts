import test from "node:test";
import assert from "node:assert/strict";
import { bootstrapPilotBaseline, buildInitialCriteria, loadPilotBaseline } from "./bootstrap.ts";
import { MemoryCriteriaStore } from "./snapshotStore.ts";
import { criteriaSnapshotId } from "./identity.ts";
import { bundle, context } from "./testFixtures.ts";
import { readFile } from "node:fs/promises";
import { pilotConfig, PILOT_SKILL_IDS } from "./pilotConfig.ts";
import type { RoleReference, VerifiedContent } from "../contracts/trends.ts";

function inputs() {
  const b = bundle(2), ctx = context(b);
  ctx.reference.version = "31.0";
  ctx.reference.tasks.push({ ...ctx.reference.tasks[0], occupationId: "15-1253.00", taskId: "qa-task" });
  ctx.config.taskAnchors.push({ roleId: "qa-automation", taskId: "Q2", referenceTaskIds: ["qa-task"] });
  return { b, ctx };
}

test("initial builder keeps explicitly verified content and does not infer skills from software flags", () => {
  const { b, ctx } = inputs();
  ctx.reference.software.push({ occupationId: "15-1252.00", name: "Unrelated popular framework", hotTechnology: true, inDemand: true });
  const result = buildInitialCriteria(ctx.reference, ctx.config, b);
  assert.equal(result.roles[0].skills.length, 2);
  assert.ok(result.roles.every(r => r.skills.every(s => s.weight === 1)));
  assert.equal(result.capabilities.some(c => c.name.includes("framework")), false);
  assert.match(result.sourceContentKeys[0], /^onet-31\.0-[a-f0-9]{64}$/);
});

test("baseline readiness rejects missing content, unknown scope and supervisory bridges", () => {
  const { b, ctx } = inputs();
  assert.throws(() => buildInitialCriteria(ctx.reference, ctx.config, { ...b, resources: [] }));
  assert.throws(() => buildInitialCriteria(ctx.reference, { ...ctx.config, taskAnchors: [] }, b));
  const management = structuredClone(ctx.reference); management.tasks[0].text = "Supervise and assign work to programmers.";
  assert.throws(() => buildInitialCriteria(management, ctx.config, b));
  assert.throws(() => buildInitialCriteria({ ...ctx.reference, version: "other" }, ctx.config, b));
});

test("baseline construction is pure and missing resources cannot be relabelled reviewed", () => {
  const { b, ctx } = inputs(), original = structuredClone(b);
  buildInitialCriteria(ctx.reference, ctx.config, b);
  assert.deepEqual(b, original);
  const placeholder = structuredClone(b); placeholder.resources[0].isPlaceholder = true;
  assert.throws(() => buildInitialCriteria(ctx.reference, ctx.config, placeholder));
});

test("checked-in pilot baseline is complete, reference-scoped and does not require every alternative stack", async () => {
  const reference: RoleReference = JSON.parse(await readFile(new URL("./data/role-reference-31.0.json", import.meta.url), "utf8"));
  const content: VerifiedContent = JSON.parse(await readFile(new URL("./data/pilot-baseline.json", import.meta.url), "utf8"));
  const result = buildInitialCriteria(reference, pilotConfig, content);
  assert.deepEqual(result.capabilities.map(c => c.skillId).sort(), [...PILOT_SKILL_IDS].sort());
  assert.deepEqual([...new Set(reference.tasks.map(t => t.occupationId))].sort(), ["15-1252.00", "15-1253.00"]);
  assert.ok(result.roles.every(r => r.skills.length > 0 && r.skills.length < PILOT_SKILL_IDS.length));
  assert.ok(result.roles.every(r => !r.skills.some(s => ["nodejs", "python", "typescript", "javascript", "docker"].includes(s.skillId))));
  assert.ok(result.resources.every(r => r.cost === "free" && r.estimateBasis === "app" && !r.isPlaceholder));
  assert.ok(result.evidence.every(e => !/fictional|placeholder|example\.com/i.test(JSON.stringify(e))));
  assert.ok(result.evidence.every(e => e.datePrecision === "unknown" ? e.originalDate === null : !!e.originalDate));
  assert.ok(result.sdg.roleTags.every(t => t.rationale.includes("possible")));
});

test("runtime baseline loading validates the pinned inputs without populating storage", async () => {
  const { reference, bundle: baseline } = await loadPilotBaseline();
  assert.equal(reference.version, "31.0");
  assert.equal(baseline.capabilities.length, 16);
  assert.deepEqual(baseline.roles.map((r) => r.skills.length), [8, 8]);
  assert.ok(baseline.resources.every((r) => r.cost === "free" && !r.isPlaceholder));
});

test("release bootstrap reports by default, stores once on apply and never replaces a current version", async () => {
  const { bundle: baseline } = await loadPilotBaseline();
  const id = criteriaSnapshotId(baseline);
  const store = new MemoryCriteriaStore();
  assert.deepEqual(await bootstrapPilotBaseline(store, baseline, false), { action: "would-create", baselineId: id, headId: null, headMatchesBaseline: false });
  assert.equal(await store.readSnapshot(), null, "a report never writes");
  assert.deepEqual(await bootstrapPilotBaseline(store, baseline, true), { action: "created", baselineId: id, headId: id, headMatchesBaseline: true });
  assert.deepEqual((await store.readSnapshot())?.bundle, baseline);
  assert.deepEqual(await bootstrapPilotBaseline(store, baseline, true), { action: "kept-existing", baselineId: id, headId: id, headMatchesBaseline: true });
  const other = new MemoryCriteriaStore();
  const otherId = await other.bootstrap(bundle());
  assert.deepEqual(await bootstrapPilotBaseline(other, baseline, true), { action: "kept-existing", baselineId: id, headId: otherId, headMatchesBaseline: false });
  assert.equal((await other.readSnapshot())?.id, otherId, "a different existing version is kept, not replaced");
});
