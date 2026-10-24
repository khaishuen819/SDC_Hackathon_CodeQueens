import { RefreshPublicState } from "../contracts/trends.ts";
import type { CriteriaBundle, CriteriaSnapshot, PublishResult, RefreshReservation, RefreshState, SnapshotId } from "../contracts/trends.ts";
import type { Prisma, PrismaClient } from "../db/generated/prisma/client.ts";
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

type HeadRow = { snapshotId: string | null; nextGeneration: bigint; publishedGeneration: bigint; leaseGeneration: bigint | null;
  leaseExpiresAt: Date | null; nextAllowedAt: Date | null; lastAttemptAt: Date | null; lastSuccessAt: Date | null; state: unknown };
const fromRow = (row: HeadRow): RefreshState => ({
  snapshotId: row.snapshotId as SnapshotId | null, nextGeneration: BigInt(row.nextGeneration), publishedGeneration: BigInt(row.publishedGeneration),
  leaseGeneration: row.leaseGeneration === null ? null : BigInt(row.leaseGeneration), leaseExpiresAt: row.leaseExpiresAt?.toISOString() ?? null,
  nextAllowedAt: row.nextAllowedAt?.toISOString() ?? null, lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
  lastSuccessfulCheckAt: row.lastSuccessAt?.toISOString() ?? null, state: RefreshPublicState.parse(row.state),
});
const json = (value: unknown) => value as Prisma.InputJsonValue;

// PostgreSQL store. Every write locks the single head row (SELECT ... FOR
// UPDATE) inside one transaction and uses the database clock, so separate
// server instances share one lease, cooldown and publication order.
export class PrismaCriteriaStore implements CriteriaStore {
  private prisma: PrismaClient;
  private timing: RefreshTiming;
  constructor(prisma: PrismaClient, timing: RefreshTiming = REFRESH_TIMING) { this.prisma = prisma; this.timing = timing; }

  private async locked<T>(work: (tx: Prisma.TransactionClient, head: RefreshState, now: number) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO "CriteriaHead" ("key", "state") VALUES ('pilot', ${JSON.stringify(emptyPublicState())}::jsonb) ON CONFLICT ("key") DO NOTHING`;
      const [row] = await tx.$queryRaw<Array<HeadRow & { dbNow: Date }>>`SELECT *, now() AS "dbNow" FROM "CriteriaHead" WHERE "key" = 'pilot' FOR UPDATE`;
      return work(tx, fromRow(row), row.dbNow.getTime());
    });
  }
  private async snapshot(db: Prisma.TransactionClient | PrismaClient, id: string | null): Promise<CriteriaSnapshot | null> {
    const row = id ? await db.criteriaSnapshot.findUnique({ where: { id } }) : null;
    return row ? checkedSnapshot(row.id, row.createdAt.toISOString(), row.payload) : null;
  }
  private async insert(tx: Prisma.TransactionClient, bundle: CriteriaBundle): Promise<SnapshotId> {
    const valid = validateCriteriaBundle(bundle), id = criteriaSnapshotId(valid);
    await tx.criteriaSnapshot.createMany({ data: [{ id, schemaVersion: valid.schemaVersion, policyVersion: valid.policyVersion, payload: json(valid) }], skipDuplicates: true });
    return id;
  }
  private update(tx: Prisma.TransactionClient, data: Prisma.CriteriaHeadUpdateInput) {
    return tx.criteriaHead.update({ where: { key: "pilot" }, data });
  }

  async reserveRefresh(): Promise<RefreshReservation> {
    return this.locked(async (tx, head, now) => {
      const decision = decideReservation(head, now, this.timing);
      if (decision.status !== "acquired") return decision;
      await this.update(tx, { nextGeneration: decision.generation, leaseGeneration: decision.generation, leaseExpiresAt: new Date(decision.leaseExpiresAt),
        nextAllowedAt: new Date(decision.nextAllowedAt), lastAttemptAt: new Date(now) });
      return { status: "acquired" as const, generation: decision.generation, baseSnapshotId: head.snapshotId, leaseExpiresAt: decision.leaseExpiresAt };
    });
  }
  async readSnapshot(id?: SnapshotId): Promise<CriteriaSnapshot | null> {
    const target = id ?? (await this.prisma.criteriaHead.findUnique({ where: { key: "pilot" } }))?.snapshotId ?? null;
    return this.snapshot(this.prisma, target);
  }
  async readRefreshState(): Promise<RefreshState> {
    const row = await this.prisma.criteriaHead.findUnique({ where: { key: "pilot" } });
    return row ? fromRow(row) : emptyHead();
  }
  async saveRefreshState(generation: bigint, state: RefreshPublicState, checked: boolean): Promise<boolean> {
    const valid = RefreshPublicState.parse(state);
    return this.locked(async (tx, head, now) => {
      if (!leaseHeld(head, generation, now)) return false;
      await this.update(tx, { state: json(valid), ...(checked ? { lastSuccessAt: new Date(now) } : {}) });
      return true;
    });
  }
  async publishIfCurrent(baseId: SnapshotId | null, generation: bigint, bundle: CriteriaBundle, state: RefreshPublicState): Promise<PublishResult> {
    const valid = RefreshPublicState.parse(state), id = criteriaSnapshotId(validateCriteriaBundle(bundle));
    return this.locked(async (tx, head, now) => {
      if (!canPublish(head, baseId, generation, now)) return { status: "conflict" as const, snapshot: await this.snapshot(tx, head.snapshotId) };
      if (id === head.snapshotId) {
        await this.update(tx, { state: json(valid), lastSuccessAt: new Date(now) });
        return { status: "unchanged" as const, snapshot: await this.snapshot(tx, id) };
      }
      await this.insert(tx, bundle);
      await this.update(tx, { snapshot: { connect: { id } }, publishedGeneration: generation, state: json(valid), lastSuccessAt: new Date(now) });
      return { status: "published" as const, snapshot: await this.snapshot(tx, id) };
    });
  }
  async recordFailure(generation: bigint, state: RefreshPublicState | null): Promise<void> {
    const valid = state ? RefreshPublicState.parse(state) : null;
    await this.locked(async (tx, head, now) => { if (valid && leaseHeld(head, generation, now)) await this.update(tx, { state: json(valid) }); });
  }
  async releaseRefresh(generation: bigint): Promise<void> {
    await this.prisma.criteriaHead.updateMany({ where: { key: "pilot", leaseGeneration: generation }, data: { leaseGeneration: null, leaseExpiresAt: null } });
  }
  async bootstrap(bundle: CriteriaBundle): Promise<SnapshotId> {
    return this.locked(async (tx, head) => {
      if (head.snapshotId) return head.snapshotId;
      const id = await this.insert(tx, bundle);
      await this.update(tx, { snapshot: { connect: { id } } });
      return id;
    });
  }
}
