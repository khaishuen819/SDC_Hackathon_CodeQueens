// Synthetic fixtures only: no publisher retrieval, reviewed content or live AI is claimed.
import { createHash } from "node:crypto";
import type { ConfirmedProfile } from "../contracts/profile.ts";
import type { AdmissionContext, CandidateInterpretation, CriteriaBundle } from "../contracts/trends.ts";

export const NOW = "2026-10-24T10:00:00Z";
export const SNAPSHOT = `criteria-${"a".repeat(64)}`;
export const SOURCE_TEXT = "FICTIONAL: Developers can now verify API behaviour using reproducible checks and inspect their results.";
export const REFERENCE_TEXT = "FICTIONAL: Implement and check application request and response behaviour with reproducible test cases.";
export const RESOURCE_TEXT = "FICTIONAL tutorial: practise a distinct diagnostic workflow with a runnable example and verify the output.";

export function bundle(count = 10): CriteriaBundle {
  const ids = Array.from({ length: count }, (_, i) => i === 0 ? "api-basics" : `fixture-skill-${i}`);
  return {
    schemaVersion: 1, policyVersion: "count-coverage-v1", interpreterVersion: "fictional-model-prompt-1",
    roles: ["backend-development", "qa-automation"].map((roleId) => ({
      roleId, name: `FICTIONAL ${roleId}`, description: "Synthetic role, not a real occupational claim.",
      isPlaceholder: false, skills: ids.map((skillId) => ({ skillId, name: `FICTIONAL ${skillId}`, weight: 1 as const, isRequired: true })),
    })),
    capabilities: ids.map((skillId, i) => ({
      skillId, name: i === 0 ? "API basics" : `FICTIONAL skill ${i}`, definition: `Synthetic capability boundary ${i}.`,
      aliases: i === 0 ? ["HTTP API basics"] : [], observableOutcome: `Demonstrate synthetic outcome ${i}.`,
      taskIds: ["B1" as const, "Q2" as const], prerequisiteSkillIds: [], evidenceIds: ["fictional-evidence"],
    })),
    resources: ids.map((skillId, i) => ({
      resourceId: `fictional-resource-${i}`, skillId, title: `FICTIONAL lesson ${i}`, url: `https://learning.example/lesson-${i}`,
      provider: "Fictional provider", cost: "free" as const, sourceNote: "Synthetic test fixture, not a verified course.",
      isPlaceholder: false, estimatedHours: 1, estimateBasis: "app" as const, estimateNote: "Synthetic estimate for tests only.", checkedAt: NOW,
    })),
    evidence: [{
      id: "fictional-evidence", title: "FICTIONAL support", publisher: "Fictional publisher", url: "https://publisher.example/reference",
      publishedDate: "2020-01-01", publishedAt: "2020-01-01T00:00:00Z", originalDate: "2020-01-01", datePrecision: "day", dateBasis: "published",
      retrievedAt: "2026-10-24", checkedAt: NOW, supportedClaim: "Synthetic support for these fixture capabilities.",
      limitation: "Fictional test data; not observed evidence.", linkedSkillIds: ids,
    }],
    sdg: {
      goals: [{ sdgId: "sdg-4", number: 4, name: "Quality Education" }],
      roleTags: ["backend-development", "qa-automation"].map((roleId) => ({ roleId, sdgId: "sdg-4", rationale: "Synthetic possible learning contribution.", isPlaceholder: false })),
      skillTags: ids.map((skillId) => ({ skillId, sdgId: "sdg-4", rationale: "Synthetic possible learning contribution.", isPlaceholder: false })),
    },
    prerequisiteEdges: [],
    criteriaDecisions: ["backend-development", "qa-automation"].flatMap((roleId) => ids.map((skillId) => ({
      roleId, skillId, action: "admit" as const, reason: "Synthetic fixture support.", evidenceIds: ["fictional-evidence"],
    }))),
    sourceContentKeys: ["fictional-reference-content"],
  };
}

export function profile(ids: string[] = []): ConfirmedProfile {
  return {
    status: "confirmed", confirmedSkills: ids.map((skillId) => ({ skillId })), addedSkillIds: [], removedSkillIds: [], unconfirmedSkillIds: [],
    entryPath: "preferred-route", preferredRouteId: "qa-automation", confirmedAt: NOW,
  };
}

export function candidate(): CandidateInterpretation & { learning: NonNullable<CandidateInterpretation["learning"]> } {
  return {
    sourceId: "fictional-update", roleId: "backend-development", taskId: "B1", referenceTaskId: "fictional-task",
    sourceExcerpt: SOURCE_TEXT, referenceExcerpt: REFERENCE_TEXT, bridgeExplanation: "Synthetic connection to the allowed graduate API task.",
    relation: "distinct", fit: "pilot", conflict: false, uncertainties: [],
    capability: { name: "Fictional diagnostic capability", definition: "A distinct synthetic diagnostic workflow.",
      aliases: [], observableOutcome: "Demonstrate the distinct synthetic diagnostic outcome.", example: "Run the fictional diagnostic exercise.", prerequisiteSkillIds: [] },
    learning: { resourceLinkIds: ["fictional-link"], resourceExcerpts: [{ linkId: "fictional-link", excerpt: RESOURCE_TEXT }],
      estimatedHours: 2, estimateBasis: "app", estimateNote: "Synthetic practice-time estimate, not a provider assertion." },
    sdgTemplateIds: ["fictional-learning-template"],
  };
}

export function context(base = bundle()): AdmissionContext {
  return {
    base, now: NOW,
    reference: { version: "fictional-reference-1", urls: ["https://reference.example/data"],
      tasks: [{ occupationId: "15-1252.00", taskId: "fictional-task", text: REFERENCE_TEXT, taskType: "Core", originalDate: "2020", datePrecision: "year" }],
      software: [], attribution: "Synthetic reference; not an O*NET import." },
    config: { roleIds: ["backend-development", "qa-automation"], sourceHosts: ["publisher.example"], resourceHosts: ["learning.example"],
      foundationalSkillIds: ["api-basics"], taskAnchors: [{ taskId: "B1", roleId: "backend-development", referenceTaskIds: ["fictional-task"] }],
      sdgTemplates: [{ templateId: "fictional-learning-template", taskId: "B1", sdgId: "sdg-4", rationale: "A possible learning contribution, not achieved impact." }] },
    sources: [{ sourceId: "fictional-update", providerId: "fictional-provider", canonicalUrl: "https://publisher.example/update", title: "FICTIONAL update",
      publishedAt: "2020-01-01T00:00:00Z", dateBasis: "published", text: SOURCE_TEXT,
      contentHash: createHash("sha256").update(SOURCE_TEXT).digest("hex"), extractedLinks: [{ linkId: "fictional-link", url: "https://learning.example/tutorial", title: "FICTIONAL tutorial" }] }],
    resources: [{ linkId: "fictional-link", url: "https://learning.example/tutorial", title: "FICTIONAL tutorial", text: RESOURCE_TEXT,
      contentHash: createHash("sha256").update(RESOURCE_TEXT).digest("hex"), access: "free", checkedAt: NOW }],
  };
}
