import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { QueueState, SourceItem, InterpretationOutcome } from "../contracts/trends.ts";
import { emptyQueue, enqueueSourceItems, selectInterpretationWork, recordDispatch, recordInterpretationOutcome, queueCounts, pruneQueueHistory, QUEUE_LIMITS, QUEUE_HISTORY_LIMIT } from "./queue.ts";

// FICTIONAL queue inputs: only identity fields matter here.
const T0 = "2026-10-24T10:00:00.000Z";
const at = (minutes: number) => new Date(Date.parse(T0) + minutes * 60_000).toISOString();
const FP = "fingerprint-a";
function source(provider: string, n: number, text = `FICTIONAL ${provider} ${n}`): SourceItem {
  return { sourceId: `${provider}-${String(n).padStart(16, "0")}`, providerId: provider, canonicalUrl: `https://github.blog/fictional/${provider}/${n}`,
    title: `FICTIONAL ${n}`, publishedAt: T0, dateBasis: "published", text, contentHash: createHash("sha256").update(text).digest("hex"), extractedLinks: [] };
}
const many = (provider: string, count: number) => Array.from({ length: count }, (_, n) => source(provider, n + 1));
const success = (state: QueueState, keys: string[]): InterpretationOutcome => ({ status: "success", interpretation: {
  items: keys.map((k) => ({ sourceId: state.items.find((i) => i.key === k)!.sourceId, mappings: [] })) } });
const inputFailure: InterpretationOutcome = { status: "input-failure", errorCode: "truncated-output" };
const byKey = (state: QueueState, key: string) => state.items.find((i) => i.key === key)!;
// One acquired model turn, as Phase 4's refresh service will drive it.
function turn(state: QueueState, now: string, outcome: (s: QueueState, keys: string[]) => InterpretationOutcome) {
  const work = selectInterpretationWork(state, now);
  if (work.kind === "none") return { state, work };
  const dispatched = recordDispatch(state, work, now);
  return { state: recordInterpretationOutcome(dispatched, work, outcome(dispatched, work.keys), now), work };
}

test("enqueue is idempotent per content and context; changes make new keys but keep audit history", () => {
  let { state } = enqueueSourceItems(emptyQueue(), [source("alpha", 1)], FP, T0);
  const [first] = state.items;
  assert.match(first.key, /^[a-f0-9]{64}$/);
  assert.deepEqual({ ...first, key: "" }, { key: "", sourceId: source("alpha", 1).sourceId, providerId: "alpha", contentHash: source("alpha", 1).contentHash,
    interpreterFingerprint: FP, state: "pending", firstQueuedAt: T0, lastAttemptAt: null, attemptCount: 0, inputFailureCount: 0, nextAttemptAt: null, lastErrorCode: null });
  state = turn(state, T0, () => inputFailure).state;
  // A later feed check of unchanged content cannot reset the failure budget.
  state = enqueueSourceItems(state, [source("alpha", 1)], FP, at(1)).state;
  assert.equal(state.items.length, 1); assert.equal(byKey(state, first.key).inputFailureCount, 1);
  // Changed content: new key and budget; the superseded active entry leaves the queue.
  state = enqueueSourceItems(state, [source("alpha", 1, "FICTIONAL changed text")], FP, at(2)).state;
  assert.equal(state.items.length, 1); assert.notEqual(state.items[0].key, first.key); assert.equal(state.items[0].inputFailureCount, 0);
  // Changed interpreter context re-keys active work but keeps quarantined audit records.
  let q = enqueueSourceItems(emptyQueue(), [source("alpha", 1), source("alpha", 2)], FP, T0).state;
  q.items[0] = { ...q.items[0], state: "quarantined", inputFailureCount: 3, lastErrorCode: "truncated-output" };
  q = enqueueSourceItems(q, [source("alpha", 1), source("alpha", 2)], "fingerprint-b", at(1)).state;
  assert.equal(q.items.filter((i) => i.state === "quarantined" && i.interpreterFingerprint === FP).length, 1);
  assert.equal(q.items.filter((i) => i.state === "pending" && i.interpreterFingerprint === "fingerprint-b").length, 2);
  assert.deepEqual(queueCounts(q), { deferredItemCount: 2, quarantinedItemCount: 0 });
});

test("capacity is 48 active items and 24 per provider; overflow is explicit and quarantine frees capacity", () => {
  assert.deepEqual(QUEUE_LIMITS, { totalActive: 48, perProvider: 24, newPerTurn: 2, retryPerTurn: 1, maxInputFailures: 3, retryWaitsMs: [300_000, 1_800_000], modelBackoffMs: 300_000 });
  const one = enqueueSourceItems(emptyQueue(), many("alpha", 30), FP, T0);
  assert.equal(one.state.items.length, 24); assert.equal(one.skipped, 6);
  assert.deepEqual(one.state.items.map((i) => i.sourceId), many("alpha", 24).map((s) => s.sourceId));
  const two = enqueueSourceItems(one.state, [...many("alpha", 30), ...many("beta", 30)], FP, at(1));
  assert.equal(two.state.items.length, 48); assert.equal(two.skipped, 6 + 6);
  const freed = { ...two.state, items: two.state.items.map((i, n) => n === 0 ? { ...i, state: "quarantined" as const } : i) };
  const again = enqueueSourceItems(freed, many("alpha", 30), FP, at(2));
  assert.equal(again.state.items.filter((i) => i.providerId === "alpha" && i.state === "pending").length, 24);
  assert.equal(again.skipped, 5);
});

test("twelve discovered items give one two-item turn, one per provider, with the rest deferred", () => {
  const state = enqueueSourceItems(emptyQueue(), [...many("alpha", 6), ...many("beta", 6)], FP, T0).state;
  const work = selectInterpretationWork(state, T0);
  assert.equal(work.kind, "new"); assert.equal(work.keys.length, 2);
  assert.deepEqual(work.keys.map((k) => byKey(state, k).providerId).sort(), ["alpha", "beta"]);
  const after = recordInterpretationOutcome(recordDispatch(state, work, T0), work, success(state, work.keys), T0);
  assert.deepEqual(queueCounts(after), { deferredItemCount: 10, quarantinedItemCount: 0 });
  assert.deepEqual(work.keys.map((k) => [byKey(after, k).state, byKey(after, k).attemptCount]), [["processed", 1], ["processed", 1]]);
  assert.deepEqual(selectInterpretationWork(emptyQueue(), T0), { kind: "none", keys: [] });
});

test("input failures wait 5 then 30 minutes, then quarantine; a failed pair retries one at a time", () => {
  let state = enqueueSourceItems(emptyQueue(), [source("alpha", 1), source("beta", 1)], FP, T0).state;
  const pair = turn(state, T0, () => inputFailure);
  state = pair.state;
  assert.equal(pair.work.keys.length, 2);
  for (const key of pair.work.keys) assert.deepEqual([byKey(state, key).state, byKey(state, key).inputFailureCount, byKey(state, key).nextAttemptAt], ["retry-wait", 1, at(5)]);
  assert.equal(selectInterpretationWork(state, at(4.99)).kind, "none");
  const retry = selectInterpretationWork(state, at(5));
  assert.equal(retry.kind, "retry"); assert.equal(retry.keys.length, 1);
  const second = turn(state, at(5), () => inputFailure);
  state = second.state;
  const bad = second.work.keys[0], other = pair.work.keys.find((k) => k !== bad)!;
  assert.deepEqual([byKey(state, bad).inputFailureCount, byKey(state, bad).nextAttemptAt], [2, at(35)]);
  // The other pair member is retried alone and succeeds; the bad article cannot poison it.
  const healthy = turn(state, at(6), success);
  assert.deepEqual(healthy.work.keys, [other]);
  state = healthy.state;
  assert.equal(byKey(state, other).state, "processed");
  assert.equal(selectInterpretationWork(state, at(34.99)).kind, "none");
  state = turn(state, at(35), () => inputFailure).state;
  assert.deepEqual([byKey(state, bad).state, byKey(state, bad).inputFailureCount, byKey(state, bad).nextAttemptAt], ["quarantined", 3, null]);
  assert.equal(selectInterpretationWork(state, at(600)).kind, "none");
  assert.deepEqual(queueCounts(state), { deferredItemCount: 0, quarantinedItemCount: 1 });
});

test("retries cannot monopolise turns: new work runs within two turns when both are eligible", () => {
  // Four broken FICTIONAL articles are all ready to retry when healthy ones arrive.
  let state = enqueueSourceItems(emptyQueue(), many("alpha", 4), FP, T0).state;
  state = turn(state, T0, () => inputFailure).state;
  state = turn(state, T0, () => inputFailure).state;
  state = enqueueSourceItems(state, many("beta", 4), FP, at(1)).state;
  const kinds: string[] = [];
  for (const minute of [10, 11, 12, 13]) {
    const next = turn(state, at(minute), (s, keys) => keys.some((k) => byKey(s, k).providerId === "alpha") ? inputFailure : success(s, keys));
    kinds.push(next.work.kind); state = next.state;
  }
  assert.deepEqual(kinds, ["retry", "new", "retry", "new"]);
  assert.equal(state.items.filter((i) => i.providerId === "beta" && i.state === "processed").length, 4);
});

test("provider outages back off model work without blaming articles", () => {
  let state = enqueueSourceItems(emptyQueue(), [source("alpha", 1), source("beta", 1)], FP, T0).state;
  state = turn(state, T0, () => ({ status: "provider-failure", errorCode: "quota" })).state;
  assert.ok(state.items.every((i) => i.state === "pending" && i.inputFailureCount === 0 && i.attemptCount === 1));
  assert.equal(state.modelRetryAfterAt, at(5));
  assert.equal(selectInterpretationWork(state, at(4.99)).kind, "none");
  assert.equal(selectInterpretationWork(state, at(5)).kind, "new");
  const later = turn(state, at(5), () => ({ status: "provider-failure", errorCode: "quota", retryAfterAt: at(60) })).state;
  assert.equal(later.modelRetryAfterAt, at(60));
  const earlier = turn(later, at(60), () => ({ status: "provider-failure", errorCode: "network", retryAfterAt: at(61) })).state;
  assert.equal(earlier.modelRetryAfterAt, at(65));
});

test("irrelevant results are finished outcomes; output that skips a source is an input failure", () => {
  let state = enqueueSourceItems(emptyQueue(), [source("alpha", 1), source("beta", 1)], FP, T0).state;
  const partial = turn(state, T0, (s, keys) => ({ status: "success", interpretation: { items: [{ sourceId: byKey(s, keys[0]).sourceId, mappings: [] }] } })).state;
  assert.ok(partial.items.every((i) => i.state === "retry-wait" && i.lastErrorCode === "incomplete-interpretation"));
  state = turn(state, T0, success).state;
  assert.ok(state.items.every((i) => i.state === "processed" && i.lastErrorCode === null));
});

test("queue state survives a JSON round trip, so restarts and new check times keep budgets", () => {
  let state = enqueueSourceItems(emptyQueue(), [source("alpha", 1)], FP, T0).state;
  state = turn(state, T0, () => inputFailure).state;
  const restored: QueueState = JSON.parse(JSON.stringify(state));
  const rechecked = enqueueSourceItems(restored, [source("alpha", 1)], FP, at(3)).state;
  assert.deepEqual(rechecked, state);
  assert.equal(selectInterpretationWork(rechecked, at(4)).kind, "none");
  assert.throws(() => selectInterpretationWork(state, "not a time"));
});

test("history is capped to the newest finished records while every active item is kept", () => {
  assert.equal(QUEUE_HISTORY_LIMIT, 200);
  let state = enqueueSourceItems(emptyQueue(), [...many("alpha", 5), ...many("beta", 2)], FP, T0).state;
  state = { ...state, items: state.items.map((i, n) => n < 5 ? { ...i, state: n === 4 ? "quarantined" as const : "processed" as const, lastAttemptAt: at(n) } : i) };
  const pruned = pruneQueueHistory(state, 3);
  assert.deepEqual(pruned.items.filter((i) => i.state === "pending").length, 2);
  assert.deepEqual(pruned.items.filter((i) => i.state !== "pending").map((i) => i.lastAttemptAt), [at(2), at(3), at(4)]);
  assert.deepEqual(pruneQueueHistory(state), state);
});
