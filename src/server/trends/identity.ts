import { createHash } from "node:crypto";
import { CriteriaBundle } from "../contracts/trends.ts";
import type { SnapshotId } from "../contracts/criteria.ts";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical).sort((a, b) => {
    const left = JSON.stringify(a), right = JSON.stringify(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "checkedAt" && key !== "retrievedAt")
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => [key, canonical(item)]));
  return value;
}

// All bundle arrays are unordered entity/relationship sets, not pathway steps.
// Check times belong to health metadata; publisher dates remain semantic data.
export function criteriaSnapshotId(input: CriteriaBundle): SnapshotId {
  const bundle = CriteriaBundle.parse(input);
  return `criteria-${createHash("sha256").update(JSON.stringify(canonical(bundle))).digest("hex")}`;
}
