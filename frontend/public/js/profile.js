// Pure helpers for the "Check profile" step: no DOM, no network (tested in checks/).
// Rules: frontend/DESIGN.md section 5 and M2's TEAM_HANDOFF.md section 4.

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

// Quick check before uploading. The server checks again from the file's bytes.
export function checkFile(file) {
  if (!file) return "INVALID_INPUT";
  if (file.size > MAX_FILE_BYTES) return "FILE_TOO_LARGE";
  if (!/\.(pdf|txt)$/i.test(file.name)) return "UNSUPPORTED_FILE";
  return null;
}

// All skills from GET /api/roles: skillId -> name, in first-seen order.
export function skillCatalogue(rolesResponse) {
  const names = new Map();
  for (const role of rolesResponse.roles) {
    for (const s of role.skills) {
      if (!names.has(s.skillId)) names.set(s.skillId, s.name);
    }
  }
  return names;
}

// Turns a DraftProfile into what the review screen shows.
// Skills with the same skillId are merged; null or unknown IDs go to `unknown`.
export function reviewModel(draft, catalogue) {
  const found = [];
  const byId = new Map();
  const unknown = [];
  for (const s of draft.extractedSkills) {
    if (s.skillId && catalogue.has(s.skillId)) {
      const seen = byId.get(s.skillId);
      if (seen) {
        if (!seen.rawNames.includes(s.rawName)) seen.rawNames.push(s.rawName);
      } else {
        const item = { skillId: s.skillId, rawNames: [s.rawName], evidence: s.evidence };
        byId.set(s.skillId, item);
        found.push(item);
      }
    } else {
      unknown.push({ rawName: s.rawName, evidence: s.evidence });
    }
  }
  const others = [...catalogue.keys()].filter((id) => !byId.has(id));
  // Found skills start as "I have it"; the rest as "Leave".
  const choices = {};
  for (const f of found) choices[f.skillId] = "have";
  for (const id of others) choices[id] = "leave";
  return { found, unknown, others, choices };
}

// Builds the ConfirmedProfile sent to /api/match and /api/pathway.
// choices: skillId -> "have" | "notsure" | "remove" | "leave"
// route: a roleId (graduate has a route) or "explore".
export function buildConfirmedProfile({ choices, levels, foundIds, route, now }) {
  const found = new Set(foundIds);
  const confirmedSkills = [];
  const removedSkillIds = [];
  const addedSkillIds = [];
  const unconfirmedSkillIds = [];
  for (const [skillId, choice] of Object.entries(choices)) {
    if (choice === "have") {
      const level = levels[skillId];
      confirmedSkills.push(level ? { skillId, level } : { skillId });
      if (!found.has(skillId)) addedSkillIds.push(skillId);
    } else if (choice === "notsure") {
      unconfirmedSkillIds.push(skillId);
    } else if (choice === "remove" && found.has(skillId)) {
      removedSkillIds.push(skillId);
    }
  }
  const profile = {
    status: "confirmed",
    confirmedSkills,
    removedSkillIds,
    addedSkillIds,
    unconfirmedSkillIds,
    entryPath: route === "explore" ? "exploring" : "preferred-route",
    confirmedAt: (now ?? new Date()).toISOString(),
  };
  if (route !== "explore") profile.preferredRouteId = route;
  return profile;
}
