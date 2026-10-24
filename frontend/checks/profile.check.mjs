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

function versionedRoles() {
  return {
    ...structuredClone(roles),
    roles: roles.roles.map(role => ({ ...role, skills: role.skills.map(skill => ({ ...skill, weight: 1 })) })),
    recognisedSkills: [
      { skillId: "nodejs", name: "Canonical Node.js" }, { skillId: "sql", name: "SQL" },
      { skillId: "docker", name: "Docker" }, { skillId: "testing-basics", name: "Testing basics" },
      { skillId: "retained-skill", name: "Retained historical skill" },
    ],
    criteria: {
      snapshotId: "criteria-" + "a".repeat(64), policyVersion: "count-coverage-v1", status: "disabled",
      lastSuccessfulCheckAt: null, lastAttemptAt: null, providers: [], notices: [],
      deferredItemCount: 0, quarantinedItemCount: 0, refreshControl: { state: "ready", retryAt: null },
    },
  };
}

test("versioned recognition retains historical CV skills without adding role requirements", () => {
  const response = versionedRoles();
  const catalogue = skillCatalogue(response);
  assert.equal(catalogue.get("retained-skill"), "Retained historical skill");
  assert.equal(catalogue.get("nodejs"), "Canonical Node.js");
  const historicalDraft = {
    status: "draft", projects: [], experience: [], warnings: [], extractedSkills: [
      { skillId: "retained-skill", rawName: "Historical practice", evidence: "Fictional project", confidence: 1 },
      { skillId: "outside-catalogue", rawName: "Unknown practice", evidence: "Fictional claim", confidence: 1 },
    ],
  };
  const review = reviewModel(historicalDraft, catalogue);
  assert.deepEqual(review.found.map(s => s.skillId), ["retained-skill"]);
  assert.deepEqual(review.unknown, [{ rawName: "Unknown practice", evidence: "Fictional claim" }]);
  const profile = buildConfirmedProfile({ choices: review.choices, levels: {}, foundIds: ["retained-skill"], route: "qa-automation" });
  assert.deepEqual(profile.confirmedSkills, [{ skillId: "retained-skill" }]);
  assert.equal(profile.preferredRouteId, "qa-automation");
  assert.ok(response.roles.every(role => !role.skills.some(s => s.skillId === "retained-skill")));
});

test("versioned catalogues reject incomplete or malformed recognition instead of falling back", () => {
  const missing = versionedRoles();
  delete missing.recognisedSkills;
  const noCriteria = versionedRoles();
  delete noCriteria.criteria;
  const badInputs = [missing, noCriteria];
  for (const registry of [null, [], {},
    [{ skillId: "nodejs", name: "Node" }, { skillId: "nodejs", name: "Duplicate" }],
    [{ skillId: "BAD ID", name: "Invalid" }], [{ skillId: "nodejs", name: "" }],
    [{ skillId: "nodejs", name: "Node", extra: true }],
  ]) badInputs.push({ ...versionedRoles(), recognisedSkills: registry });
  badInputs.push({ ...versionedRoles(), criteria: null });
  badInputs.push({ ...versionedRoles(), criteria: { snapshotId: null } });
  badInputs.push({ ...versionedRoles(), criteria: { snapshotId: "criteria-invalid" } });
  for (const input of badInputs) assert.throws(() => skillCatalogue(input), /catalogue/i);
});

test("versioned role associations must resolve in the registry and count once", () => {
  for (const change of [{ skillId: "unrecognised" }, { weight: 2 }, { weight: 0 }]) {
    const response = versionedRoles();
    Object.assign(response.roles[0].skills[0], change);
    assert.throws(() => skillCatalogue(response), /catalogue/i);
  }
  const malformed = versionedRoles();
  malformed.roles[0].skills = null;
  assert.throws(() => skillCatalogue(malformed), /catalogue/i);
  const duplicated = versionedRoles();
  duplicated.roles[0].skills.push({ ...duplicated.roles[0].skills[0] });
  assert.throws(() => skillCatalogue(duplicated), /catalogue/i, "one capability cannot occupy two scored entries in a role");
});
