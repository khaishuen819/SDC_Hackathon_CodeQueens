// Pure helpers for the roadmap (metro line): no DOM, no network (tested in checks/).

// Line colour class and letter per route. A route we don't know yet gets a neutral badge.
const LINES = {
  "backend-development": { letter: "B", cls: "b" },
  "qa-automation": { letter: "Q", cls: "q" },
};
export function lineOf(role) {
  return LINES[role.roleId] ?? { letter: (role.name || "?").charAt(0).toUpperCase(), cls: "x" };
}

// Stations along the line, in order:
// Your CV -> skills already on the profile -> You are here -> pathway steps -> Goal.
// role: RoleInfo from /api/roles; other: the other RoleInfo (for interchanges) or null;
// profile: the ConfirmedProfile sent; pathway: PathwayResponse for this role.
export function stationDetails(role, pathway, catalogue, skillId) {
  const association = role.skills.find(skill => skill.skillId === skillId) ?? null;
  const step = pathway.steps.find(item => item.skillId === skillId) ?? null;
  if (!association && !step) return null;
  const name = catalogue?.get(skillId);
  if (!name) throw new Error("The skills catalogue is missing a station name.");
  return { skillId, name, association, step, countsForCoverage: Boolean(association) };
}

export function buildStations(role, other, profile, pathway, catalogue) {
  const info = new Map(role.skills.map((s) => [s.skillId, s]));
  const onOther = new Set(other ? other.skills.map((s) => s.skillId) : []);
  const confirmed = new Set(profile.confirmedSkills.map((s) => s.skillId));
  const notSure = new Set(profile.unconfirmedSkillIds);

  const passed = role.skills.filter((s) => confirmed.has(s.skillId));
  const stations = [];
  stations.push({ kind: "term", name: "Your CV", meta: `${passed.length} of ${role.skills.length} listed skills confirmed` });
  for (const s of passed) {
    stations.push({ kind: "passed", skillId: s.skillId, name: stationDetails(role, pathway, catalogue, s.skillId).name, interchange: onOther.has(s.skillId) });
  }
  stations.push({ kind: "here", name: "You are here" });

  let lastZone = null;
  for (const step of [...pathway.steps].sort((a, b) => a.order - b.order)) {
    const s = info.get(step.skillId);
    const required = s ? s.isRequired : false;
    const detail = stationDetails(role, pathway, catalogue, step.skillId);
    const zone = step.isPrerequisite ? "Prerequisite steps" : "Route skills";
    stations.push({
      kind: "stop",
      skillId: step.skillId,
      name: detail.name,
      order: step.order,
      required,
      countsForCoverage: detail.countsForCoverage,
      isPrerequisite: Boolean(step.isPrerequisite),
      possessionState: step.possessionState,
      estimateBasis: step.estimateBasis,
      notSure: notSure.has(step.skillId),
      hours: step.estimatedHours,
      interchange: onOther.has(step.skillId),
      zone: zone !== lastZone ? zone : null,
    });
    lastZone = zone;
  }
  stations.push({ kind: "term", name: `Goal: ${role.name}`, meta: "Learning does not automatically confirm possession" });
  return stations;
}

// Splits stations into rows of `cols` for the winding map. Even rows run left to right,
// odd rows right to left. l / r are the line's inset (in % of the row) at each end:
// a row with a U-turn at an end runs to that edge; otherwise it stops at the end station.
export function snakeRows(stations, cols) {
  const colW = 100 / cols;
  const total = Math.ceil(stations.length / cols);
  const rows = [];
  for (let k = 0; k < total; k++) {
    const cells = stations.slice(k * cols, (k + 1) * cols);
    const leftToRight = k % 2 === 0;
    const incoming = k > 0;
    const outgoing = k < total - 1;
    const farEdge = 100 - (cells.length - 0.5) * colW;
    rows.push({
      cells,
      leftToRight,
      l: leftToRight ? (incoming ? 0 : colW / 2) : outgoing ? 0 : farEdge,
      r: leftToRight ? (outgoing ? 0 : farEdge) : incoming ? 0 : colW / 2,
      turnRight: leftToRight && outgoing,
      turnLeft: !leftToRight && outgoing,
    });
  }
  return rows;
}

export function columnsFor(width) {
  return width < 560 ? 2 : width < 900 ? 3 : 4;
}
