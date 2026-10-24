import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { CriteriaBundle } from "../contracts/trends.ts";
import type { PilotConfig, RoleReference, SnapshotId, VerifiedContent } from "../contracts/trends.ts";
import { REFERENCE_VERSION } from "./reference.ts";
import type { CriteriaStore } from "./snapshotStore.ts";
import { pilotConfig } from "./pilotConfig.ts";

// Reads checked-in public inputs only. It does not connect to storage or
// automatically create/replace a database head; release bootstrap is explicit.
export async function loadPilotBaseline(): Promise<{ reference: RoleReference; bundle: CriteriaBundle }> {
  const [referenceText, contentText] = await Promise.all([
    readFile(new URL("./data/role-reference-31.0.json", import.meta.url), "utf8"),
    readFile(new URL("./data/pilot-baseline.json", import.meta.url), "utf8"),
  ]);
  const reference: RoleReference = JSON.parse(referenceText);
  return { reference, bundle: buildInitialCriteria(reference, pilotConfig, JSON.parse(contentText)) };
}

// Stores the validated baseline only when no current snapshot exists; an
// existing valid head is never replaced. Returns the current snapshot id.
export function bootstrapCriteria(store: CriteriaStore, bundle: CriteriaBundle): Promise<SnapshotId> {
  return store.bootstrap(bundle);
}

// Pure construction only.
export function buildInitialCriteria(reference: RoleReference, config: PilotConfig, content: VerifiedContent): CriteriaBundle {
  if (reference.version !== REFERENCE_VERSION || !reference.attribution.trim()) throw new Error("A pinned, attributed role reference is required.");
  const tasks = new Map(config.taskAnchors.map(a => [a.taskId, a]));
  for (const anchor of config.taskAnchors) {
    const occupation = anchor.roleId === "backend-development" ? "15-1252.00" : anchor.roleId === "qa-automation" ? "15-1253.00" : null;
    if (!occupation || !anchor.referenceTaskIds.length || anchor.referenceTaskIds.some(id => {
      const row = reference.tasks.find(t => t.taskId === id && t.occupationId === occupation);
      return !row || /\b(supervis\w*|assign work|manage a team)\b/i.test(row.text);
    })) throw new Error("Unsupported or supervisory pilot task bridge.");
  }
  for (const role of content.roles) {
    if (!config.roleIds.includes(role.roleId)) throw new Error("Role is outside the pilot scope.");
    for (const row of role.skills) {
      const capability = content.capabilities.find(c => c.skillId === row.skillId);
      if (!capability || !capability.taskIds.some(id => tasks.get(id)?.roleId === role.roleId)) throw new Error("Capability needs a supported pilot task bridge.");
    }
  }
  if (config.foundationalSkillIds.some(id => !content.capabilities.some(c => c.skillId === id))) throw new Error("Unknown foundational capability.");
  const fingerprint = createHash("sha256").update(JSON.stringify({
    version: reference.version, urls: reference.urls, tasks: reference.tasks, software: reference.software,
  })).digest("hex");
  return CriteriaBundle.parse({ ...content, schemaVersion: 1, policyVersion: "count-coverage-v1",
    sourceContentKeys: [`onet-${REFERENCE_VERSION}-${fingerprint}`], interpreterVersion: "reference-bootstrap-v1" });
}
