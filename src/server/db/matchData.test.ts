// Tests for the match database reads, with a fake Prisma client (no real database).
// Run with: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { WEIGHT_EVIDENCE_WHERE, loadWeightEvidence } from "./matchData.ts";

type Row = {
  id: string;
  skillId: string;
  direction: "rising" | "declining";
  priorityAdjustment: number | null;
  adjustmentExplanation: string | null;
  isPlaceholder: boolean;
};

// A fake client that records the query and returns rows as given (even ones the query would exclude).
function fakeDb(rows: Row[]) {
  const calls: unknown[] = [];
  const db = { trendEvidence: { findMany: async (args: unknown) => (calls.push(args), rows) } };
  return { db: db as unknown as Parameters<typeof loadWeightEvidence>[0], calls };
}

test("only reviewed evidence (isPlaceholder = false) with an adjustment changes weights", async () => {
  const { db, calls } = fakeDb([
    { id: "reviewed", skillId: "sql", direction: "rising", priorityAdjustment: 1, adjustmentExplanation: "ok", isPlaceholder: false },
    { id: "placeholder", skillId: "sql", direction: "rising", priorityAdjustment: 1, adjustmentExplanation: "no", isPlaceholder: true },
    { id: "no-number", skillId: "sql", direction: "rising", priorityAdjustment: null, adjustmentExplanation: null, isPlaceholder: false },
  ]);
  const evidence = await loadWeightEvidence(db);
  assert.deepEqual(evidence.map((e) => e.evidenceId), ["reviewed"]);
  // The database query itself asks only for reviewed rows with an adjustment.
  assert.deepEqual((calls[0] as { where: unknown }).where, WEIGHT_EVIDENCE_WHERE);
  assert.deepEqual(WEIGHT_EVIDENCE_WHERE, { isPlaceholder: false, priorityAdjustment: { not: null } });
});
