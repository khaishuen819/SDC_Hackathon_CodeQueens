import { SnapshotId, TrendMeta } from "../contracts/criteria.ts";
import type { CriteriaReview } from "../contracts/criteria.ts";
import type { ConfirmedProfile } from "../contracts/profile.ts";
import type { CriteriaContext, CriteriaSnapshot } from "../contracts/trends.ts";
import { ApiFailure } from "../routes/errors.ts";
import { checkedSnapshot } from "./snapshotStore.ts";
import type { CriteriaStore } from "./snapshotStore.ts";
import { trendMeta } from "./refreshService.ts";
import { reconcileCriteria, CriteriaReconciliationError } from "./reconciliation.ts";

export type CriteriaContextLoader = (snapshotId?: string) => Promise<CriteriaContext>;
export type CriteriaRequestDeps = {
  loadContext: CriteriaContextLoader;
  loadSnapshot: (snapshotId: string) => Promise<CriteriaSnapshot | null>;
};

// Transport context and possession answers are different concerns. A missing
// version requires reload guidance; unanswered possession never blocks results.
export async function prepareCriteriaRequest(profile: ConfirmedProfile,
  request: { snapshotId?: string; criteriaReview?: CriteriaReview }, deps: CriteriaRequestDeps) {
  const { criteriaReview: review } = request;
  const target = request.snapshotId ?? review?.targetSnapshotId;
  const context = await deps.loadContext(target);
  try {
    const contextError = (): never => {
      const guidance = reconcileCriteria(profile, null, context.snapshot.bundle).review;
      throw new ApiFailure("CRITERIA_CONTEXT_REQUIRED", "Reload the catalogue and use the same criteria version. Skill answers are optional.", undefined, guidance);
    };
    if (!target || (request.snapshotId && review && request.snapshotId !== review.targetSnapshotId)) contextError();
    let previous: CriteriaSnapshot | null = null;
    if (review?.fromSnapshotId) {
      try { previous = review.fromSnapshotId === context.snapshot.id ? context.snapshot : await deps.loadSnapshot(review.fromSnapshotId); }
      catch { throw new ApiFailure("TRENDS_UNAVAILABLE", "Criteria storage is unavailable. Please try again later."); }
      if (!previous) throw new ApiFailure("CRITERIA_UNAVAILABLE", "The previous criteria version is unavailable. Reload the catalogue.");
    }
    const result = reconcileCriteria(profile, previous?.bundle ?? null, context.snapshot.bundle, review);
    return { context, result, previous };
  } catch (error) {
    if (!(error instanceof CriteriaReconciliationError)) throw error;
    if (error.code === "INVALID_INPUT") throw new ApiFailure("INVALID_INPUT", error.message);
    const guidance = reconcileCriteria(profile, null, context.snapshot.bundle).review;
    throw new ApiFailure("CRITERIA_CONTEXT_REQUIRED", error.message, undefined, guidance);
  }
}

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
