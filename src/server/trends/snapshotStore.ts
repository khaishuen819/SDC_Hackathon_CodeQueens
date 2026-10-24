import { RefreshPublicState } from "../contracts/trends.ts";
import type { CriteriaBundle, CriteriaSnapshot, PublishResult, RefreshReservation, RefreshState, SnapshotId } from "../contracts/trends.ts";
import { validateCriteriaBundle } from "./policy.ts";
import { criteriaSnapshotId } from "./identity.ts";
import { emptyQueue } from "./queue.ts";

// Durable criteria versions. Snapshots are immutable and content-addressed;
// one "pilot" head points at the current one and holds the shared refresh
// lease, cooldown and public queue/cache state. No personal data is stored.
export const REFRESH_TIMING = { leaseMs: 75_000, cooldownMs: 60_000 } as const;
export type RefreshTiming = { leaseMs: number; cooldownMs: number };

export interface CriteriaStore {
  // Only an acquired reservation may fetch sources or call the model.
  reserveRefresh(): Promise<RefreshReservation>;
  // No id: the current head's snapshot. null when none exists yet.
  readSnapshot(id?: SnapshotId): Promise<CriteriaSnapshot | null>;
  readRefreshState(): Promise<RefreshState>;
  // Lease-guarded; false when the lease was lost. checked = a provider check succeeded.
  saveRefreshState(generation: bigint, state: RefreshPublicState, checked: boolean): Promise<boolean>;
  // Snapshot + head change together, only for the current base, a newer generation and the held lease.
  publishIfCurrent(baseId: SnapshotId | null, generation: bigint, bundle: CriteriaBundle, state: RefreshPublicState): Promise<PublishResult>;
  // Keeps the last valid snapshot and success time; optionally saves queue/provider state.
  recordFailure(generation: bigint, state: RefreshPublicState | null): Promise<void>;
  // Clears only this generation's lease; the cooldown remains.
  releaseRefresh(generation: bigint): Promise<void>;
  // Stores a validated baseline only when no head snapshot exists; returns the current head id.
  bootstrap(bundle: CriteriaBundle): Promise<SnapshotId>;
}

export function emptyPublicState(): RefreshPublicState {
  return { providers: [], sources: [], queue: emptyQueue(), notices: [] };
}
export function emptyHead(): RefreshState {
  return { snapshotId: null, nextGeneration: 0n, publishedGeneration: 0n, leaseGeneration: null, leaseExpiresAt: null, nextAllowedAt: null,
    lastAttemptAt: null, lastSuccessfulCheckAt: null, state: emptyPublicState() };
}
const iso = (ms: number) => new Date(ms).toISOString();

// Pure rules shared by every store so they cannot drift apart. now is the
// store's clock (database time for PostgreSQL).
export function decideReservation(head: RefreshState, now: number, timing: RefreshTiming):
  { status: "acquired"; generation: bigint; leaseExpiresAt: string; nextAllowedAt: string } | { status: "busy" | "cooldown"; retryAt: string } {
  if (head.leaseGeneration !== null && head.leaseExpiresAt && Date.parse(head.leaseExpiresAt) > now) return { status: "busy", retryAt: head.leaseExpiresAt };
  if (head.nextAllowedAt && now < Date.parse(head.nextAllowedAt)) return { status: "cooldown", retryAt: head.nextAllowedAt };
  return { status: "acquired", generation: head.nextGeneration + 1n, leaseExpiresAt: iso(now + timing.leaseMs), nextAllowedAt: iso(now + timing.cooldownMs) };
}
export function leaseHeld(head: RefreshState, generation: bigint, now: number): boolean {
  return head.leaseGeneration === generation && !!head.leaseExpiresAt && Date.parse(head.leaseExpiresAt) > now;
}
export function canPublish(head: RefreshState, baseId: SnapshotId | null, generation: bigint, now: number): boolean {
  return leaseHeld(head, generation, now) && head.snapshotId === baseId && generation > head.publishedGeneration;
}
// Re-derives the id from the stored payload so a corrupted row is never served.
export function checkedSnapshot(id: string, createdAt: string, payload: unknown): CriteriaSnapshot {
  const bundle = validateCriteriaBundle(payload);
  if (criteriaSnapshotId(bundle) !== id) throw new Error("Snapshot integrity check failed.");
  return { id: id as SnapshotId, createdAt, bundle };
}

export type MemoryBacking = { snapshots: Map<string, { createdAt: string; payload: string }>; head: RefreshState | null };

// In-process store for tests and local development. Payloads are kept as JSON
// text so callers can never mutate stored data; a new instance over the same
// backing simulates a process restart.
export class MemoryCriteriaStore implements CriteriaStore {
  static emptyBacking(): MemoryBacking { return { snapshots: new Map(), head: null }; }
  private backing: MemoryBacking;
  private now: () => number;
  private timing: RefreshTiming;
  constructor(options: { backing?: MemoryBacking; now?: () => number } & Partial<RefreshTiming> = {}) {
    this.backing = options.backing ?? MemoryCriteriaStore.emptyBacking();
    this.now = options.now ?? Date.now;
    this.timing = { leaseMs: options.leaseMs ?? REFRESH_TIMING.leaseMs, cooldownMs: options.cooldownMs ?? REFRESH_TIMING.cooldownMs };
  }
  private head(): RefreshState { return structuredClone(this.backing.head ?? emptyHead()); }
  private write(head: RefreshState) { this.backing.head = structuredClone(head); }
  private insert(bundle: CriteriaBundle): SnapshotId {
    const valid = validateCriteriaBundle(bundle), id = criteriaSnapshotId(valid);
    if (!this.backing.snapshots.has(id)) this.backing.snapshots.set(id, { createdAt: iso(this.now()), payload: JSON.stringify(valid) });
    return id;
  }

  async reserveRefresh(): Promise<RefreshReservation> {
    const head = this.head(), now = this.now(), decision = decideReservation(head, now, this.timing);
    if (decision.status !== "acquired") return decision;
    this.write({ ...head, nextGeneration: decision.generation, leaseGeneration: decision.generation, leaseExpiresAt: decision.leaseExpiresAt,
      nextAllowedAt: decision.nextAllowedAt, lastAttemptAt: iso(now) });
    return { status: "acquired", generation: decision.generation, baseSnapshotId: head.snapshotId, leaseExpiresAt: decision.leaseExpiresAt };
  }
  async readSnapshot(id?: SnapshotId): Promise<CriteriaSnapshot | null> {
    const target = id ?? this.head().snapshotId;
    const row = target ? this.backing.snapshots.get(target) : undefined;
    return row && target ? checkedSnapshot(target, row.createdAt, JSON.parse(row.payload)) : null;
  }
  async readRefreshState(): Promise<RefreshState> {
    const head = this.head();
    return { ...head, state: RefreshPublicState.parse(head.state) };
  }
  async saveRefreshState(generation: bigint, state: RefreshPublicState, checked: boolean): Promise<boolean> {
    const valid = RefreshPublicState.parse(state), head = this.head(), now = this.now();
    if (!leaseHeld(head, generation, now)) return false;
    this.write({ ...head, state: valid, lastSuccessfulCheckAt: checked ? iso(now) : head.lastSuccessfulCheckAt });
    return true;
  }
  async publishIfCurrent(baseId: SnapshotId | null, generation: bigint, bundle: CriteriaBundle, state: RefreshPublicState): Promise<PublishResult> {
    const valid = RefreshPublicState.parse(state), head = this.head(), now = this.now();
    if (!canPublish(head, baseId, generation, now)) return { status: "conflict", snapshot: await this.readSnapshot() };
    const id = criteriaSnapshotId(validateCriteriaBundle(bundle));
    if (id === head.snapshotId) {
      this.write({ ...head, state: valid, lastSuccessfulCheckAt: iso(now) });
      return { status: "unchanged", snapshot: await this.readSnapshot(id) };
    }
    this.insert(bundle);
    this.write({ ...head, snapshotId: id, publishedGeneration: generation, state: valid, lastSuccessfulCheckAt: iso(now) });
    return { status: "published", snapshot: await this.readSnapshot(id) };
  }
  async recordFailure(generation: bigint, state: RefreshPublicState | null): Promise<void> {
    const valid = state ? RefreshPublicState.parse(state) : null, head = this.head();
    if (valid && leaseHeld(head, generation, this.now())) this.write({ ...head, state: valid });
  }
  async releaseRefresh(generation: bigint): Promise<void> {
    const head = this.head();
    if (head.leaseGeneration === generation) this.write({ ...head, leaseGeneration: null, leaseExpiresAt: null });
  }
  async bootstrap(bundle: CriteriaBundle): Promise<SnapshotId> {
    const head = this.head();
    if (head.snapshotId) return head.snapshotId;
    const id = this.insert(bundle);
    this.write({ ...head, snapshotId: id });
    return id;
  }
}
