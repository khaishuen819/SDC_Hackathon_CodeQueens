import test from "node:test";
import assert from "node:assert/strict";
import { TrendMeta } from "../contracts/trends.ts";
import type { InterpretationInput } from "../contracts/trends.ts";
import { createRefreshService } from "./refreshService.ts";
import { MemoryCriteriaStore } from "./snapshotStore.ts";
import { InterpretationError } from "./interpreter.ts";
import type { TrendInterpreter } from "./interpreter.ts";
import { bootstrapCriteria } from "./bootstrap.ts";
import { SOURCE_PROVIDERS } from "./sources.ts";
import { toCountRoleInputs } from "./adapters.ts";
import { bundle, candidate, context, NOW } from "./testFixtures.ts";
import { rssFeed, item, RESOURCE_PAGE } from "./fixtures/feeds.ts";

// FICTIONAL feeds, fixtures and a fake interpreter: no live source or model.
const T0 = Date.parse(NOW);
const ctx = context();
const config = { ...ctx.config, sourceHosts: ["github.blog", "blog.jetbrains.com"], resourceHosts: ["developer.mozilla.org"] };
const RESOURCE_URL = "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status";

function harness(options: { leaseMs?: number; tickMs?: number; feeds?: "ok" | "down" | "hang" } = {}) {
  let now = T0;
  const clock = { advance: (ms: number) => { now += ms; }, ms: () => now };
  const backing = MemoryCriteriaStore.emptyBacking();
  // tickMs makes the store clock advance on every call, to expire tiny leases mid-refresh.
  const store = new MemoryCriteriaStore({ backing, now: () => (now += options.tickMs ?? 0), ...(options.leaseMs ? { leaseMs: options.leaseMs } : {}) });
  const fetches: string[] = [], mode = { feeds: options.feeds };
  const feeds: Record<string, string> = {
    [SOURCE_PROVIDERS[0].feedUrl]: rssFeed([1, 2, 3, 4, 5, 6].map((n) => item(n))),
    [SOURCE_PROVIDERS[1].feedUrl]: rssFeed([1, 2, 3, 4, 5, 6].map((n) => item(n, { link: `https://blog.jetbrains.com/ai/2026/10/fictional-${n}/` }))),
    [RESOURCE_URL]: RESOURCE_PAGE,
  };
  const fetcher = (async (url: string, init?: RequestInit) => {
    fetches.push(String(url));
    if (mode.feeds === "hang") return new Promise<Response>((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    if (mode.feeds === "down" && !String(url).startsWith("https://developer")) return new Response("down", { status: 503 });
    return feeds[String(url)] ? new Response(feeds[String(url)]) : new Response("missing", { status: 404 });
  }) as typeof fetch;
  return { store, backing, clock, fetcher, fetches, mode, iso: () => new Date(now).toISOString() };
}
type Answer = (input: InterpretationInput) => Promise<{ items: Array<{ sourceId: string; mappings: ReturnType<typeof candidate>[] }> }>;
function interpreter(answer: Answer, calls: InterpretationInput[] = []): TrendInterpreter {
  return { model: "fictional-model", interpretBatch: async (input) => { calls.push(input); return answer(input); } };
}
const irrelevant: Answer = async (input) => ({ items: input.batch.items.map((s) => ({ sourceId: s.sourceId, mappings: [] })) });
// A ready distinct FICTIONAL capability for the first selected source.
const admitFirst: Answer = async (input) => ({ items: input.batch.items.map((s, n) => {
  if (n) return { sourceId: s.sourceId, mappings: [] };
  const linkId = s.extractedLinks[0].linkId, c = candidate();
  return { sourceId: s.sourceId, mappings: [{ ...c, sourceId: s.sourceId, sourceExcerpt: "Developers can now verify API behaviour using reproducible checks",
    learning: { ...c.learning, resourceLinkIds: [linkId], resourceExcerpts: [{ linkId, excerpt: "Practise checking HTTP status codes with a runnable example" }] } }] };
}) });
function service(h: ReturnType<typeof harness>, interp: TrendInterpreter | null, deadlineMs?: number) {
  return createRefreshService({ store: h.store, reference: ctx.reference, config, fetcher: h.fetcher, interpreter: interp, now: h.iso, ...(deadlineMs ? { deadlineMs } : {}) });
}

test("disabled interpretation reserves nothing, fetches nothing and reports the saved criteria honestly", async () => {
  const h = harness();
  const id = await bootstrapCriteria(h.store, bundle());
  const meta = await service(h, null).refresh();
  assert.deepEqual(TrendMeta.parse(meta), meta);
  assert.deepEqual([meta.status, meta.snapshotId, h.fetches.length, (await h.store.readRefreshState()).nextGeneration], ["disabled", id, 0, 0n]);
  assert.match(meta.notices.join(" "), /disabled/);
});

test("without a valid initial snapshot the refresh reports unavailable and does no source or model work", async () => {
  const h = harness(), calls: InterpretationInput[] = [];
  const meta = await service(h, interpreter(irrelevant, calls)).refresh();
  assert.deepEqual([meta.status, meta.snapshotId, h.fetches.length, calls.length], ["unavailable", null, 0, 0]);
  assert.equal((await h.store.readRefreshState()).leaseGeneration, null, "the lease is released");
});

test("one refresh: two items interpreted, the rest deferred and saved, criteria unchanged, lease released", async () => {
  const h = harness(), calls: InterpretationInput[] = [];
  const id = await bootstrapCriteria(h.store, bundle());
  const meta = await service(h, interpreter(irrelevant, calls)).refresh();
  assert.equal(calls.length, 1); assert.equal(calls[0].batch.items.length, 2);
  assert.deepEqual([meta.status, meta.snapshotId, meta.deferredItemCount, meta.quarantinedItemCount], ["partial", id, 10, 0]);
  assert.equal(meta.lastSuccessfulCheckAt, h.iso());
  assert.deepEqual(meta.providers.map((p) => p.status), ["ok", "ok"]);
  assert.equal(meta.refreshControl.state, "cooldown");
  const saved = await h.store.readRefreshState();
  assert.deepEqual([saved.leaseGeneration, saved.state.sources.length, saved.state.queue.items.filter((i) => i.state === "processed").length], [null, 10, 2]);
});

test("a ready new capability is published atomically as the next version", async () => {
  const h = harness();
  const base = await bootstrapCriteria(h.store, bundle());
  const meta = await service(h, interpreter(admitFirst)).refresh();
  assert.notEqual(meta.snapshotId, base);
  const current = (await h.store.readSnapshot())!;
  assert.equal(current.id, meta.snapshotId);
  assert.deepEqual(toCountRoleInputs(current.bundle).map((r) => r.skills.length), [11, 10]);
  assert.match(meta.notices.join(" "), /1 new skill/);
  assert.deepEqual((await h.store.readSnapshot(base))?.bundle, bundle(), "the previous version stays readable");
});

test("busy and cooldown requests return saved metadata at once without new source or model work", async () => {
  const h = harness(), calls: InterpretationInput[] = [];
  await bootstrapCriteria(h.store, bundle());
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const svc = service(h, interpreter(async (input) => { await gate; return irrelevant(input); }, calls));
  const first = svc.refresh();
  await new Promise((resolve) => setTimeout(resolve, 20));
  const busy = await svc.refresh();
  assert.equal(busy.refreshControl.state, "busy");
  release(); await first;
  const fetchesAfterFirst = h.fetches.length;
  const cooldown = await svc.refresh();
  assert.equal(cooldown.refreshControl.state, "cooldown"); assert.ok(cooldown.refreshControl.retryAt);
  assert.deepEqual([calls.length, h.fetches.length], [1, fetchesAfterFirst]);
  h.clock.advance(60_000);
  await svc.refresh();
  assert.equal(calls.length, 2, "the next eligible request does work again");
});

test("the dispatch is saved before the model call, and provider outages keep articles uncharged", async () => {
  const h = harness();
  await bootstrapCriteria(h.store, bundle());
  let seenDuringCall = -1;
  const meta = await service(h, interpreter(async () => {
    seenDuringCall = (await h.store.readRefreshState()).state.queue.items.filter((i) => i.attemptCount === 1).length;
    throw new InterpretationError("provider", "quota");
  })).refresh();
  assert.equal(seenDuringCall, 2, "attempts were persisted before the call");
  const saved = await h.store.readRefreshState();
  assert.ok(saved.state.queue.items.every((i) => i.inputFailureCount === 0));
  assert.equal(saved.state.queue.modelRetryAfterAt, new Date(T0 + 300_000).toISOString());
  assert.match(meta.notices.join(" "), /quota/);
});

test("a worker whose lease expired before the model call stops without calling the model or publishing", async () => {
  const h = harness({ leaseMs: 1, tickMs: 5 }), calls: InterpretationInput[] = [];
  const id = await bootstrapCriteria(h.store, bundle());
  const meta = await service(h, interpreter(admitFirst, calls)).refresh();
  assert.deepEqual([calls.length, (await h.store.readSnapshot())?.id], [0, id]);
  assert.match(meta.notices.join(" "), /lease/);
});

test("feed outages and the overall deadline keep the last valid criteria and never invent a successful check", async () => {
  const down = harness({ feeds: "down" });
  const id = await bootstrapCriteria(down.store, bundle());
  const meta = await service(down, interpreter(irrelevant)).refresh();
  assert.deepEqual([meta.status, meta.snapshotId, meta.lastSuccessfulCheckAt], ["partial", id, null]);
  assert.deepEqual(meta.providers.map((p) => [p.status, p.errorCode]), [["failed", "http-503"], ["failed", "http-503"]]);
  const hung = harness({ feeds: "hang" });
  const hungId = await bootstrapCriteria(hung.store, bundle());
  const late = await service(hung, interpreter(irrelevant), 30).refresh();
  assert.deepEqual([late.snapshotId, late.lastSuccessfulCheckAt], [hungId, null]);
  assert.match(late.notices.join(" "), /deadline/);
  assert.equal((await hung.store.readRefreshState()).leaseGeneration, null);
});

test("after a restart the saved queue, providers and criteria are reread", async () => {
  const h = harness();
  await bootstrapCriteria(h.store, bundle());
  const before = await service(h, interpreter(irrelevant)).refresh();
  const restarted = createRefreshService({ store: new MemoryCriteriaStore({ backing: h.backing, now: () => h.clock.ms() }), reference: ctx.reference, config,
    fetcher: h.fetcher, interpreter: interpreter(irrelevant), now: h.iso });
  const after = await restarted.loadState();
  assert.deepEqual([after.snapshotId, after.deferredItemCount, after.providers, after.lastSuccessfulCheckAt],
    [before.snapshotId, before.deferredItemCount, before.providers, before.lastSuccessfulCheckAt]);
});

test("a version built from cached sources while the feeds are down does not advance the successful-check time", async () => {
  const h = harness(), calls: InterpretationInput[] = [];
  const base = await bootstrapCriteria(h.store, bundle());
  const first = await service(h, interpreter(irrelevant, calls)).refresh();
  const firstCheck = first.lastSuccessfulCheckAt;
  assert.ok(firstCheck);
  h.mode.feeds = "down"; h.clock.advance(61_000);
  const second = await service(h, interpreter(admitFirst, calls)).refresh();
  assert.equal(calls.length, 2, "a cached waiting item was interpreted");
  assert.notEqual(second.snapshotId, base, "the cached item still produced a new version");
  assert.deepEqual([second.lastSuccessfulCheckAt, second.status], [firstCheck, "partial"]);
  assert.ok(second.providers.every((p) => p.status === "failed"));
});

test("a deadline after a healthy check remains visible after rereading saved status", async () => {
  const h = harness();
  const id = await bootstrapCriteria(h.store, bundle());
  const reservation = await h.store.reserveRefresh();
  assert.equal(reservation.status, "acquired");
  if (reservation.status !== "acquired") return;
  const head = await h.store.readRefreshState();
  await h.store.saveRefreshState(reservation.generation, { ...head.state, providers: SOURCE_PROVIDERS.map((p) => ({
    providerId: p.providerId, status: "ok" as const, lastAttemptAt: h.iso(), lastSuccessfulCheckAt: h.iso(),
  })) }, true);
  await h.store.releaseRefresh(reservation.generation);
  const svc = service(h, interpreter(irrelevant), 30);
  assert.equal((await svc.loadState()).status, "fresh");
  h.clock.advance(61_000); h.mode.feeds = "hang";
  await svc.refresh();
  const reread = await service(h, interpreter(irrelevant)).loadState();
  assert.equal(reread.snapshotId, id);
  assert.equal(reread.status, "partial");
  assert.match(reread.notices.join(" "), /deadline/i);
  assert.equal(Date.parse(reread.lastSuccessfulCheckAt!), T0);
});
