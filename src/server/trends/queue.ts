import { createHash } from "node:crypto";
import { Instant } from "../contracts/trends.ts";
import type { InterpretationOutcome, QueueItem, QueueState, SourceItem, WorkSelection } from "../contracts/trends.ts";

// Pure, bounded interpretation queue. The Phase 4 refresh service persists the
// state, holds the shared lease and calls these in order: enqueue, select,
// recordDispatch (before the model call), then recordInterpretationOutcome.
export const QUEUE_LIMITS = { totalActive: 48, perProvider: 24, newPerTurn: 2, retryPerTurn: 1, maxInputFailures: 3,
  retryWaitsMs: [300_000, 1_800_000], modelBackoffMs: 300_000 } as const;
export const QUEUE_HISTORY_LIMIT = 200;

const active = (item: QueueItem) => item.state === "pending" || item.state === "retry-wait";
const time = (value: string) => Date.parse(Instant.parse(value));
const iso = (ms: number) => new Date(ms).toISOString();
const code = (value: string) => value.slice(0, 100);

export function emptyQueue(): QueueState {
  return { items: [], nextWorkClass: "new", nextProviderId: "", modelRetryAfterAt: null };
}

// Source identity, content and semantic interpreter context; never check times.
export function queueKey(sourceId: string, contentHash: string, interpreterFingerprint: string): string {
  return createHash("sha256").update(JSON.stringify([sourceId, contentHash, interpreterFingerprint])).digest("hex");
}

// Unchanged content keeps its key and failure budget. Changed content or
// context gets a new key; superseded active work leaves the queue, while
// processed/quarantined records stay as audit history. Overflow keeps the
// oldest waiting entries and reports skipped new ones; later checks retry them.
// The caller must resupply every cached deferred item when the context changes.
export function enqueueSourceItems(state: QueueState, sources: SourceItem[], interpreterFingerprint: string, now: string): { state: QueueState; skipped: number } {
  const queuedAt = iso(time(now));
  let items = state.items.filter((i) => !(active(i) && i.interpreterFingerprint !== interpreterFingerprint));
  let skipped = 0;
  for (const source of sources) {
    const key = queueKey(source.sourceId, source.contentHash, interpreterFingerprint);
    if (items.some((i) => i.key === key)) continue;
    items = items.filter((i) => !(active(i) && i.sourceId === source.sourceId));
    const live = items.filter(active);
    if (live.length >= QUEUE_LIMITS.totalActive || live.filter((i) => i.providerId === source.providerId).length >= QUEUE_LIMITS.perProvider) { skipped++; continue; }
    items.push({ key, sourceId: source.sourceId, providerId: source.providerId, contentHash: source.contentHash, interpreterFingerprint,
      state: "pending", firstQueuedAt: queuedAt, lastAttemptAt: null, attemptCount: 0, inputFailureCount: 0, nextAttemptAt: null, lastErrorCode: null });
  }
  return { state: { ...state, items }, skipped };
}

function providerOrder(state: QueueState): string[] {
  const providers = [...new Set(state.items.map((i) => i.providerId))].sort();
  const start = Math.max(0, providers.findIndex((p) => p >= state.nextProviderId));
  return [...providers.slice(start), ...providers.slice(0, start)];
}

// At most two new items, or exactly one ready retry, or nothing. Classes
// alternate when both are eligible; within a class providers alternate, then
// oldest-ready and source-ID order. Waiting/quarantined items are skipped.
export function selectInterpretationWork(state: QueueState, now: string): WorkSelection {
  const at = time(now);
  if (state.modelRetryAfterAt && at < time(state.modelRetryAfterAt)) return { kind: "none", keys: [] };
  const order = providerOrder(state);
  const sorted = (items: QueueItem[], ready: (i: QueueItem) => string) => order.map((p) => items.filter((i) => i.providerId === p)
    .sort((a, b) => time(ready(a)) - time(ready(b)) || (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0)));
  const fresh = sorted(state.items.filter((i) => i.state === "pending"), (i) => i.firstQueuedAt);
  const retry = sorted(state.items.filter((i) => i.state === "retry-wait" && i.nextAttemptAt !== null && time(i.nextAttemptAt) <= at), (i) => i.nextAttemptAt!);
  const hasFresh = fresh.some((g) => g.length), hasRetry = retry.some((g) => g.length);
  const kind = hasFresh && hasRetry ? state.nextWorkClass : hasFresh ? "new" : hasRetry ? "retry" : "none";
  if (kind === "none") return { kind, keys: [] };
  const groups = (kind === "new" ? fresh : retry).map((g) => [...g]);
  const limit = kind === "new" ? QUEUE_LIMITS.newPerTurn : QUEUE_LIMITS.retryPerTurn;
  const keys: string[] = [];
  while (keys.length < limit && groups.some((g) => g.length)) {
    for (const group of groups) if (keys.length < limit && group.length) keys.push(group.shift()!.key);
  }
  return { kind, keys };
}

// Record the reserved model call and advance fairness before dispatching, so a
// crash can leave one recorded attempt but never a free reset of the order.
export function recordDispatch(state: QueueState, work: WorkSelection, now: string): QueueState {
  if (work.kind === "none") return state;
  const at = iso(time(now)), keys = new Set(work.keys);
  const first = state.items.find((i) => i.key === work.keys[0]);
  const providers = [...new Set(state.items.map((i) => i.providerId))].sort();
  const nextProviderId = first ? providers[(providers.indexOf(first.providerId) + 1) % providers.length] : state.nextProviderId;
  return { ...state, nextWorkClass: work.kind === "new" ? "retry" : "new", nextProviderId,
    items: state.items.map((i) => keys.has(i.key) ? { ...i, attemptCount: i.attemptCount + 1, lastAttemptAt: at } : i) };
}

// A batch failure charges each included item once; provider failures back off
// model work without charging articles. Irrelevant results are finished work.
export function recordInterpretationOutcome(state: QueueState, work: WorkSelection, outcome: InterpretationOutcome, now: string): QueueState {
  if (work.kind === "none") return state;
  const at = time(now), keys = new Set(work.keys);
  if (outcome.status === "provider-failure") {
    const observed = outcome.retryAfterAt && Instant.safeParse(outcome.retryAfterAt).success ? Date.parse(outcome.retryAfterAt) : 0;
    return { ...state, modelRetryAfterAt: iso(Math.max(at + QUEUE_LIMITS.modelBackoffMs, observed)) };
  }
  let failure = outcome.status === "input-failure" ? code(outcome.errorCode) : null;
  if (outcome.status === "success") {
    const expected = state.items.filter((i) => keys.has(i.key)).map((i) => i.sourceId).sort();
    const returned = outcome.interpretation.items.map((i) => i.sourceId).sort();
    if (JSON.stringify(expected) !== JSON.stringify(returned)) failure = "incomplete-interpretation";
  }
  return { ...state, items: state.items.map((i): QueueItem => {
    if (!keys.has(i.key)) return i;
    if (failure === null) return { ...i, state: "processed", nextAttemptAt: null, lastErrorCode: null };
    const count = i.inputFailureCount + 1;
    return count >= QUEUE_LIMITS.maxInputFailures ? { ...i, state: "quarantined", inputFailureCount: count, nextAttemptAt: null, lastErrorCode: failure }
      : { ...i, state: "retry-wait", inputFailureCount: count, nextAttemptAt: iso(at + QUEUE_LIMITS.retryWaitsMs[count - 1]), lastErrorCode: failure };
  }) };
}

// Counts for TrendMeta. Quarantine counts only each source's latest key, so a
// superseded audit record does not inflate the skipped-update notice.
export function queueCounts(state: QueueState): { deferredItemCount: number; quarantinedItemCount: number } {
  const latest = new Map<string, QueueItem>();
  for (const item of state.items) {
    const seen = latest.get(item.sourceId);
    if (!seen || Date.parse(item.firstQueuedAt) >= Date.parse(seen.firstQueuedAt)) latest.set(item.sourceId, item);
  }
  return { deferredItemCount: state.items.filter(active).length, quarantinedItemCount: [...latest.values()].filter((i) => i.state === "quarantined").length };
}

// Keeps every active item and the newest finished/quarantined records, so the
// persisted state stays bounded. A pruned finished item that reappears in a
// feed is queued again; its accepted evidence is already in the criteria.
export function pruneQueueHistory(state: QueueState, limit: number = QUEUE_HISTORY_LIMIT): QueueState {
  const stamp = (i: QueueItem) => Date.parse(i.lastAttemptAt ?? i.firstQueuedAt);
  const kept = new Set(state.items.filter((i) => !active(i)).sort((a, b) => stamp(b) - stamp(a)).slice(0, limit).map((i) => i.key));
  return { ...state, items: state.items.filter((i) => active(i) || kept.has(i.key)) };
}
