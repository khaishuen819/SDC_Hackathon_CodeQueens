import { SnapshotId, TrendMeta } from "../contracts/criteria.ts";
import type { CriteriaContext } from "../contracts/trends.ts";
import { ApiFailure } from "../routes/errors.ts";
import { checkedSnapshot } from "./snapshotStore.ts";
import type { CriteriaStore } from "./snapshotStore.ts";
import { trendMeta } from "./refreshService.ts";

export type CriteriaContextLoader = (snapshotId?: string) => Promise<CriteriaContext>;

// Capture the head once and read its immutable payload explicitly. A concurrent
// publication cannot substitute a different version halfway through a request.
export function createCriteriaContextLoader(deps: { store: CriteriaStore; disabled: boolean; now?: () => number }): CriteriaContextLoader {
  return async (snapshotId) => {
    if (snapshotId !== undefined && !SnapshotId.safeParse(snapshotId).success) {
      throw new ApiFailure("INVALID_INPUT", "The criteria version is not valid.");
    }
    try {
      const head = await deps.store.readRefreshState();
      const target = snapshotId ?? head.snapshotId;
      if (!target) throw new ApiFailure("TRENDS_UNAVAILABLE", "No valid criteria are available yet. Please try again later.");
      const row = await deps.store.readSnapshot(target);
      if (!row) throw new ApiFailure(snapshotId ? "CRITERIA_UNAVAILABLE" : "TRENDS_UNAVAILABLE", "This criteria version is unavailable. Reload the current catalogue.");
      const snapshot = checkedSnapshot(row.id, row.createdAt, row.bundle);
      if (snapshot.id !== target) throw new Error("Snapshot identity mismatch.");
      let meta = trendMeta(head, { disabled: deps.disabled, now: (deps.now ?? Date.now)() });
      if (target !== head.snapshotId) {
        // Current provider checks do not certify a historical payload. Its
        // publication dates remain in the bundle; do not invent old check times.
        meta = TrendMeta.parse({ ...meta, snapshotId: target, status: deps.disabled ? "disabled" : "partial",
          lastAttemptAt: null, lastSuccessfulCheckAt: null, providers: [],
          notices: [`Showing saved criteria created ${snapshot.createdAt}. Current update checks do not revalidate this saved version.`, ...meta.notices].slice(0, 10) });
      }
      return { snapshot, meta };
    } catch (error) {
      if (error instanceof ApiFailure) throw error;
      throw new ApiFailure("TRENDS_UNAVAILABLE", "Criteria storage is unavailable. Please try again later.");
    }
  };
}
