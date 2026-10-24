import test from "node:test";
import assert from "node:assert/strict";
import type { CandidateInterpretation, InterpretationBatch, SourceBatch } from "../contracts/trends.ts";
import { buildCriteriaDraft, draftRefresh } from "./refreshDraft.ts";
import { validateCriteriaBundle } from "./policy.ts";
import { toCountRoleInputs } from "./adapters.ts";
import { emptyQueue } from "./queue.ts";
import { SOURCE_PROVIDERS } from "./sources.ts";
import type { TrendInterpreter } from "./interpreter.ts";
import { candidate, context, NOW } from "./testFixtures.ts";
import { rssFeed, item } from "./fixtures/feeds.ts";

// FICTIONAL admission inputs from the shared fixture; no live source or model.
const ctx = context();
const batch: SourceBatch = { items: ctx.sources, providers: [], resources: ctx.resources };
const draftContext = { reference: ctx.reference, config: ctx.config, now: NOW, interpreterVersion: "fictional-model:trend-interpreter-v1" };
const interpreted = (...mappings: CandidateInterpretation[]): InterpretationBatch => ({ items: [{ sourceId: "fictional-update", mappings }] });
const denominators = (b: Parameters<typeof toCountRoleInputs>[0]) => Object.fromEntries(toCountRoleInputs(b).map((r) => [r.roleId, r.skills.length]));

test("a ready distinct capability is published as one point with its source, resource, SDG and decision", () => {
  const result = buildCriteriaDraft(ctx.base, batch, interpreted(candidate()), draftContext);
  assert.equal(result.admittedSkillIds.length, 1);
  const [id] = result.admittedSkillIds;
  assert.match(id, /^cap-[a-f0-9]{16}$/);
  assert.deepEqual(validateCriteriaBundle(result.bundle), result.bundle);
  assert.deepEqual(denominators(result.bundle), { "backend-development": 11, "qa-automation": 10 });
  const role = result.bundle.roles.find((r) => r.roleId === "backend-development")!;
  assert.deepEqual(role.skills.find((s) => s.skillId === id), { skillId: id, name: "Fictional diagnostic capability", weight: 1, isRequired: false });
  const decision = result.bundle.criteriaDecisions.find((d) => d.skillId === id)!;
  assert.equal(decision.action, "admit"); assert.equal(decision.roleId, "backend-development");
  const evidence = result.bundle.evidence.find((e) => decision.evidenceIds.includes(e.id))!;
  assert.deepEqual([evidence.url, evidence.publishedAt, evidence.publishedDate, evidence.originalDate, evidence.datePrecision, evidence.checkedAt],
    ["https://publisher.example/update", "2020-01-01T00:00:00Z", "2020-01-01", "2020-01-01", "day", NOW]);
  assert.match(evidence.limitation, /not hiring demand/);
  const resource = result.bundle.resources.find((r) => r.skillId === id)!;
  assert.deepEqual([resource.url, resource.cost, resource.estimatedHours, resource.estimateBasis, resource.isPlaceholder], ["https://learning.example/tutorial", "free", 2, "app", false]);
  assert.ok(result.bundle.sdg.skillTags.some((t) => t.skillId === id && t.sdgId === "sdg-4"));
  assert.ok(result.bundle.sourceContentKeys.includes(`fictional-update:${ctx.sources[0].contentHash}`));
  assert.equal(result.bundle.interpreterVersion, "fictional-model:trend-interpreter-v1");
  assert.deepEqual([result.staged, result.rejected, result.retiredSkillIds], [[], [], []]);
});

test("ten repeats of the same update add at most one criterion", () => {
  const result = buildCriteriaDraft(ctx.base, batch, interpreted(...Array.from({ length: 10 }, candidate)), draftContext);
  assert.equal(result.admittedSkillIds.length, 1);
  assert.deepEqual(denominators(result.bundle), { "backend-development": 11, "qa-automation": 10 });
  assert.equal(validateCriteriaBundle(result.bundle).capabilities.length, 11);
  // The nine repeats are recognised as the capability just admitted, not as collisions.
  assert.deepEqual([result.staged, result.rejected], [[], []]);
});

test("an update about an existing skill attaches evidence without changing any denominator", () => {
  const reuse = { ...candidate(), relation: "same" as const, existingSkillId: "api-basics", learning: null, sdgTemplateIds: [] };
  const result = buildCriteriaDraft(ctx.base, batch, interpreted(reuse), draftContext);
  assert.deepEqual(result.admittedSkillIds, []);
  assert.deepEqual(denominators(result.bundle), denominators(ctx.base));
  const api = result.bundle.capabilities.find((c) => c.skillId === "api-basics")!;
  const added = result.bundle.evidence.find((e) => api.evidenceIds.includes(e.id) && e.id !== "fictional-evidence")!;
  assert.deepEqual(added.linkedSkillIds, ["api-basics"]);
  assert.deepEqual(validateCriteriaBundle(result.bundle), result.bundle);
});

test("staged, rejected and irrelevant results leave the criteria unchanged; zero admissions is valid", () => {
  const alternative = { ...candidate(), relation: "alternative-stack" as const };
  const invented = { ...candidate(), relation: "same" as const, existingSkillId: "made-up-skill" };
  const result = buildCriteriaDraft(ctx.base, batch, interpreted(alternative, invented), draftContext);
  assert.deepEqual(result.bundle, ctx.base);
  assert.equal(result.staged.length, 1); assert.equal(result.rejected.length, 1);
  assert.deepEqual(result.admittedSkillIds, []);
  assert.deepEqual(buildCriteriaDraft(ctx.base, batch, { items: [{ sourceId: "fictional-update", mappings: [] }] }, draftContext).bundle, ctx.base);
});

test("a promotion that would make the bundle invalid stays staged instead of publishing", () => {
  const placeholderHost = { ...ctx, config: { ...ctx.config, resourceHosts: ["example.com"] } };
  const link = { linkId: "fictional-link", url: "https://example.com/tutorial", title: "FICTIONAL placeholder" };
  const sources = [{ ...ctx.sources[0], extractedLinks: [link] }];
  const resources = [{ ...ctx.resources[0], url: link.url }];
  const result = buildCriteriaDraft(ctx.base, { items: sources, providers: [], resources }, interpreted(candidate()), { ...draftContext, config: placeholderHost.config });
  assert.deepEqual(result.admittedSkillIds, []);
  assert.deepEqual(result.bundle, ctx.base);
  assert.deepEqual(result.staged, [{ status: "stage", reasons: [{ gate: "A7", code: "bundle-readiness-failed" }] }]);
});

function feedFetcher(calls: string[]) {
  const feeds: Record<string, string> = {
    [SOURCE_PROVIDERS[0].feedUrl]: rssFeed([1, 2, 3, 4, 5, 6].map((n) => item(n))),
    [SOURCE_PROVIDERS[1].feedUrl]: rssFeed([1, 2, 3, 4, 5, 6].map((n) => item(n, { link: `https://blog.jetbrains.com/ai/2026/10/fictional-${n}/` }))),
  };
  return (async (url: string) => { calls.push(String(url)); return feeds[String(url)] ? new Response(feeds[String(url)]) : new Response("", { status: 404 }); }) as typeof fetch;
}
function fakeInterpreter(seen: string[][]): TrendInterpreter {
  return { model: "fictional-model", async interpretBatch(input) {
    seen.push(input.batch.items.map((s) => s.sourceId));
    return { items: input.batch.items.map((s) => ({ sourceId: s.sourceId, mappings: [] })) };
  } };
}
const refreshDeps = (overrides = {}) => ({ base: ctx.base, reference: ctx.reference, config: ctx.config, providers: [], queue: emptyQueue(), sources: [], now: () => NOW, ...overrides });

test("twelve discovered items make exactly one two-item model request, fairly split, with the rest deferred", async () => {
  const fetches: string[] = [], seen: string[][] = [];
  const run = await draftRefresh({ ...refreshDeps(), fetcher: feedFetcher(fetches), interpreter: fakeInterpreter(seen) });
  assert.equal(seen.length, 1); assert.equal(seen[0].length, 2);
  assert.deepEqual(seen[0].map((id) => id.split("-").slice(0, -1).join("-")).sort(), ["github-changelog", "jetbrains-ai"]);
  assert.equal(fetches.length, 2, "feeds only: no resource links were published in these fixtures");
  assert.equal(run.outcome?.status, "success"); assert.equal(run.work.kind, "new");
  assert.equal(run.queue.items.filter((i) => i.state === "pending").length, 10);
  assert.equal(run.sources.length, 10, "only still-waiting source text is returned for the caller to keep");
  assert.ok(run.sources.every((s) => !seen[0].includes(s.sourceId)));
  assert.deepEqual(run.draft?.bundle, ctx.base);
});

test("disabled interpretation makes no network or model calls and reports itself honestly", async () => {
  const fetches: string[] = [];
  const run = await draftRefresh({ ...refreshDeps(), fetcher: feedFetcher(fetches), interpreter: null });
  assert.deepEqual([fetches.length, run.interpretation, run.draft, run.outcome], [0, "disabled", null, null]);
});

test("the whole refresh is bounded by one overall deadline", async () => {
  const hang = (async (_u: string, init?: RequestInit) => new Promise<Response>((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)))) as typeof fetch;
  await assert.rejects(draftRefresh({ ...refreshDeps(), fetcher: hang, interpreter: fakeInterpreter([]), deadlineMs: 30 }), /deadline/);
});
