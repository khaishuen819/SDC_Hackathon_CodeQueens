// ILLUSTRATIVE engine inputs behind exampleMatchResponse and examplePathwayResponse
// (src/server/contracts/examples.ts). Not the database seed. Used only by tests.
// All of it is placeholder or FICTIONAL data.
import type { ResourceInput } from "../pathway/pathwayEngine.ts";
import type { EvidenceInput, RoleInput } from "./matchEngine.ts";

const names: Record<string, string> = {
  nodejs: "Node.js",
  sql: "SQL",
  "api-basics": "API basics",
  git: "Git",
  javascript: "JavaScript",
  "testing-basics": "Testing basics",
  "database-design": "Database design",
  docker: "Docker",
  "test-automation": "Test automation",
  "ci-cd-basics": "CI/CD basics",
};

export function skill(skillId: string, weight: number, isRequired: boolean, isPlaceholder = true) {
  return { skillId, name: names[skillId] ?? skillId, weight, isRequired, isPlaceholder };
}

export const exampleRoles: RoleInput[] = [
  {
    roleId: "backend-development",
    name: "Backend Development",
    isPlaceholder: true,
    skills: [
      skill("nodejs", 3, true),
      skill("sql", 3, true),
      skill("api-basics", 3, true),
      skill("git", 2, true),
      skill("javascript", 2, false),
      skill("testing-basics", 1, false),
      skill("database-design", 2, false),
      skill("docker", 2, false),
    ],
  },
  {
    roleId: "qa-automation",
    name: "QA Automation",
    isPlaceholder: true,
    skills: [
      skill("testing-basics", 3, true),
      skill("test-automation", 3, true),
      skill("api-basics", 2, true),
      skill("git", 2, true),
      skill("javascript", 2, false),
      skill("ci-cd-basics", 2, false),
      skill("sql", 1, false),
    ],
  },
];

export const exampleEvidence: EvidenceInput[] = [
  {
    evidenceId: "fictional-evidence-1",
    skillId: "ci-cd-basics",
    direction: "rising",
    priorityAdjustment: 1,
    explanation: "FICTIONAL example adjustment, for format testing only.",
  },
];

// One placeholder resource per skill, shaped like the seed (prisma/seed.ts).
export const exampleResources: ResourceInput[] = Object.keys(names).map((skillId) => ({
  resourceId: `placeholder-${skillId}-1`,
  skillId,
  title: `PLACEHOLDER: ${names[skillId]} resource`,
  url: `https://example.com/placeholder/${skillId}`,
  provider: "Placeholder provider",
  cost: "unknown",
  estimatedHours: 10,
  sourceNote: "Placeholder. The content owner replaces this with a reviewed resource.",
  isPlaceholder: true,
}));
