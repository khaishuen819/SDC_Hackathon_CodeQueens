import { TrendMeta } from "../contracts/trends.ts";
import type { HttpFetcher, PilotConfig, ProviderState, RefreshPublicState, RefreshState, RoleReference, SnapshotId } from "../contracts/trends.ts";
import type { CriteriaStore } from "./snapshotStore.ts";
import type { TrendInterpreter } from "./interpreter.ts";
import { draftRefresh } from "./refreshDraft.ts";
import type { RefreshRun } from "./refreshDraft.ts";
import { pruneQueueHistory, queueCounts } from "./queue.ts";
import { criteriaSnapshotId } from "./identity.ts";

// One refresh = reserve the shared lease, read the last valid version, run one
// bounded draft (feeds, queue, at most one model request), then publish or
// save state, and always release. Failures keep the last valid criteria.
export type RefreshServiceDeps = {
  store: CriteriaStore; reference: RoleReference; config: PilotConfig; fetcher: HttpFetcher;
  interpreter: TrendInterpreter | null; now?: () => string; deadlineMs?: number;
};
export type RefreshService = { refresh(): Promise<TrendMeta>; loadState(): Promise<TrendMeta> };
type Control = TrendMeta["refreshControl"];

const PROVIDER_NAMES: Record<string, string> = { "github-changelog": "GitHub Changelog", "jetbrains-ai": "JetBrains AI Blog" };
const checked = (providers: ProviderState[]) => providers.some((p) => p.status === "ok" || p.status === "unchanged");

function notices(run: RefreshRun, admitted: number): string[] {
  const out: string[] = [];
  for (const p of run.providers) if (p.status === "failed") out.push(`Could not check ${PROVIDER_NAMES[p.providerId] ?? p.providerId} (${p.errorCode ?? "error"}); its last successful check is kept.`);
  if (run.skipped) out.push(`${run.skipped} new update(s) were not queued because the queue is full; they will be reconsidered on later checks.`);
  if (run.outcome?.status === "provider-failure") out.push(`The interpretation service was unavailable (${run.outcome.errorCode}); waiting updates will be retried later.`);
  if (run.outcome?.status === "input-failure") out.push("Some updates could not be interpreted and will be retried later; saved criteria are unchanged.");
  const quarantined = queueCounts(run.queue).quarantinedItemCount;
  if (quarantined) out.push(`${quarantined} update(s) were skipped after repeated processing failures; saved criteria are unchanged.`);
  if (admitted) out.push(`Added ${admitted} new skill(s) from current sources. Coverage is recalculated against the new list.`);
  return out.slice(0, 10);
}

// Public status for the API. "fresh" only when every provider checked
// successfully and no update is waiting or quarantined.
export function trendMeta(head: RefreshState, options: { disabled: boolean; now: number; control?: Control; extra?: string[] }): TrendMeta {
  const counts = queueCounts(head.state.queue), providers = head.state.providers;
  const status = !head.snapshotId ? "unavailable" : options.disabled ? "disabled"
    : !head.lastSuccessfulCheckAt || (head.lastAttemptAt && Date.parse(head.lastAttemptAt) > Date.parse(head.lastSuccessfulCheckAt)) ||
      !providers.length || providers.some((p) => p.status !== "ok" && p.status !== "unchanged") || counts.deferredItemCount || counts.quarantinedItemCount ? "partial" : "fresh";
  const derived: Control = head.leaseGeneration !== null && head.leaseExpiresAt && Date.parse(head.leaseExpiresAt) > options.now ? { state: "busy", retryAt: head.leaseExpiresAt }
    : head.nextAllowedAt && Date.parse(head.nextAllowedAt) > options.now ? { state: "cooldown", retryAt: head.nextAllowedAt } : { state: "ready", retryAt: null };
  return TrendMeta.parse({ snapshotId: head.snapshotId, policyVersion: "count-coverage-v1", status, lastSuccessfulCheckAt: head.lastSuccessfulCheckAt,
    lastAttemptAt: head.lastAttemptAt, providers, notices: [...(options.extra ?? []), ...head.state.notices].slice(0, 10).map((n) => n.slice(0, 500)),
    ...counts, refreshControl: options.control ?? derived });
}

export function createRefreshService(deps: RefreshServiceDeps): RefreshService {
  const now = deps.now ?? (() => new Date().toISOString());
  const disabled = !deps.interpreter;
  let running: Promise<TrendMeta> | null = null;
  const meta = async (extra: string[] = [], control?: Control) => trendMeta(await deps.store.readRefreshState(), { disabled, now: Date.parse(now()), control, extra });

  async function work(interpreter: TrendInterpreter): Promise<TrendMeta> {
    const reservation = await deps.store.reserveRefresh();
    if (reservation.status !== "acquired") return meta([], { state: reservation.status, retryAt: reservation.retryAt });
    const { generation, baseSnapshotId } = reservation;
    let extra: string[];
    try { extra = await attempt(interpreter, generation, baseSnapshotId); }
    finally { await deps.store.releaseRefresh(generation); }
    // Built after the release, so the status shows cooldown rather than busy.
    return meta(extra);
  }

  async function attempt(interpreter: TrendInterpreter, generation: bigint, baseSnapshotId: SnapshotId | null): Promise<string[]> {
    try {
      const base = baseSnapshotId ? await deps.store.readSnapshot(baseSnapshotId) : null;
      if (!base) return ["No valid criteria version exists yet; the verified baseline must be bootstrapped first."];
      const head = await deps.store.readRefreshState();
      const run = await draftRefresh({ base: base.bundle, reference: deps.reference, config: deps.config, providers: head.state.providers, queue: head.state.queue,
        sources: head.state.sources, fetcher: deps.fetcher, interpreter, now, deadlineMs: deps.deadlineMs,
        onDispatch: async (s) => {
          // The attempt is saved before the model call; a lost lease stops the work here.
          if (!await deps.store.saveRefreshState(generation, { ...s, queue: pruneQueueHistory(s.queue), notices: head.state.notices }, false))
            throw new Error("The refresh lease was lost before the model call.");
        } });
      const admitted = run.draft?.admittedSkillIds.length ?? 0;
      const state: RefreshPublicState = { providers: run.providers, sources: run.sources, queue: pruneQueueHistory(run.queue), notices: notices(run, admitted) };
      if (run.draft && criteriaSnapshotId(run.draft.bundle) !== base.id) {
        const result = await deps.store.publishIfCurrent(base.id, generation, run.draft.bundle, state, checked(run.providers));
        if (result.status === "conflict") {
          await deps.store.recordFailure(generation, state);
          return ["A newer criteria version was published elsewhere; this result was discarded and will be retried later."];
        }
      } else if (!await deps.store.saveRefreshState(generation, state, checked(run.providers))) {
        return ["The refresh lease expired before results could be saved; the last valid criteria are kept."];
      }
      return [];
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const reason = /deadline/i.test(message) ? "The refresh deadline was exceeded." : /lease/i.test(message)
        ? "The refresh lease was lost." : "The update check failed.";
      const notice = `${reason} The last valid criteria are kept.`;
      const head = await deps.store.readRefreshState();
      await deps.store.recordFailure(generation, { ...head.state, notices: [notice, ...head.state.notices].slice(0, 10) });
      return [notice];
    }
  }

  return {
    async refresh() {
      if (!deps.interpreter) return meta(["Automatic trend interpretation is disabled; showing the last saved criteria."]);
      // One worker per process; duplicate callers get current metadata at once.
      if (running) return meta([], { state: "busy", retryAt: (await deps.store.readRefreshState()).leaseExpiresAt });
      running = work(deps.interpreter);
      try { return await running; } finally { running = null; }
    },
    loadState: () => meta(),
  };
}
