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

// Versioned responses retain historical skills independently of current role lists.
export function skillCatalogue(rolesResponse) {
  const names = new Map();
  if (Object.hasOwn(rolesResponse, "criteria") || Object.hasOwn(rolesResponse, "recognisedSkills")) {
    const invalid = () => { throw new Error("The skills catalogue is invalid or incomplete. Reload it before continuing."); };
    const slug = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
    const registry = rolesResponse.recognisedSkills;
    if (!/^criteria-[a-f0-9]{64}$/.test(rolesResponse.criteria?.snapshotId ?? "")
      || !Array.isArray(registry) || !registry.length || !Array.isArray(rolesResponse.roles)) invalid();
    for (const skill of registry) {
      if (!skill || !slug(skill.skillId) || typeof skill.name !== "string" || !skill.name.length
        || Object.keys(skill).some(key => key !== "skillId" && key !== "name") || names.has(skill.skillId)) invalid();
      names.set(skill.skillId, skill.name);
    }
    for (const role of rolesResponse.roles) {
      if (!role || !slug(role.roleId) || !Array.isArray(role.skills)
        || role.skills.some(skill => !skill || skill.weight !== 1 || !names.has(skill.skillId))
        || new Set(role.skills.map(skill => skill.skillId)).size !== role.skills.length) invalid();
    }
    return names;
  }
  // Keep existing unversioned callers working during the paired UI integration.
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
