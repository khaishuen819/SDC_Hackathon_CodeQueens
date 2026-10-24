import type { PilotConfig } from "../contracts/trends.ts";

// Existing IDs remain recognised; these definitions do not admit skills by themselves.
export const PILOT_SKILL_IDS = ["git", "sql", "javascript", "api-basics", "testing-basics", "linux-basics", "ci-cd-basics", "docker",
  "nodejs", "typescript", "database-design", "authentication", "test-automation", "test-design", "python", "bug-reporting"] as const;

const scopes = [
  { taskId: "B1" as const, roleId: "backend-development", referenceTaskIds: ["21667"], purpose: "implementing and checking API behaviour" },
  { taskId: "B2" as const, roleId: "backend-development", referenceTaskIds: ["21676"], purpose: "structuring and accessing application data" },
  { taskId: "B3" as const, roleId: "backend-development", referenceTaskIds: ["21669", "21670"], purpose: "reproducing faults and verifying server-side changes" },
  { taskId: "B4" as const, roleId: "backend-development", referenceTaskIds: ["21670"], purpose: "maintaining reproducible code and delivery workflows" },
  { taskId: "Q1" as const, roleId: "qa-automation", referenceTaskIds: ["14638", "14640"], purpose: "deriving test cases from software requirements" },
  { taskId: "Q2" as const, roleId: "qa-automation", referenceTaskIds: ["14652", "14650"], purpose: "maintaining repeatable functional and API checks" },
  { taskId: "Q3" as const, roleId: "qa-automation", referenceTaskIds: ["14641", "14661"], purpose: "diagnosing and reporting reproducible defects" },
  { taskId: "Q4" as const, roleId: "qa-automation", referenceTaskIds: ["14639", "14648"], purpose: "running and explaining checks for software changes" },
];

export const pilotConfig: PilotConfig = {
  roleIds: ["backend-development", "qa-automation"],
  sourceHosts: ["github.blog", "blog.jetbrains.com"],
  resourceHosts: ["developer.mozilla.org", "nodejs.org", "www.typescriptlang.org", "www.postgresql.org", "git-scm.com",
    "docs.github.com", "docs.python.org", "docs.docker.com", "ubuntu.com", "playwright.dev"],
  foundationalSkillIds: ["git", "sql", "api-basics", "testing-basics", "javascript", "python", "linux-basics"],
  taskAnchors: scopes.map(({ taskId, roleId, referenceTaskIds }) => ({ taskId, roleId, referenceTaskIds })),
  sdgTemplates: scopes.map(({ taskId, purpose }) => ({ templateId: `${taskId.toLowerCase()}-skills-for-work`, taskId, sdgId: "sdg-4",
    rationale: `Learning ${purpose} can develop practical technical skills for work, supporting SDG target 4.4. This is a possible contribution, not a measured employment outcome.` })),
};
