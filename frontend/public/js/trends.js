// Pure, in-memory trend/profile helpers. No DOM, network or persistence.

const slug = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const snapshotId = value => typeof value === "string" && /^criteria-[a-f0-9]{64}$/.test(value);
const nonempty = value => typeof value === "string" && value.length > 0;
const onlyKeys = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).every(key => keys.includes(key));
const order = (a, b) => a < b ? -1 : a > b ? 1 : 0;

function answerMap(answers) {
  if (!Array.isArray(answers)) throw new Error("Skill answers must be a list.");
  const result = new Map();
  for (const entry of answers) {
    if (!onlyKeys(entry, ["skillId", "answer"]) || !slug(entry.skillId)
      || !["have", "not-yet", "not-sure"].includes(entry.answer) || result.has(entry.skillId)) {
      throw new Error("Each skill needs one valid possession answer.");
    }
    result.set(entry.skillId, entry.answer);
  }
  return result;
}

// Match the backend's reconciliation rules; explicit Not yet lives in the answer ledger.
export function mergeSkillAnswers(profile, answers) {
  if (profile?.status !== "confirmed") throw new Error("Only a confirmed profile can receive skill answers.");
  const explicit = answerMap(answers);
  const confirmed = new Map(profile.confirmedSkills.map(skill => [skill.skillId, { ...skill }]));
  const originallyConfirmed = new Set(confirmed.keys());
  const added = new Set(profile.addedSkillIds);
  const removed = new Set(profile.removedSkillIds);
  const unsure = new Set(profile.unconfirmedSkillIds);
  for (const [skillId, answer] of explicit) {
    const old = confirmed.get(skillId), wasAdded = added.has(skillId);
    confirmed.delete(skillId); added.delete(skillId); unsure.delete(skillId);
    if (answer === "have") {
      confirmed.set(skillId, old ?? { skillId });
      removed.delete(skillId);
      if (wasAdded || !originallyConfirmed.has(skillId)) added.add(skillId);
    } else if (answer === "not-sure") {
      removed.delete(skillId); unsure.add(skillId);
    }
  }
  return {
    ...profile,
    confirmedSkills: [...confirmed.values()].sort((a, b) => order(a.skillId, b.skillId)),
    addedSkillIds: [...added].sort(order), removedSkillIds: [...removed].sort(order), unconfirmedSkillIds: [...unsure].sort(order),
  };
}

// Resend this full snapshot's ledger on later API calls so Not yet is not lost.
export function recordSkillAnswer(session, skillId, answer) {
  const target = session.acceptedSnapshotId;
  if (!snapshotId(target)) throw new Error("Accept a criteria snapshot before recording an answer.");
  answerMap([{ skillId, answer }]);
  const explicit = answerMap(session.answersBySnapshotId?.[target] ?? []);
  explicit.set(skillId, answer);
  const answers = [...explicit].sort(([a], [b]) => order(a, b)).map(([skillId, answer]) => ({ skillId, answer }));
  return {
    ...session, profile: mergeSkillAnswers(session.profile, answers),
    answersBySnapshotId: { ...session.answersBySnapshotId, [target]: answers },
  };
}

export function learningChoice(session, skillId, choice) {
  if (!slug(skillId)) throw new Error("Choose a valid skill for the learning plan.");
  if (choice !== "add" && choice !== "not-now") throw new Error("Choose a supported learning action.");
  return { ...session, learningChoicesBySkillId: { ...session.learningChoicesBySkillId, [skillId]: choice } };
}

export function buildOptionalQuestions(review, profile, answers = []) {
  if (!onlyKeys(review, ["fromSnapshotId", "targetSnapshotId", "questions"]) || !snapshotId(review.targetSnapshotId)
    || (Object.hasOwn(review, "fromSnapshotId") && !snapshotId(review.fromSnapshotId))
    || !Array.isArray(review.questions)
    || !review.questions.every(q => onlyKeys(q, ["skillId", "name", "roleIds", "why", "evidenceIds", "state"])
      && slug(q.skillId) && nonempty(q.name) && nonempty(q.why)
      && Array.isArray(q.roleIds) && q.roleIds.length > 0 && q.roleIds.every(slug)
      && Array.isArray(q.evidenceIds) && q.evidenceIds.every(slug)
      && ["not-sure", "unanswered"].includes(q.state))
    || new Set(review.questions.map(q => q.skillId)).size !== review.questions.length) {
    throw new Error("The skill-review guidance is invalid. Reload the catalogue.");
  }
  const explicit = answerMap(answers);
  const confirmed = new Set(profile.confirmedSkills.map(skill => skill.skillId));
  return review.questions.filter(q => !confirmed.has(q.skillId)
    && explicit.get(q.skillId) !== "have" && explicit.get(q.skillId) !== "not-yet")
    .map(q => ({ ...q, roleIds: [...q.roleIds], evidenceIds: [...q.evidenceIds],
      state: explicit.get(q.skillId) === "not-sure" ? "not-sure" : q.state }));
}

export function formatEvidenceDate(item) {
  const updated = item.dateBasis === "updated";
  const precision = item.datePrecision;
  const date = nonempty(item.originalDate) ? item.originalDate : precision === "day" ? item.publishedDate : null;
  if (!["day", "month", "year"].includes(precision) || !nonempty(date)) {
    return updated ? "Update date unknown" : "Publication date unknown";
  }
  return `${updated ? "Updated" : "Published"} ${date}${precision === "day" ? "" : ` (${precision} only)`}`;
}

// Plain text for the UI to escape. No current-time substitution, expiry or retry timer.
export function trendNotices(meta) {
  const status = {
    fresh: "Update check completed.", partial: "Update coverage is partial.",
    disabled: "Automatic trend updates are disabled.", unavailable: "Trend updates are unavailable.",
  };
  if (!meta || !Object.hasOwn(status, meta.status)) return ["Trend update status is unavailable."];
  const lines = [meta.status === "fresh" && !snapshotId(meta.snapshotId) ? status.unavailable : status[meta.status]];
  lines.push(snapshotId(meta.snapshotId) ? "Using saved criteria." : "No saved criteria are available.");
  lines.push(meta.lastSuccessfulCheckAt ? `Last successful update check: ${meta.lastSuccessfulCheckAt}.` : "No successful update check recorded.");
  if (meta.lastAttemptAt) lines.push(`Last update attempt: ${meta.lastAttemptAt}.`);
  for (const provider of meta.providers ?? []) {
    lines.push(`${provider.providerId}: ${provider.status}. Last successful check: ${provider.lastSuccessfulCheckAt ?? "not recorded"}.`);
    if (provider.lastAttemptAt) lines.push(`${provider.providerId}: last attempt ${provider.lastAttemptAt}.`);
  }
  const control = meta.refreshControl;
  if (control?.state === "busy" || control?.state === "cooldown") {
    lines.push(`Update control: ${control.state}.${control.retryAt ? ` Next eligible check: ${control.retryAt}.` : ""}`);
  }
  if (meta.deferredItemCount > 0) lines.push(`${meta.deferredItemCount} update item(s) deferred for a later eligible check.`);
  if (meta.quarantinedItemCount > 0) lines.push(`${meta.quarantinedItemCount} update item(s) quarantined after repeated input failures; saved criteria are retained.`);
  return [...lines, ...(meta.notices ?? [])];
}
