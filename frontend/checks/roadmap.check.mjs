// Checks for public/js/roadmap.js. Run: cd frontend && npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStations, snakeRows, columnsFor, lineOf } from "../public/js/roadmap.js";

const backend = {
  roleId: "backend-development", name: "Backend Development",
  skills: [
    { skillId: "nodejs", name: "Node.js", weight: 3, isRequired: true },
    { skillId: "sql", name: "SQL", weight: 3, isRequired: true },
    { skillId: "git", name: "Git", weight: 2, isRequired: true },
    { skillId: "docker", name: "Docker", weight: 2, isRequired: false },
  ],
};
const qa = {
  roleId: "qa-automation", name: "QA Automation",
  skills: [{ skillId: "git", name: "Git", weight: 2, isRequired: true }, { skillId: "docker", name: "Docker", weight: 1, isRequired: false }],
};
const profile = {
  status: "confirmed",
  confirmedSkills: [{ skillId: "nodejs" }],
  removedSkillIds: [], addedSkillIds: [],
  unconfirmedSkillIds: ["docker"],
  entryPath: "exploring", confirmedAt: "2026-10-23T10:00:00Z",
};
// Shaped like a PathwayResponse (steps deliberately out of order).
const pathway = {
  roleId: "backend-development", isPlaceholder: true,
  steps: [
    { order: 3, skillId: "docker", why: "", estimatedHours: null, resources: [], prerequisites: [] },
    { order: 1, skillId: "sql", why: "", estimatedHours: 10, resources: [], prerequisites: [] },
    { order: 2, skillId: "git", why: "", estimatedHours: 10, resources: [], prerequisites: [] },
  ],
};

test("stations: CV, passed skills, you are here, stops in order, goal", () => {
  const s = buildStations(backend, qa, profile, pathway);
  assert.deepEqual(s.map((x) => x.kind), ["term", "passed", "here", "stop", "stop", "stop", "term"]);
  assert.deepEqual(s.filter((x) => x.kind === "stop").map((x) => x.skillId), ["sql", "git", "docker"]);
  assert.equal(s[1].skillId, "nodejs");
});

test("stations: zones, not sure, hours and interchanges", () => {
  const stops = buildStations(backend, qa, profile, pathway).filter((x) => x.kind === "stop");
  assert.deepEqual(stops.map((x) => x.zone), ["Required stops", null, "Optional stops"]);
  assert.equal(stops[2].notSure, true);
  assert.equal(stops[2].hours, null);
  assert.deepEqual(stops.map((x) => x.interchange), [false, true, true]);
});

test("snakeRows: rows alternate direction and turn at the right ends", () => {
  const stations = Array.from({ length: 10 }, (_, i) => ({ kind: "stop", order: i }));
  const rows = snakeRows(stations, 4);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.leftToRight), [true, false, true]);
  assert.deepEqual(rows.map((r) => [r.turnRight, r.turnLeft]), [[true, false], [false, true], [false, false]]);
  // First row starts at its first station (12.5%) and runs to the right edge.
  assert.deepEqual([rows[0].l, rows[0].r], [12.5, 0]);
  // Middle row runs edge to edge.
  assert.deepEqual([rows[1].l, rows[1].r], [0, 0]);
  // Last row (2 stations) comes in from the left edge and stops at its last station.
  assert.deepEqual([rows[2].l, rows[2].r], [0, 62.5]);
});

test("columnsFor and lineOf", () => {
  assert.equal(columnsFor(400), 2);
  assert.equal(columnsFor(800), 3);
  assert.equal(columnsFor(1200), 4);
  assert.deepEqual(lineOf(backend), { letter: "B", cls: "b" });
  assert.deepEqual(lineOf({ roleId: "data-analysis", name: "Data Analysis" }), { letter: "D", cls: "x" });
});
