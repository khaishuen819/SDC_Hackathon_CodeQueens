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
export function buildStations(role, other, profile, pathway) {
  const info = new Map(role.skills.map((s) => [s.skillId, s]));
  const onOther = new Set(other ? other.skills.map((s) => s.skillId) : []);
  const confirmed = new Set(profile.confirmedSkills.map((s) => s.skillId));
  const notSure = new Set(profile.unconfirmedSkillIds);

  const passed = role.skills.filter((s) => confirmed.has(s.skillId));
  const stations = [];
  stations.push({ kind: "term", name: "Your CV", meta: `${passed.length} of ${role.skills.length} stations already on your profile` });
  for (const s of passed) {
    stations.push({ kind: "passed", skillId: s.skillId, name: s.name, interchange: onOther.has(s.skillId) });
  }
  stations.push({ kind: "here", name: "You are here" });

  let lastRequired = null;
  for (const step of [...pathway.steps].sort((a, b) => a.order - b.order)) {
    const s = info.get(step.skillId);
    const required = s ? s.isRequired : false;
    stations.push({
      kind: "stop",
      skillId: step.skillId,
      name: s ? s.name : step.skillId,
      order: step.order,
      required,
      notSure: notSure.has(step.skillId),
      hours: step.estimatedHours,
      interchange: onOther.has(step.skillId),
      zone: required !== lastRequired ? (required ? "Required stops" : "Optional stops") : null,
    });
    lastRequired = required;
  }
  stations.push({ kind: "term", name: `Goal: ${role.name}`, meta: "Every station on this line covered" });
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
