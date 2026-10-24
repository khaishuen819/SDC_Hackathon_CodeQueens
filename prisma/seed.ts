// Seed the database with the two pilot roles, their skills, and the 17 UN SDGs.
// Run with: npx prisma db seed   (runs `node prisma/seed.ts`, see prisma.config.ts)
// Reruns insert missing demo content only; existing reviewed content stays intact.
//
// Placeholder data. M3 or the content owner replaces this with reviewed data. Do not present as real.
// That covers roles, skills, weights, resources and SDG rationales: every row has isPlaceholder = true.
// Resource links use example.com (a reserved example domain), not real courses.
// The SDG numbers and names are the official UN ones (see docs/m2-technical-notes.md for the source).

import type { PrismaClient } from "../src/server/db/generated/prisma/client.ts";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---- Placeholder content -------------------------------------------------

const roles = [
  {
    id: "backend-development",
    name: "Backend Development",
    description: "PLACEHOLDER: builds the server side of applications (APIs, data, business logic).",
  },
  {
    id: "qa-automation",
    name: "QA Automation",
    description: "PLACEHOLDER: checks software quality by designing and automating tests.",
  },
];

const skills = [
  // Shared by both roles
  { id: "git", name: "Git", description: "PLACEHOLDER: version control with Git." },
  { id: "sql", name: "SQL", description: "PLACEHOLDER: querying relational databases." },
  { id: "javascript", name: "JavaScript", description: "PLACEHOLDER: the JavaScript language." },
  { id: "api-basics", name: "API basics", description: "PLACEHOLDER: how HTTP/REST APIs work." },
  { id: "testing-basics", name: "Testing basics", description: "PLACEHOLDER: unit tests and test thinking." },
  { id: "linux-basics", name: "Linux basics", description: "PLACEHOLDER: the command line and shell." },
  { id: "ci-cd-basics", name: "CI/CD basics", description: "PLACEHOLDER: automated build and test pipelines." },
  { id: "docker", name: "Docker", description: "PLACEHOLDER: running apps in containers." },
  // Mainly backend
  { id: "nodejs", name: "Node.js", description: "PLACEHOLDER: server-side JavaScript runtime." },
  { id: "typescript", name: "TypeScript", description: "PLACEHOLDER: typed JavaScript." },
  { id: "database-design", name: "Database design", description: "PLACEHOLDER: tables, keys and relations." },
  { id: "authentication", name: "Authentication", description: "PLACEHOLDER: logins, sessions and tokens." },
  // Mainly QA
  { id: "test-automation", name: "Test automation", description: "PLACEHOLDER: writing automated test suites." },
  { id: "test-design", name: "Test design", description: "PLACEHOLDER: choosing test cases and coverage." },
  { id: "python", name: "Python", description: "PLACEHOLDER: the Python language." },
  { id: "bug-reporting", name: "Bug reporting", description: "PLACEHOLDER: clear, reproducible bug reports." },
];

// [skillId, weight (1 = nice to have, 2 = important, 3 = core), isRequired]. 12 skills per role.
const roleSkills: Record<string, Array<[string, number, boolean]>> = {
  "backend-development": [
    ["nodejs", 3, true],
    ["sql", 3, true],
    ["api-basics", 3, true],
    ["git", 2, true],
    ["javascript", 2, false],
    ["typescript", 2, false],
    ["database-design", 2, false],
    ["authentication", 2, false],
    ["docker", 2, false],
    ["testing-basics", 1, false],
    ["linux-basics", 1, false],
    ["ci-cd-basics", 1, false],
  ],
  "qa-automation": [
    ["testing-basics", 3, true],
    ["test-automation", 3, true],
    ["test-design", 3, true],
    ["api-basics", 2, true],
    ["git", 2, true],
    ["javascript", 2, false],
    ["python", 2, false],
    ["ci-cd-basics", 2, false],
    ["bug-reporting", 2, false],
    ["sql", 1, false],
    ["linux-basics", 1, false],
    ["docker", 1, false],
  ],
};

// Placeholder SDG links: [roleId, sdgId, rationale].
const roleSdgs: Array<[string, string, string]> = [
  ["backend-development", "sdg-9", "PLACEHOLDER rationale: backend developers build and maintain digital infrastructure. To be reviewed."],
  ["backend-development", "sdg-8", "PLACEHOLDER rationale: a route into skilled technology work for graduates. To be reviewed."],
  ["qa-automation", "sdg-9", "PLACEHOLDER rationale: testing helps software infrastructure stay reliable. To be reviewed."],
  ["qa-automation", "sdg-8", "PLACEHOLDER rationale: a route into skilled technology work for graduates. To be reviewed."],
];

// Placeholder SDG link for a skill: [skillId, sdgId, rationale].
const skillSdgs: Array<[string, string, string]> = [
  ["testing-basics", "sdg-9", "PLACEHOLDER rationale: testing helps software infrastructure stay reliable. To be reviewed."],
];

// ---- Official UN Sustainable Development Goals (not placeholder) -----------

const sdgNames = [
  "No Poverty",
  "Zero Hunger",
  "Good Health and Well-being",
  "Quality Education",
  "Gender Equality",
  "Clean Water and Sanitation",
  "Affordable and Clean Energy",
  "Decent Work and Economic Growth",
  "Industry, Innovation and Infrastructure",
  "Reduced Inequalities",
  "Sustainable Cities and Communities",
  "Responsible Consumption and Production",
  "Climate Action",
  "Life Below Water",
  "Life on Land",
  "Peace, Justice and Strong Institutions",
  "Partnerships for the Goals",
];

// ---- Write to the database -------------------------------------------------

type SeedDatabase = Pick<PrismaClient, "role" | "skill" | "resource" | "roleSkill" | "sdgGoal" | "roleSdg" | "skillSdg">;

export async function seedDemoData(prisma: SeedDatabase) {
  for (const r of roles) {
    const data = { name: r.name, description: r.description, isPlaceholder: true };
    await prisma.role.upsert({ where: { id: r.id }, update: {}, create: { id: r.id, ...data } });
  }

  for (const s of skills) {
    const data = { name: s.name, description: s.description, isPlaceholder: true };
    await prisma.skill.upsert({ where: { id: s.id }, update: {}, create: { id: s.id, ...data } });

    // One placeholder resource per skill, so pathways have something to show.
    const resource = {
      skillId: s.id,
      title: `PLACEHOLDER: ${s.name} resource`,
      url: `https://example.com/placeholder/${s.id}`,
      provider: "Placeholder provider",
      cost: "unknown" as const,
      estimatedHours: 10, // same placeholder value everywhere, on purpose
      sourceNote: "Placeholder. The content owner replaces this with a reviewed resource.",
      isPlaceholder: true,
    };
    const resourceId = `placeholder-${s.id}-1`;
    await prisma.resource.upsert({
      where: { id: resourceId },
      update: {},
      create: { id: resourceId, ...resource },
    });
  }

  for (const [roleId, list] of Object.entries(roleSkills)) {
    for (const [skillId, weight, isRequired] of list) {
      const data = { weight, isRequired, isPlaceholder: true };
      await prisma.roleSkill.upsert({
        where: { roleId_skillId: { roleId, skillId } },
        update: {},
        create: { roleId, skillId, ...data },
      });
    }
  }

  for (const [index, name] of sdgNames.entries()) {
    const number = index + 1;
    const id = `sdg-${number}`;
    await prisma.sdgGoal.upsert({ where: { id }, update: {}, create: { id, number, name } });
  }

  for (const [roleId, sdgId, rationale] of roleSdgs) {
    const data = { rationale, isPlaceholder: true };
    await prisma.roleSdg.upsert({
      where: { roleId_sdgId: { roleId, sdgId } },
      update: {},
      create: { roleId, sdgId, ...data },
    });
  }

  for (const [skillId, sdgId, rationale] of skillSdgs) {
    const data = { rationale, isPlaceholder: true };
    await prisma.skillSdg.upsert({
      where: { skillId_sdgId: { skillId, sdgId } },
      update: {},
      create: { skillId, sdgId, ...data },
    });
  }

  // Source and TrendEvidence stay empty: feature 2 (M3/M4) fills them.

}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Importing this module for tests must never connect to a database.
  const { prisma } = await import("../src/server/db/client.ts");
  try {
    await seedDemoData(prisma);
    console.log("Seed finished: missing demo rows inserted; existing content and criteria snapshots preserved.");
  } finally {
    await prisma.$disconnect();
  }
}
