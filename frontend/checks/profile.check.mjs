// Checks for public/js/profile.js. Run: cd frontend && npm test
// Named *.check.mjs so the backend's root `npm test` (node --test) does not pick them up.

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkFile, skillCatalogue, reviewModel, buildConfirmedProfile, MAX_FILE_BYTES } from "../public/js/profile.js";

// Shaped like GET /api/roles (fictional, shortened).
const roles = {
  isPlaceholder: true,
  roles: [
    { roleId: "backend-development", name: "Backend Development", description: "", isPlaceholder: true,
      skills: [
        { skillId: "nodejs", name: "Node.js", weight: 3, isRequired: true },
        { skillId: "sql", name: "SQL", weight: 3, isRequired: true },
        { skillId: "docker", name: "Docker", weight: 2, isRequired: false },
      ] },
    { roleId: "qa-automation", name: "QA Automation", description: "", isPlaceholder: true,
      skills: [
        { skillId: "testing-basics", name: "Testing basics", weight: 3, isRequired: true },
        { skillId: "sql", name: "SQL", weight: 1, isRequired: false },
      ] },
  ],
};

// Shaped like a DraftProfile (fictional).
const draft = {
  status: "draft",
  extractedSkills: [
    { skillId: "nodejs", rawName: "Node.js", evidence: "Built an API with Node.js", confidence: 1 },
    { skillId: "sql", rawName: "PostgreSQL", evidence: "Designed tables in PostgreSQL", confidence: 1 },
    { skillId: "sql", rawName: "MySQL", evidence: "Wrote MySQL queries", confidence: 1 },
    { skillId: null, rawName: "Figma", evidence: "Made wireframes in Figma", confidence: 1 },
    { skillId: "made-up", rawName: "Made up", evidence: "x", confidence: 1 },
  ],
  projects: [],
  experience: [],
  warnings: [],
};

test("checkFile accepts small PDF and txt, rejects big or other files", () => {
  assert.equal(checkFile({ name: "cv.pdf", size: 1000 }), null);
  assert.equal(checkFile({ name: "CV.TXT", size: 1000 }), null);
  assert.equal(checkFile({ name: "cv.docx", size: 1000 }), "UNSUPPORTED_FILE");
  assert.equal(checkFile({ name: "cv.pdf", size: MAX_FILE_BYTES + 1 }), "FILE_TOO_LARGE");
  assert.equal(checkFile(null), "INVALID_INPUT");
});

test("skillCatalogue lists each skill once", () => {
  const cat = skillCatalogue(roles);
  assert.deepEqual([...cat.keys()], ["nodejs", "sql", "docker", "testing-basics"]);
  assert.equal(cat.get("sql"), "SQL");
});

test("reviewModel merges duplicates and keeps unknown skills apart", () => {
  const m = reviewModel(draft, skillCatalogue(roles));
  assert.deepEqual(m.found.map((f) => f.skillId), ["nodejs", "sql"]);
  assert.deepEqual(m.found[1].rawNames, ["PostgreSQL", "MySQL"]);
  assert.deepEqual(m.unknown.map((u) => u.rawName), ["Figma", "Made up"]);
  assert.deepEqual(m.others, ["docker", "testing-basics"]);
  assert.deepEqual(m.choices, { nodejs: "have", sql: "have", docker: "leave", "testing-basics": "leave" });
});

test("buildConfirmedProfile follows the mapping table (preferred route)", () => {
  const p = buildConfirmedProfile({
    choices: { nodejs: "have", sql: "remove", docker: "notsure", "testing-basics": "have" },
    levels: { nodejs: "intermediate" },
    foundIds: ["nodejs", "sql"],
    route: "qa-automation",
    now: new Date("2026-10-23T10:00:00Z"),
  });
  assert.deepEqual(p, {
    status: "confirmed",
    confirmedSkills: [{ skillId: "nodejs", level: "intermediate" }, { skillId: "testing-basics" }],
    removedSkillIds: ["sql"],
    addedSkillIds: ["testing-basics"],
    unconfirmedSkillIds: ["docker"],
    entryPath: "preferred-route",
    confirmedAt: "2026-10-23T10:00:00.000Z",
    preferredRouteId: "qa-automation",
  });
});

test("buildConfirmedProfile: exploring has no preferredRouteId; 'leave' sends nothing", () => {
  const p = buildConfirmedProfile({
    choices: { nodejs: "have", docker: "leave" },
    levels: {},
    foundIds: ["nodejs"],
    route: "explore",
  });
  assert.equal(p.entryPath, "exploring");
  assert.equal("preferredRouteId" in p, false);
  assert.deepEqual(p.confirmedSkills, [{ skillId: "nodejs" }]);
  assert.deepEqual([...p.removedSkillIds, ...p.addedSkillIds, ...p.unconfirmedSkillIds], []);
});

test("buildConfirmedProfile: every skill is in at most one list (backend rule)", () => {
  const p = buildConfirmedProfile({
    choices: { nodejs: "have", sql: "notsure", docker: "remove", "testing-basics": "leave" },
    levels: { sql: "advanced" },
    foundIds: ["nodejs", "sql", "docker"],
    route: "explore",
  });
  const all = [...p.confirmedSkills.map((s) => s.skillId), ...p.removedSkillIds, ...p.unconfirmedSkillIds];
  assert.equal(new Set(all).size, all.length);
  for (const id of p.addedSkillIds) assert.ok(p.confirmedSkills.some((s) => s.skillId === id));
});
