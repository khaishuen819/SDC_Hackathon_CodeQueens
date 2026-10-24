// Shared behaviour every CriteriaStore must satisfy. Run by snapshotStore.test.ts
// for the in-memory store and by the database tests when TEST_DATABASE_URL is set.
// FICTIONAL bundles only; nothing here contains personal data.
import test from "node:test";
import assert from "node:assert/strict";
import type { CriteriaBundle, RefreshPublicState } from "../contracts/trends.ts";
import type { CriteriaStore } from "./snapshotStore.ts";
import { emptyPublicState } from "./snapshotStore.ts";
import { criteriaSnapshotId } from "./identity.ts";
import { bundle } from "./testFixtures.ts";

export type StoreHarness = { a: CriteriaStore; b: CriteriaStore; restart(): Promise<CriteriaStore>; cleanup(): Promise<void> };
export const CONTRACT_TIMING = { leaseMs: 400, cooldownMs: 200 } as const;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const changed = (n: number): CriteriaBundle => { const b = bundle(); b.interpreterVersion = `fictional-changed-version-${n}`; return b; };
const stateWith = (notice: string): RefreshPublicState => ({ ...emptyPublicState(), notices: [notice] });

export function describeCriteriaStore(name: string, open: () => Promise<StoreHarness>, options: { skip?: string } = {}) {
  const it = (title: string, body: (h: StoreHarness) => Promise<void>) => test(`${name}: ${title}`, { skip: options.skip }, async () => {
    const h = await open();
    try { await body(h); } finally { await h.cleanup(); }
  });

  it("an empty store has no snapshot and a clean public state", async ({ a }) => {
    assert.equal(await a.readSnapshot(), null);
    const state = await a.readRefreshState();
    assert.deepEqual({ ...state, lastAttemptAt: null }, { snapshotId: null, nextGeneration: 0n, publishedGeneration: 0n, leaseGeneration: null,
      leaseExpiresAt: null, nextAllowedAt: null, lastAttemptAt: null, lastSuccessfulCheckAt: null, state: emptyPublicState() });
  });

  it("bootstrap stores a validated baseline once and never replaces an existing head", async ({ a, b }) => {
    await assert.rejects(a.bootstrap({ ...bundle(), roles: [] } as CriteriaBundle));
    assert.equal(await a.readSnapshot(), null);
    const id = await a.bootstrap(bundle());
    assert.equal(id, criteriaSnapshotId(bundle()));
    assert.deepEqual((await b.readSnapshot())?.bundle, bundle());
    assert.equal(await b.bootstrap(changed(9)), id);
    assert.equal((await a.readRefreshState()).snapshotId, id);
  });

  it("one reservation at a time: busy while leased, cooldown after release, then the next generation", async ({ a, b }) => {
    const first = await a.reserveRefresh();
    assert.equal(first.status, "acquired");
    if (first.status !== "acquired") return;
    assert.equal(first.generation, 1n);
    const busy = await b.reserveRefresh();
    assert.equal(busy.status, "busy");
    assert.equal(busy.status === "busy" && busy.retryAt, first.leaseExpiresAt);
    await a.releaseRefresh(first.generation);
    assert.equal((await b.reserveRefresh()).status, "cooldown");
    await wait(CONTRACT_TIMING.cooldownMs + 50);
    const second = await b.reserveRefresh();
    assert.equal(second.status === "acquired" && second.generation, 2n);
  });

  it("an expired lease is recoverable, and the stalled worker cannot publish or clear its successor", async ({ a, b }) => {
    await a.bootstrap(bundle());
    const stalled = await a.reserveRefresh();
    await wait(CONTRACT_TIMING.leaseMs + 50);
    const successor = await b.reserveRefresh();
    assert.equal(successor.status, "acquired");
    if (stalled.status !== "acquired" || successor.status !== "acquired") return;
    assert.equal((await a.publishIfCurrent(stalled.baseSnapshotId, stalled.generation, changed(1), stateWith("stale"))).status, "conflict");
    assert.equal(await a.saveRefreshState(stalled.generation, stateWith("stale"), true), false);
    await a.releaseRefresh(stalled.generation);
    assert.equal((await a.reserveRefresh()).status, "busy", "the successor's lease survives the stale release");
    assert.equal((await b.publishIfCurrent(successor.baseSnapshotId, successor.generation, changed(2), stateWith("fresh"))).status, "published");
  });

  it("publication is atomic and immutable; duplicates and older or mismatched bases do not clobber the head", async ({ a, b }) => {
    const baseId = await a.bootstrap(bundle());
    const run = await a.reserveRefresh();
    if (run.status !== "acquired") return assert.fail("expected a reservation");
    assert.equal((await a.publishIfCurrent("criteria-" + "f".repeat(64), run.generation, changed(1), stateWith("x"))).status, "conflict");
    const same = await a.publishIfCurrent(baseId, run.generation, bundle(), stateWith("checked"));
    assert.equal(same.status, "unchanged"); assert.equal(same.snapshot?.id, baseId);
    const published = await a.publishIfCurrent(baseId, run.generation, changed(1), stateWith("published"));
    assert.equal(published.status, "published");
    assert.equal(published.snapshot?.id, criteriaSnapshotId(changed(1)));
    const head = await b.readRefreshState();
    assert.deepEqual([head.snapshotId, head.publishedGeneration, head.state.notices], [published.snapshot!.id, run.generation, ["published"]]);
    assert.ok(head.lastSuccessfulCheckAt);
    assert.deepEqual((await b.readSnapshot(baseId))?.bundle, bundle(), "earlier snapshots stay readable and unchanged");
    assert.equal((await a.publishIfCurrent(baseId, run.generation, changed(2), stateWith("old base"))).status, "conflict");
    assert.equal((await a.publishIfCurrent(published.snapshot!.id, run.generation, changed(3), stateWith("twice"))).status, "conflict",
      "one generation publishes at most once");
    await a.releaseRefresh(run.generation);
  });

  it("refresh state is lease-guarded, validated and survives a restart", async (h) => {
    await h.a.bootstrap(bundle());
    const run = await h.a.reserveRefresh();
    if (run.status !== "acquired") return assert.fail("expected a reservation");
    const state: RefreshPublicState = { ...emptyPublicState(), notices: ["FICTIONAL notice"],
      queue: { items: [{ key: "a".repeat(64), sourceId: "github-changelog-0000000000000001", providerId: "github-changelog", contentHash: "b".repeat(64),
        interpreterFingerprint: "c".repeat(64), state: "retry-wait", firstQueuedAt: "2026-10-24T10:00:00.000Z", lastAttemptAt: "2026-10-24T10:00:00.000Z",
        attemptCount: 1, inputFailureCount: 1, nextAttemptAt: "2026-10-24T10:05:00.000Z", lastErrorCode: "truncated-output" }],
        nextWorkClass: "retry", nextProviderId: "jetbrains-ai", modelRetryAfterAt: null } };
    await assert.rejects(h.a.saveRefreshState(run.generation, { ...state, profile: { confirmedSkills: [] } } as unknown as RefreshPublicState, true));
    assert.equal(await h.a.saveRefreshState(run.generation, state, true), true);
    await h.a.recordFailure(run.generation, null);
    await h.a.releaseRefresh(run.generation);
    assert.equal(await h.a.saveRefreshState(run.generation, stateWith("after release"), true), false);
    const restarted = await h.restart();
    const reread = await restarted.readRefreshState();
    assert.deepEqual(reread.state, state);
    assert.equal(reread.snapshotId, criteriaSnapshotId(bundle()));
    assert.deepEqual((await restarted.readSnapshot())?.bundle, bundle(), "the last valid snapshot is reread after a restart");
  });
}
