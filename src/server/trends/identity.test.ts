import test from "node:test";
import assert from "node:assert/strict";
import { criteriaSnapshotId } from "./identity.ts";
import { bundle } from "./testFixtures.ts";

test("semantic identity ignores check times, object order and unordered collection order", () => {
  const first = bundle(), next = structuredClone(first);
  next.roles.reverse(); next.roles.forEach((r) => r.skills.reverse());
  next.capabilities.reverse(); next.resources.reverse(); next.criteriaDecisions.reverse();
  next.evidence[0].checkedAt = "2026-10-25T00:00:00Z";
  next.evidence[0].retrievedAt = "2026-10-25";
  next.resources.forEach((r) => { r.checkedAt = "2026-10-25T00:00:00Z"; });
  assert.equal(criteriaSnapshotId(first), criteriaSnapshotId(next));
  assert.match(criteriaSnapshotId(first), /^criteria-[a-f0-9]{64}$/);
});

test("decision, source-content and interpreter changes get a different version", () => {
  const first = bundle();
  const decisions = structuredClone(first); decisions.criteriaDecisions[0].reason = "Corrected synthetic admission reason.";
  const source = structuredClone(first); source.sourceContentKeys.push("changed-source-content");
  const interpreter = structuredClone(first); interpreter.interpreterVersion = "fictional-model-prompt-2";
  for (const changed of [decisions, source, interpreter]) assert.notEqual(criteriaSnapshotId(first), criteriaSnapshotId(changed));
});
