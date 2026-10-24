// Code Queens frontend (M1). Screens: Upload CV -> Check profile -> Results -> Roadmap.
// Design: frontend/DESIGN.md. API: src/server/contracts/ (M2).
// Rendering: each screen is an HTML string; ALL text from the API or the CV goes through esc().

import { api, ApiError, ERROR_HINTS } from "./api.js";
import { checkFile, skillCatalogue, reviewModel, buildConfirmedProfile } from "./profile.js";
import { lineOf, buildStations, stationDetails, snakeRows, columnsFor } from "./roadmap.js";
import { createCriteriaFlow } from "./criteria-flow.js";
import { recordSkillAnswer, learningChoice, buildOptionalQuestions, formatEvidenceDate, trendNotices } from "./trends.js";

const STEPS = [
  ["upload", "Upload CV"],
  ["review", "Check profile"],
  ["results", "Results"],
  ["roadmap", "Roadmap"],
];
const STEP_OF = { upload: 1, reading: 1, review: 2, matching: 3, results: 3, building: 4, roadmap: 4 };
const LOADING = { reading: "Reading your CV…", matching: "Matching your profile…", building: "Drawing your line…" };
const COST_LABEL = { free: "free", paid: "paid", unknown: "cost unknown" };
const SAMPLES = [
  { file: "backend-graduate.txt", label: "Jordan (fictional), backend projects" },
  { file: "qa-graduate.txt", label: "Sam (fictional), testing projects" },
];

function freshState() {
  return {
    screen: "upload",
    maxStep: 1,
    file: null,
    uploadError: null, // ApiError for the upload screen
    error: null, // ApiError for the current screen (match / pathway)
    retry: null, // action to retry that error
    draft: null,
    review: null, // { found, unknown, others }
    choices: {},
    levels: {},
    route: null, // roleId or "explore"
    profile: null, // the ConfirmedProfile last sent
    acceptedSnapshotId: null,
    criteria: null,
    skillReview: null, // server guidance; separate from the CV review model
    answersBySnapshotId: {},
    learningChoicesBySkillId: {},
    panelErrors: {},
    pending: null,
    match: null,
    compareOpen: false,
    chosen: null,
    pathway: null,
    open: null, // skillId shown in the details panel
    view: "map",
  };
}

// Reference data is replaced only by a current, accepted response.
const ref = { roles: null, catalogue: null, sdg: null, sdgFailed: false, evidence: null, evidenceFailed: false };
const criteriaFlow = createCriteriaFlow(api);
let state = freshState();
let cols = columnsFor(window.innerWidth);
let requestId = 0; // ignores answers to requests the user has moved away from

const appEl = document.getElementById("app");
const stepperEl = document.getElementById("stepper");
const liveEl = document.getElementById("live");

// ---------- helpers ----------

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
const skillName = (id) => (ref.catalogue && ref.catalogue.get(id)) || id;
const roleById = (id) => ref.roles && ref.roles.roles.find((r) => r.roleId === id);
const isSafeUrl = (url) => /^https?:\/\//i.test(url);
const isSampleUrl = (url) => /^https?:\/\/(?:[^/]+\.)?example(?:\.(?:com|org|net))?(?=[:/]|$)/i.test(url);
const hoursText = (h) => (h == null ? "time not known yet" : `~${h} h`);
const estimateText = (hours, basis) => hours == null ? "Time estimate unavailable" :
  `${basis === "app" ? "App-estimated" : basis === "provider" ? "Provider-estimated" : "Estimated"} ${hoursText(hours)}`;

function lineBadge(role, size = "") {
  const line = lineOf(role);
  return `<span class="lb ${line.cls} ${size}" aria-hidden="true">${esc(line.letter)}</span>`;
}

function asApiError(err) {
  return err instanceof ApiError ? err : new ApiError("INTERNAL_ERROR", "Something went wrong. Please try again.");
}

function errorBox(err, { retry, back } = {}) {
  const hint = ERROR_HINTS[err.code];
  return `<div class="notice error" role="alert">
    <div class="stack" style="gap:6px">
      <strong>${esc(err.message)}</strong>
      ${hint ? `<span>${esc(hint)}</span>` : ""}
      <span class="mono small">${esc(err.code)}</span>
      ${retry || back ? `<div class="row" style="margin-top:6px">
        ${retry ? `<button class="btn2" type="button" data-action="${esc(retry)}" data-key="err-retry">Try again</button>` : ""}
        ${back ? `<button class="back" type="button" data-action="go" data-screen="${esc(back)}" data-key="err-back"><span class="ar">←</span> Go back</button>` : ""}
      </div>` : ""}
    </div>
  </div>`;
}

function placeholderBanner() {
  return `<div class="notice ph" role="note"><span class="icon" aria-hidden="true">!</span><span><strong>Sample data.</strong> Some roles, skills, resources or SDG reasons are placeholders. Scores and hours are illustrative.</span></div>`;
}

function announce(text) {
  const id = requestId;
  liveEl.textContent = "";
  setTimeout(() => { if (id === requestId) liveEl.textContent = text; }, 50);
}

// ---------- state changes ----------

function update(patch) {
  const before = state.screen;
  state = { ...state, ...patch };
  render(before !== state.screen);
}

function goTo(screen, patch = {}) {
  // patch.maxStep resets progress (a new CV); otherwise progress only grows.
  const maxStep = patch.maxStep ?? Math.max(state.maxStep, STEP_OF[screen] ?? 1);
  update({ ...patch, screen, maxStep, open: patch.open ?? null, error: patch.error ?? null });
}

// Any change on the profile makes old results out of date: clear them.
function profileChanged(patch, editedSkillId) {
  invalidateRequests();
  let answersBySnapshotId = state.answersBySnapshotId;
  if (editedSkillId && state.acceptedSnapshotId) {
    const answers = (answersBySnapshotId[state.acceptedSnapshotId] ?? []).filter(answer => answer.skillId !== editedSkillId);
    const choice = patch.choices[editedSkillId];
    if (choice === "have" || choice === "notsure") answers.push({ skillId: editedSkillId, answer: choice === "have" ? "have" : "not-sure" });
    answersBySnapshotId = { ...answersBySnapshotId, [state.acceptedSnapshotId]: answers };
  }
  Object.assign(ref, { sdg: null, evidence: null, sdgFailed: false, evidenceFailed: false });
  // The catalogue version and personal choices survive ordinary review edits.
  // Results are invalidated; a new CV or Start over still clears the whole session.
  update({ ...patch, profile: null, match: null, pathway: null, chosen: null, answersBySnapshotId, panelErrors: {},
    pending: null, maxStep: Math.min(state.maxStep, 2), error: null });
}

// ---------- actions ----------

function invalidateRequests() {
  criteriaFlow.invalidate();
  return ++requestId;
}

function navigate(screen) {
  invalidateRequests();
  goTo(screen, { pending: null });
}

async function loadRoles() {
  const roles = await api.roles();
  return { roles, catalogue: skillCatalogue(roles) };
}

function acceptReady(view, id, answers = []) {
  if (id !== requestId || view.status !== "ready") return null;
  const catalogue = skillCatalogue(view.rolesResponse);
  // Retain explicit CV corrections if the registry advanced while matching.
  const form = reviewModel(state.draft, catalogue);
  const confirmed = new Set(view.profile.confirmedSkills.map(skill => skill.skillId));
  const unsure = new Set(view.profile.unconfirmedSkillIds), removed = new Set(view.profile.removedSkillIds);
  const choices = Object.fromEntries([...catalogue.keys()].map(skillId => [skillId,
    confirmed.has(skillId) ? "have" : unsure.has(skillId) ? "notsure" : removed.has(skillId) ? "remove" : "leave"]));
  Object.assign(ref, { roles: view.rolesResponse, catalogue, sdg: null, evidence: null, sdgFailed: false, evidenceFailed: false });
  return {
    profile: view.profile, match: view.matchResponse, acceptedSnapshotId: view.snapshotId,
    criteria: view.criteria, skillReview: view.review, panelErrors: {}, choices,
    review: { found: form.found, unknown: form.unknown, others: form.others },
    answersBySnapshotId: { ...state.answersBySnapshotId, [view.snapshotId]: answers.map(answer => ({ ...answer })) },
  };
}

function acceptedReview() {
  return { ...(state.skillReview?.fromSnapshotId ? { fromSnapshotId: state.skillReview.fromSnapshotId } : {}),
    targetSnapshotId: state.acceptedSnapshotId, answers: state.answersBySnapshotId[state.acceptedSnapshotId] ?? [] };
}

function setFile(file) {
  if (!file) return;
  invalidateRequests();
  const code = checkFile(file);
  const uploadError = code ? new ApiError(code, code === "FILE_TOO_LARGE" ? "This file is over 2 MB." : "This file type isn't supported.") : null;
  update({ file: code ? null : file, uploadError, pending: null });
}

async function useSample(name) {
  const id = invalidateRequests();
  try {
    const res = await fetch(`samples/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    if (id !== requestId) return;
    setFile(new File([blob], name, { type: "text/plain" }));
  } catch {
    if (id !== requestId) return;
    update({ uploadError: new ApiError("NETWORK", "We couldn't load the sample CV.") });
  }
}

async function readCv() {
  if (!state.file) return;
  const id = invalidateRequests(), file = state.file;
  goTo("reading", { uploadError: null, pending: null });
  try {
    const draft = await api.extract(file);
    if (id !== requestId) return;
    const references = await loadRoles();
    if (id !== requestId) return;
    Object.assign(ref, references, { sdg: null, evidence: null, sdgFailed: false, evidenceFailed: false });
    const review = reviewModel(draft, ref.catalogue);
    goTo("review", {
      draft,
      review: { found: review.found, unknown: review.unknown, others: review.others },
      choices: review.choices,
      levels: {},
      route: null,
      profile: null,
      acceptedSnapshotId: null,
      criteria: null,
      skillReview: null,
      answersBySnapshotId: {},
      learningChoicesBySkillId: {},
      panelErrors: {},
      match: null,
      pathway: null,
      chosen: null,
      maxStep: 2,
    });
  } catch (err) {
    if (id !== requestId) return;
    update({ screen: "upload", uploadError: asApiError(err) });
  }
}

async function confirmProfile() {
  if (!state.route || state.pending) return;
  const profile = buildConfirmedProfile({
    choices: state.choices,
    levels: state.levels,
    foundIds: state.review.found.map((f) => f.skillId),
    route: state.route,
  });
  const id = ++requestId;
  const fromSnapshotId = ref.roles?.criteria?.snapshotId;
  const answers = state.answersBySnapshotId[state.acceptedSnapshotId] ?? [];
  goTo("matching", { pending: "confirm" });
  try {
    const view = await criteriaFlow.confirm(profile, { fromSnapshotId, answers });
    const accepted = acceptReady(view, id, answers);
    if (!accepted) return;
    goTo("results", { ...accepted, compareOpen: false, pathway: null, chosen: null, pending: null, maxStep: 3 });
  } catch (err) {
    if (id !== requestId) return;
    update({ screen: state.match ? "results" : "review", pending: null, error: asApiError(err), retry: "confirm" });
  }
}

async function chooseRoute(roleId, { openSkillId = null } = {}) {
  if (state.pending) return;
  const id = ++requestId;
  const profile = state.profile, review = acceptedReview();
  goTo("building", { chosen: roleId, pending: "pathway" });
  try {
    const view = await criteriaFlow.loadPathway(profile, roleId, review);
    if (id !== requestId || view.status !== "ready" || view.snapshotId !== state.acceptedSnapshotId) return;
    buildStations(roleById(roleId), ref.roles.roles.find(role => role.roleId !== roleId), profile, view.pathway, ref.catalogue);
    Object.assign(ref, { sdg: view.sdg, evidence: view.evidence,
      sdgFailed: Boolean(view.panelErrors.sdg), evidenceFailed: Boolean(view.panelErrors.evidence) });
    const open = openSkillId && stationDetails(roleById(roleId), view.pathway, ref.catalogue, openSkillId) ? openSkillId : null;
    goTo("roadmap", { pathway: view.pathway, panelErrors: view.panelErrors, view: state.view, open, pending: null });
  } catch (err) {
    if (id !== requestId) return;
    update({ screen: "results", pending: null, error: asApiError(err), retry: "choose-again" });
  }
}

async function changeRecommendations(kind, skillId, answer) {
  if (state.pending || !state.profile || !state.acceptedSnapshotId) return;
  const control = state.criteria?.refreshControl;
  if (kind === "refresh" && control?.state !== "ready" && control?.retryAt && Date.parse(control.retryAt) > Date.now()) {
    announce(`Updates are ${control.state}. Check again after ${control.retryAt}.`);
    return;
  }
  let answers = acceptedReview().answers;
  try {
    if (kind === "possession") {
      if (!ref.catalogue.has(skillId)) return;
      answers = recordSkillAnswer(state, skillId, answer).answersBySnapshotId[state.acceptedSnapshotId];
    }
  } catch (error) { update({ error: asApiError(error), retry: null }); return; }
  const id = ++requestId, target = state.acceptedSnapshotId;
  const screen = state.screen === "roadmap" ? "roadmap" : "results", chosen = state.chosen;
  const profile = state.profile, review = { ...acceptedReview(), answers };
  update({ pending: kind, error: null, retry: null });
  try {
    const ready = kind === "refresh" ? await criteriaFlow.confirm(profile, { fromSnapshotId: target, answers })
      : await criteriaFlow.updatePossession(profile, review);
    if (id !== requestId || ready.status !== "ready") return;
    const path = screen === "roadmap" ? await criteriaFlow.loadPathway(ready.profile, chosen,
      { ...(ready.review.fromSnapshotId ? { fromSnapshotId: ready.review.fromSnapshotId } : {}), targetSnapshotId: ready.snapshotId, answers }) : null;
    if (id !== requestId || (path && path.status !== "ready")) return;
    if (path) buildStations(ready.rolesResponse.roles.find(role => role.roleId === chosen),
      ready.rolesResponse.roles.find(role => role.roleId !== chosen), ready.profile, path.pathway, skillCatalogue(ready.rolesResponse));
    const accepted = acceptReady(ready, id, answers);
    if (!accepted) return;
    if (path) Object.assign(ref, { sdg: path.sdg, evidence: path.evidence,
      sdgFailed: Boolean(path.panelErrors.sdg), evidenceFailed: Boolean(path.panelErrors.evidence) });
    const open = path && state.open && stationDetails(roleById(chosen), path.pathway, ref.catalogue, state.open) ? state.open : null;
    update({ ...accepted, screen, chosen, open, pathway: path?.pathway ?? null, panelErrors: path?.panelErrors ?? {},
      maxStep: screen === "roadmap" ? 4 : 3, pending: null, error: null });
    if (!open) document.getElementById("skill-guidance-title")?.focus({ preventScroll: true });
    announce(kind === "refresh" ? "Update check finished. Review the source status and saved criteria." : "Skill answer updated. Scores use confirmed coverage.");
  } catch (error) {
    if (id !== requestId) return;
    update({ pending: null, error: asApiError(error), retry: null });
    announce("The update could not be completed. Your previous results are kept.");
  }
}

function chooseLearning(skillId, value) {
  if (state.pending || !ref.catalogue?.has(skillId)) return;
  const next = learningChoice(state, skillId, value);
  update({ learningChoicesBySkillId: next.learningChoicesBySkillId });
  announce(value === "add" ? "Added to your learning plan for this session. Possession and scores are unchanged." : "Not now selected. Possession and scores are unchanged.");
}

function seeWhy(skillId, roleId) {
  if (state.pending) return;
  if (state.screen === "roadmap" && stationDetails(roleById(state.chosen), state.pathway, ref.catalogue, skillId)) update({ open: skillId });
  else chooseRoute(roleId, { openSkillId: skillId });
}

function restart() {
  if (state.draft && !window.confirm("Start over? Your checked profile and results will be cleared.")) return;
  invalidateRequests();
  Object.assign(ref, { roles: null, catalogue: null, sdg: null, sdgFailed: false, evidence: null, evidenceFailed: false });
  state = freshState();
  render(true);
}

const actions = {
  restart,
  step: (el) => {
    const target = el.dataset.screen;
    if (STEP_OF[target] <= state.maxStep) navigate(target);
  },
  go: (el) => navigate(el.dataset.screen),
  sample: (el) => useSample(el.dataset.file),
  "clear-file": () => { invalidateRequests(); update({ file: null, uploadError: null, pending: null }); },
  read: readCv,
  choice: (el) => profileChanged({ choices: { ...state.choices, [el.dataset.skill]: el.dataset.value } }, el.dataset.skill),
  route: (el) => profileChanged({ route: el.dataset.value }),
  confirm: confirmProfile,
  "toggle-compare": () => update({ compareOpen: !state.compareOpen }),
  choose: (el) => chooseRoute(el.dataset.role),
  "choose-again": () => chooseRoute(state.chosen),
  view: (el) => update({ view: el.dataset.value }),
  open: (el) => { if (!state.pending) update({ open: el.dataset.skill }); },
  possession: (el) => changeRecommendations("possession", el.dataset.skill, el.dataset.value),
  learning: (el) => chooseLearning(el.dataset.skill, el.dataset.value),
  why: (el) => seeWhy(el.dataset.skill, el.dataset.role),
  refresh: () => changeRecommendations("refresh"),
  close: closeDrawer,
};

function closeDrawer() {
  const skill = state.open;
  update({ open: null });
  const back = skill && appEl.querySelector(`[data-key="open-${CSS.escape(skill)}"]`);
  if (back) back.focus();
}

// ---------- screens ----------

function trendPanel() {
  const notices = trendNotices(state.criteria), control = state.criteria?.refreshControl;
  return `<section class="card pad stack" aria-label="AI trend updates">
    <h2 style="font-size:22px">AI trend updates</h2>
    <p class="small">${notices.slice(0, 2).map(esc).join(" ")}</p>
    ${control && control.state !== "ready" ? `<p class="small">Updates are ${esc(control.state)}.${control.retryAt ? ` Next eligible check: ${esc(control.retryAt)}.` : ""}</p>` : ""}
    <details><summary>Source check details</summary><ul class="trend-notices small">${notices.slice(2).map(line => `<li>${esc(line)}</li>`).join("")}</ul></details>
    <p class="small muted">AI interpretations are app estimates based on the listed sources. A tool update alone does not establish hiring growth.</p>
    <div><button type="button" class="btn2" data-action="refresh" data-key="refresh" ${state.pending ? "disabled" : ""}>Check for updates</button></div>
    ${state.pending ? `<p class="small" role="status">Updating your recommendations…</p>` : ""}
  </section>`;
}

function possessionAnswer(skillId) {
  return acceptedReview().answers.find(answer => answer.skillId === skillId)?.answer
    ?? (state.profile.confirmedSkills.some(skill => skill.skillId === skillId) ? "have"
      : state.profile.unconfirmedSkillIds.includes(skillId) ? "not-sure" : null);
}

function skillControls(skillId, roleId, { showWhy = true } = {}) {
  const answer = possessionAnswer(skillId), choice = state.learningChoicesBySkillId[skillId];
  const disabled = state.pending ? "disabled" : "";
  const status = answer === "have" ? "Confirmed in your profile" : answer === "not-yet" ? "You marked this Not yet"
    : answer === "not-sure" ? "You marked this Not sure" : "Possession is not confirmed";
  return `<div class="stack skill-actions">
    <p class="small"><strong>${esc(status)}</strong>. Only confirmed possession earns coverage credit.</p>
    <div class="seg-group" role="group" aria-label="Possession of ${esc(skillName(skillId))}">
      ${[["have", "Have"], ["not-yet", "Not yet"], ["not-sure", "Not sure"]].map(([value, label]) =>
        `<button type="button" class="seg${answer === value ? " on" : ""}" aria-pressed="${answer === value}" data-action="possession" data-skill="${esc(skillId)}" data-value="${value}" data-key="possession-${esc(skillId)}-${value}" ${disabled}>${label}</button>`).join("")}
    </div>
    <p class="small muted">Choose Have if you already have this skill. Learning choices below do not change possession or scores.</p>
    <div class="row">
      ${showWhy ? `<button class="btn2" type="button" data-action="why" data-skill="${esc(skillId)}" data-role="${esc(roleId)}" data-key="why-${esc(skillId)}" ${disabled}>See why it matters</button>` : ""}
      <button class="btn2" type="button" aria-pressed="${choice === "add"}" data-action="learning" data-skill="${esc(skillId)}" data-value="add" data-key="learn-${esc(skillId)}" ${disabled}>Add to my learning plan</button>
      <button class="back" type="button" aria-pressed="${choice === "not-now"}" data-action="learning" data-skill="${esc(skillId)}" data-value="not-now" data-key="later-${esc(skillId)}" ${disabled}>Not now</button>
    </div>
    ${choice ? `<p class="small">${choice === "add" ? "Added to your learning plan for this session." : "Not now selected. Your score is unchanged."}</p>` : ""}
  </div>`;
}

function guidancePanel(roleId) {
  const selected = roleId ? [roleId] : state.profile.preferredRouteId ? [state.profile.preferredRouteId] : state.match.roles.map(role => role.roleId);
  const matched = state.match.roles.filter(role => selected.includes(role.roleId));
  const ids = new Set(matched.flatMap(role => [...role.gaps, ...role.unconfirmedSkills].map(skill => skill.skillId)));
  if (roleId && state.pathway) for (const step of state.pathway.steps) ids.add(step.skillId);
  const questions = new Map(buildOptionalQuestions(state.skillReview, state.profile, acceptedReview().answers).map(q => [q.skillId, q]));
  const goals = Object.entries(state.learningChoicesBySkillId).filter(([, choice]) => choice === "add");
  return `<section class="card pad stack" aria-labelledby="skill-guidance-title" aria-busy="${Boolean(state.pending)}">
    <h2 id="skill-guidance-title" tabindex="-1" style="font-size:24px">Skills to learn or confirm</h2>
    <p class="small muted">These questions are optional. You can use your results and pathway without answering every skill.</p>
    <div class="guidance-grid">${[...ids].map(id => {
      const question = questions.get(id);
      const route = roleId ?? matched.find(role => [...role.gaps, ...role.unconfirmedSkills].some(skill => skill.skillId === id))?.roleId;
      return `<article class="skill-guidance stack"><h3>${esc(skillName(id))}</h3>
        ${question ? `<p class="small">${esc(question.why)}</p>` : ""}${skillControls(id, route)}</article>`;
    }).join("") || `<p class="small">All listed skills for this selection are confirmed in your profile.</p>`}</div>
    <div class="stack" style="gap:6px"><h3>Your learning plan — this session only</h3>
      ${goals.length ? `<ul>${goals.map(([id]) => `<li>${esc(skillName(id))}</li>`).join("")}</ul>` : `<p class="small muted">No learning goals added yet.</p>`}
      <p class="small muted">Reloading or starting over clears these choices. Adding a goal does not confirm that you have learned it.</p>
    </div>
  </section>`;
}

function renderStepper() {
  const cur = STEP_OF[state.screen];
  const loading = state.screen in LOADING;
  return STEPS.map(([screen, label], i) => {
    const n = i + 1;
    const now = n === cur;
    const reachable = !loading && !now && n <= state.maxStep;
    const cls = now ? "mbtn now" : reachable ? "mbtn done" : "mbtn todo";
    return `<li class="${n <= cur ? "reached" : ""}"><button type="button" class="${cls}" data-action="step" data-screen="${screen}" data-key="step-${screen}" ${reachable ? "" : "disabled"} ${now ? 'aria-current="step"' : ""}><span class="d" aria-hidden="true"></span><span class="t">${label}</span></button></li>`;
  }).join("");
}

function renderUpload() {
  const lines = ref.roles
    ? ref.roles.roles.map((r) => `<strong class="c-${lineOf(r).cls}">${esc(r.name)}</strong>`).join(" and ")
    : "<strong>Backend Development</strong> and <strong>QA Automation</strong>";
  const f = state.file;
  const ext = f ? (f.name.split(".").pop() || "").toUpperCase() : "";
  return `<section class="stack-lg">
    <div class="stack" style="max-width:760px">
      <span class="pill dark" style="align-self:flex-start">For CS fresh graduates</span>
      <h1 id="screen-title" tabindex="-1" style="font-size:clamp(38px,6.5vw,60px)">Map your next skill.</h1>
      <p class="lead" style="font-size:19px">Upload your CV and see where you are on our two pilot career lines, ${lines}, and which skills to learn next.</p>
    </div>
    <div class="grid-2">
      <div class="stack">
        <label class="drop" data-drop>
          <input id="cv-input" class="sr-only" type="file" accept=".pdf,.txt,application/pdf,text/plain">
          <strong style="font-size:18px">Drop your CV here or choose a file</strong>
          <span class="small muted">PDF with real text, or .txt · max 2 MB · use a fictional CV only</span>
        </label>
        ${f ? `<div class="file-chip">
          <span class="file-ext" aria-hidden="true">${esc(ext)}</span>
          <span class="stack" style="gap:0;flex:1;min-width:0"><span class="mono" style="overflow-wrap:anywhere">${esc(f.name)}</span><span class="small muted">${(f.size / 1024).toFixed(1)} KB · ready</span></span>
          <button class="link" type="button" data-action="clear-file" data-key="clear-file">Remove</button>
        </div>` : ""}
        <div class="row small"><span class="muted">No CV handy? Try a fictional sample:</span>
          ${SAMPLES.map((s) => `<button class="sample" type="button" data-action="sample" data-file="${esc(s.file)}" data-key="sample-${esc(s.file)}">${esc(s.label)}</button>`).join("")}
        </div>
        ${state.uploadError ? errorBox(state.uploadError) : ""}
        <div class="row" style="gap:14px">
          <button class="btn" type="button" data-action="read" data-key="read" ${f ? "" : "disabled"}>Read my CV →</button>
          <span class="small muted">Read in memory, never stored.</span>
        </div>
      </div>
      <div class="card pad stack">
        <h2 style="font-size:22px">How it works</h2>
        <div class="metro">
          ${[
            ["Upload your CV", "PDF or .txt, read in memory only."],
            ["Check what we found", "Fix, remove or add skills."],
            ["Pick a route, or let us suggest one", "You always make the final choice."],
            ["Follow your line", "Stations to learn next, in order."],
          ].map(([t, s], i, all) => `<div class="st-row${i === 0 ? " first" : ""}${i === all.length - 1 ? " last" : ""}" style="grid-template-columns:40px minmax(0,1fr)">
            <div class="st-rail"><span class="dot ${i === all.length - 1 ? "term" : "todo"}" style="top:6px"></span></div>
            <div style="padding:4px 0 16px 4px;line-height:1.4"><strong>${t}</strong><br><span class="small muted">${s}</span></div>
          </div>`).join("")}
        </div>
        ${ref.roles ? `<details><summary>About the two lines</summary>
          ${ref.roles.roles.map((r) => `<p class="small" style="margin-top:10px;display:flex;gap:10px">${lineBadge(r)}<span><strong>${esc(r.name)}:</strong> ${esc(r.description)} Required: ${esc(r.skills.filter((s) => s.isRequired).map((s) => s.name).join(", "))}.</span></p>`).join("")}
          ${ref.roles.isPlaceholder ? `<p class="small muted" style="margin-top:8px">Route descriptions are placeholder text.</p>` : ""}
        </details>` : ""}
      </div>
    </div>
  </section>`;
}

function renderLoading() {
  return `<section class="loading" role="status">
    <div class="spin" aria-hidden="true"></div>
    <p>${LOADING[state.screen]}</p>
    <p class="small muted">This can take a few seconds the first time (the server may be waking up).</p>
  </section>`;
}

function choiceButtons(skillId, options) {
  const cur = state.choices[skillId];
  const name = skillName(skillId);
  return options.map(([value, label, onCls]) => {
    const on = cur === value;
    return `<button type="button" class="seg${on ? " " + onCls : ""}" aria-pressed="${on}" data-action="choice" data-skill="${esc(skillId)}" data-value="${value}" data-key="c-${esc(skillId)}-${value}" aria-label="${esc(name)}: ${label}">${label}</button>`;
  }).join("");
}

function levelSelect(skillId) {
  if (state.choices[skillId] !== "have") return "";
  const cur = state.levels[skillId] ?? "";
  const opt = (v, l) => `<option value="${v}" ${cur === v ? "selected" : ""}>${l}</option>`;
  return `<select class="lvl" data-level="${esc(skillId)}" data-key="lvl-${esc(skillId)}" aria-label="Level for ${esc(skillName(skillId))} (optional)">
    ${opt("", "Level (optional)")}${opt("beginner", "Beginner")}${opt("intermediate", "Intermediate")}${opt("advanced", "Advanced")}
  </select>`;
}

function renderReview() {
  const d = state.draft;
  const r = state.review;
  const found = [["have", "I have it", "on"], ["notsure", "Not sure", "warn"], ["remove", "Remove", "grey"]];
  const other = [["have", "I have it", "on"], ["notsure", "Not sure", "warn"], ["leave", "Leave", "neutral"]];
  const counts = { have: 0, added: 0, notsure: 0, remove: 0 };
  const foundIds = new Set(r.found.map((f) => f.skillId));
  for (const [id, c] of Object.entries(state.choices)) {
    if (c === "have") { counts.have++; if (!foundIds.has(id)) counts.added++; }
    if (c === "notsure") counts.notsure++;
    if (c === "remove") counts.remove++;
  }
  const routes = [
    ...ref.roles.roles.map((role) => ({ value: role.roleId, badge: lineBadge(role), title: `Yes: ${role.name}`, sub: "Show me what to learn for this line." })),
    { value: "explore", badge: `<span class="lb x" aria-hidden="true">?</span>`, title: "Not yet", sub: "Suggest routes that match my CV. I'll choose." },
  ];
  const label = !state.route ? "Answer the route question first" : state.route === "explore" ? "Confirm and match routes →" : "Confirm and check my route →";

  return `<section class="stack-lg">
    <div><button class="back" type="button" data-action="go" data-screen="upload" data-key="back-upload"><span class="ar">←</span> Upload a different CV</button></div>
    <div class="stack" style="gap:8px">
      <h1 id="screen-title" tabindex="-1">Check what we found</h1>
      <p class="lead">Fix anything wrong before we match. AI can miss skills, so add any we didn't find. Only skills you confirm earn coverage credit; Not sure does not mean you lack the skill.</p>
      <p class="small muted">The optional level is self-reported. It does not affect the coverage score.</p>
    </div>
    ${d.warnings.length ? `<div class="notice info" role="note"><div class="stack" style="gap:2px"><strong>Notes from reading your CV</strong>${d.warnings.map((w) => `<span>· ${esc(w)}</span>`).join("")}</div></div>` : ""}

    <div class="card" style="padding:8px 22px 12px">
      <h2 style="font-size:24px;margin:14px 0 6px">Skills found in your CV</h2>
      ${r.found.length ? "" : `<p class="muted" style="padding:8px 0 12px">We didn't find any skills from our list. Add the ones you have below.</p>`}
      ${r.found.map((f) => `<div class="skill-row">
        <div class="who">
          <span style="font-size:17px;font-weight:600">${esc(skillName(f.skillId))} <span class="small muted" style="font-weight:400">written as ${f.rawNames.map((n) => `"${esc(n)}"`).join(", ")}</span></span>
          <span class="small muted">Found in your CV: <span class="mono" style="font-size:12.5px">"${esc(f.evidence)}"</span></span>
        </div>
        <div class="seg-group" role="group" aria-label="${esc(skillName(f.skillId))}">${choiceButtons(f.skillId, found)}${levelSelect(f.skillId)}</div>
      </div>`).join("")}
      ${r.unknown.map((u) => `<div class="skill-row muted"><div class="who">
        <span><span style="text-decoration:line-through">${esc(u.rawName)}</span> · not in our skill list, won't affect results</span>
        <span class="small">Found in your CV: <span class="mono" style="font-size:12.5px">"${esc(u.evidence)}"</span></span>
      </div></div>`).join("")}
    </div>

    ${r.others.length ? `<div class="card" style="padding:8px 22px 12px">
      <h2 style="font-size:24px;margin:14px 0 2px">Other recognised skills</h2>
      <p class="small muted" style="margin-bottom:8px">Not found in your CV. Add the ones you have.</p>
      ${r.others.map((id) => `<div class="skill-row">
        <span style="font-size:16px;font-weight:500;flex:1 1 200px">${esc(skillName(id))}</span>
        <div class="seg-group" role="group" aria-label="${esc(skillName(id))}">${choiceButtons(id, other)}${levelSelect(id)}</div>
      </div>`).join("")}
    </div>` : ""}

    ${d.projects.length || d.experience.length ? `<div class="grid-2">
      <div class="card pad stack" style="gap:10px"><h2 style="font-size:20px">Projects</h2>
        ${d.projects.length ? d.projects.map((p) => `<div class="small"><strong>${esc(p.title)}</strong><br><span style="color:var(--ink-2)">${esc(p.summary)}</span></div>`).join("") : `<span class="small muted">None found.</span>`}
      </div>
      <div class="card pad stack" style="gap:10px"><h2 style="font-size:20px">Experience</h2>
        ${d.experience.length ? d.experience.map((p) => `<div class="small"><strong>${esc(p.title)}${p.organisation ? ` · ${esc(p.organisation)}` : ""}</strong><br><span style="color:var(--ink-2)">${esc(p.summary)}</span></div>`).join("") : `<span class="small muted">None found.</span>`}
      </div>
    </div>` : ""}

    <div class="card pad stack" style="border:2px solid var(--ink)">
      <h2 style="font-size:26px" id="route-q">Do you already have a route in mind?</h2>
      <div role="radiogroup" aria-labelledby="route-q" style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
        ${routes.map((o) => {
          const on = state.route === o.value;
          return `<button type="button" role="radio" aria-checked="${on}" class="choice${on ? " on" : ""}" data-action="route" data-value="${esc(o.value)}" data-key="route-${esc(o.value)}">
            ${o.badge}<span class="stack" style="gap:4px"><strong style="font-size:17px">${esc(o.title)}</strong><span class="small muted">${esc(o.sub)}</span></span>
          </button>`;
        }).join("")}
      </div>
    </div>

    ${state.error ? errorBox(state.error, { retry: state.retry }) : ""}

    <div class="card sticky-bar">
      <span class="mono small">have ${counts.have} (+${counts.added} added) · not sure ${counts.notsure} · removed ${counts.remove}</span>
      <button class="btn" type="button" data-action="confirm" data-key="confirm" ${state.route ? "" : "disabled"}>${label}</button>
    </div>
  </section>`;
}

function skillChips(list, cls) {
  return list.map((s) => `<span class="chip ${cls}">${esc(skillName(s.skillId))}</span>`).join("");
}

function evidenceNotes(m) {
  if (!m.evidence?.length) return "";
  return `<div><button class="back" type="button" data-action="choose" data-role="${esc(m.roleId)}" ${state.pending ? "disabled" : ""}>View supporting sources in this route's roadmap</button></div>`;
}

function routeCard(m, { mine, closest, secondary }) {
  const role = roleById(m.roleId) ?? { roleId: m.roleId, name: m.roleId, skills: [] };
  const line = lineOf(role);
  const gapsBlock = mine
    ? `<div class="to-learn"><strong style="font-size:17px">Not confirmed for this route (${m.gaps.length})</strong>
        <span class="small muted">Learn these skills or confirm existing knowledge. Each listed skill counts once.</span>
        <div class="chips">${m.gaps.length ? skillChips(m.gaps, "gap") : `<span>${m.unconfirmedSkills.length ? "Some listed skills are still unconfirmed. Check them below." : "All listed skills are confirmed in your profile."}</span>`}</div></div>`
    : `<div class="stack" style="gap:8px"><strong style="font-size:15px">Not on your confirmed profile (${m.gaps.length})</strong>
        <div class="chips">${m.gaps.length ? skillChips(m.gaps, "gap") : `<span class="small muted">None</span>`}</div></div>`;
  const haveBlock = `<div class="stack" style="gap:8px"><strong style="font-size:15px">${mine ? "Already on your profile" : "Why it matches: skills you have"}</strong>
    <div class="chips">${m.strengths.length ? skillChips(m.strengths, "have") : `<span class="small muted">None yet</span>`}</div></div>`;
  const unsureBlock = m.unconfirmedSkills.length
    ? `<div class="stack" style="gap:8px"><strong style="font-size:15px">Not sure — no possession credit yet</strong><div class="chips">${skillChips(m.unconfirmedSkills, "unsure")}</div></div>`
    : "";
  return `<article class="card route-card">
    <div class="route-head">${lineBadge(role)}<h2>${esc(role.name)}</h2>
      ${mine ? `<span class="pill light">Your route</span>` : ""}${closest ? `<span class="pill light">Closest match to your CV</span>` : ""}
    </div>
    <div class="route-stripe ${line.cls}"></div>
    <div class="route-body">
      <div class="row" style="align-items:flex-end;gap:6px 16px"><span class="score">${esc(m.score)}</span><span class="small muted" style="padding-bottom:6px">/ 100 confirmed coverage · rank ${esc(m.rank)} of ${state.match.roles.length}</span></div>
      <p class="meaning">${esc(state.match.scoreMeaning)}</p>
      ${m.preferredRouteKept && state.match.roles.some(other => other.score > m.score) ? `<p>Another route scored higher, but this stays <strong>your</strong> route. You decide.</p>` : ""}
      <details><summary>How was this calculated?</summary><p class="mono small" style="margin-top:8px;color:var(--ink-2)">${esc(m.scoreExplanation)}</p></details>
      ${mine ? gapsBlock + haveBlock : haveBlock + gapsBlock}
      ${unsureBlock}
      ${evidenceNotes(m)}
      <div><button class="${secondary ? "btn2" : "btn"}" type="button" data-action="choose" data-role="${esc(m.roleId)}" data-key="choose-${esc(m.roleId)}" ${state.pending ? "disabled" : ""}>${mine ? `See my ${esc(role.name)} roadmap →` : secondary ? `See the ${esc(role.name)} roadmap` : `Choose the ${esc(role.name)} line →`}</button></div>
    </div>
  </article>`;
}

function renderResults() {
  const match = state.match;
  const hasRoute = state.profile.entryPath === "preferred-route";
  let body;
  if (hasRoute) {
    const mine = match.roles.find((m) => m.roleId === state.profile.preferredRouteId) ?? match.roles[0];
    const others = match.roles.filter((m) => m !== mine);
    body = `<div class="cards-one">
      ${routeCard(mine, { mine: true })}
      ${others.length ? `<button class="btn2" type="button" data-action="toggle-compare" data-key="toggle-compare" aria-expanded="${state.compareOpen}" style="justify-self:start">${state.compareOpen ? "Hide the comparison" : `Compare with ${others.map((o) => esc((roleById(o.roleId) || { name: o.roleId }).name)).join(", ")}`}</button>` : ""}
      ${state.compareOpen ? others.map((o) => routeCard(o, { secondary: true })).join("") : ""}
    </div>`;
  } else {
    body = `<div class="cards-two">${match.roles.map((m) => routeCard(m, { closest: m.rank === 1 })).join("")}</div>`;
  }
  const mineName = hasRoute ? (roleById(state.profile.preferredRouteId) || { name: "" }).name : "";
  return `<section class="stack-lg">
    <div><button class="back" type="button" data-action="go" data-screen="review" data-key="back-review"><span class="ar">←</span> Edit profile or change route</button></div>
    ${match.isPlaceholder ? placeholderBanner() : ""}
    <h1 id="screen-title" tabindex="-1">${hasRoute ? `Your route: ${esc(mineName)}` : "Routes that match your CV"}</h1>
    <p class="lead">${hasRoute
      ? "Here is what is not on your profile yet for this route, and how much of its skill list you already cover."
      : "We compared your confirmed skills with each line's skill list. The closest match is first, but it is only a suggestion: you choose the route."}</p>
    ${state.error ? errorBox(state.error, { retry: state.retry }) : ""}
    ${trendPanel()}
    ${body}
    ${guidancePanel()}
  </section>`;
}

// ----- roadmap -----

function stationsForRoadmap() {
  const role = roleById(state.chosen);
  const other = ref.roles.roles.find((r) => r.roleId !== state.chosen) ?? null;
  return { role, other, stations: buildStations(role, other, state.profile, state.pathway, ref.catalogue) };
}

function stopMeta(s) {
  const kind = s.isPrerequisite ? s.countsForCoverage ? "prerequisite and listed skill" : "prerequisite" : "listed skill";
  return `stop ${s.order} · ${kind} · ${estimateText(s.hours, s.estimateBasis)}${s.notSure ? " · Not sure" : s.possessionState === "not-yet" ? " · Not yet" : ""}`;
}

function mapView(stations, role, other) {
  const colW = 100 / cols;
  const otherLetter = other ? lineOf(other).letter : "";
  return `<div class="snake line-${lineOf(role).cls}" aria-label="Roadmap map. Use the list view for a text version.">
    ${snakeRows(stations, cols).map((r) => `<div class="srow"><div class="sinner">
      <div class="sbar" style="left:${r.l}%;right:${r.r}%"></div>
      ${r.turnRight ? `<div class="turn turn-r"></div>` : ""}${r.turnLeft ? `<div class="turn turn-l"></div>` : ""}
      <div class="scells${r.leftToRight ? "" : " rev"}">
        ${r.cells.map((s) => {
          const dot = s.kind === "term" ? "term" : s.kind === "here" ? "here" : s.kind === "passed" ? "have" : s.notSure ? "unsure" : "todo";
          const tag = s.zone ? `<span class="stag">${esc(s.zone)}</span>` : "";
          const xchg = s.interchange ? `<span class="smeta strong">⇄ also on the ${esc(otherLetter)} line</span>` : "";
          const inner = `<span class="sdot ${dot}" aria-hidden="true"></span><span class="sname">${esc(s.name)}</span>`;
          if (s.kind === "term" || s.kind === "here") {
            return `<div class="scell" style="width:${colW}%">${tag}<div class="sbtn static">${inner}${s.meta ? `<span class="smeta">${esc(s.meta)}</span>` : ""}</div></div>`;
          }
          const meta = s.kind === "passed" ? "on your profile" : stopMeta(s);
          return `<div class="scell" style="width:${colW}%">${tag}<button type="button" class="sbtn" data-action="open" data-skill="${esc(s.skillId)}" data-key="open-${esc(s.skillId)}">${inner}<span class="smeta">${esc(meta)}</span>${xchg}</button></div>`;
        }).join("")}
      </div>
    </div></div>`).join("")}
  </div>`;
}

function firstResource(step) {
  const r = step && step.resources[0];
  if (!r) return `<span class="small muted">No resource listed yet.</span>`;
  return `<span class="small">${esc(r.title)} · ${esc(r.provider)} · ${esc(COST_LABEL[r.cost] ?? r.cost)}${r.isPlaceholder ? ` <span class="pill ph">placeholder</span>` : ""}</span>`;
}

function listView(stations, role, other) {
  const steps = new Map(state.pathway.steps.map((s) => [s.skillId, s]));
  const rows = [];
  for (const s of stations) {
    if (s.zone) rows.push({ zone: s.zone });
    rows.push(s);
  }
  return `<div class="metro line-${lineOf(role).cls}">
    ${rows.map((s, i) => {
      const edge = `${i === 0 ? " first" : ""}${i === rows.length - 1 ? " last" : ""}`;
      if (s.zone && !s.kind) return `<div class="st-row${edge}"><div class="st-rail"></div><div class="st-body"><div class="zone">${esc(s.zone)}</div></div></div>`;
      let dot = "", body = "";
      if (s.kind === "term") {
        dot = "term";
        body = `<div style="padding-top:10px" class="stack" ><strong style="font-family:var(--font-head);font-size:22px">${esc(s.name)}</strong><span class="small muted">${esc(s.meta)}</span></div>`;
      } else if (s.kind === "here") {
        dot = "here";
        body = `<div style="padding-top:8px"><span class="pill dark" style="font-size:14px;padding:6px 12px">You are here</span></div>`;
      } else if (s.kind === "passed") {
        dot = "have";
        body = `<button type="button" class="passed" data-action="open" data-skill="${esc(s.skillId)}" data-key="open-${esc(s.skillId)}"><strong>${esc(s.name)}</strong><span class="small muted">on your profile</span>${s.interchange && other ? `<span class="xchg">${lineBadge(other, "xs")}also on the ${esc(other.name)} line</span>` : ""}</button>`;
      } else {
        const step = steps.get(s.skillId);
        dot = s.notSure ? "unsure" : "todo";
        body = `<button type="button" class="stop" data-action="open" data-skill="${esc(s.skillId)}" data-key="open-${esc(s.skillId)}">
          <span class="row" style="gap:8px"><span class="mono small muted">STOP ${esc(s.order)}</span><span class="name">${esc(s.name)}</span><span class="pill">${s.isPrerequisite ? "prerequisite" : "listed skill"}</span>${s.notSure ? `<span class="chip unsure" style="font-size:12px;padding:2px 8px">Not sure</span>` : ""}<span class="mono small" style="margin-left:auto">${esc(estimateText(s.hours, s.estimateBasis))}</span></span>
          ${s.interchange && other ? `<span class="xchg">${lineBadge(other, "xs")}Interchange: also counts on the ${esc(other.name)} line</span>` : ""}
          <span style="color:var(--ink-2)">${esc(step ? step.why : "")}</span>
          ${firstResource(step)}
          <span class="small" style="color:var(--line-b);font-weight:600">Details →</span>
        </button>`;
      }
      return `<div class="st-row${edge}"><div class="st-rail"><span class="dot ${dot}" aria-hidden="true"></span></div><div class="st-body">${body}</div></div>`;
    }).join("")}
  </div>`;
}

function sdgPanel(role, skillIds) {
  let inner;
  if (!ref.sdg) {
    inner = `<p class="small muted">${ref.sdgFailed ? "We couldn't load the SDG links right now." : "No SDG links loaded."}</p>`;
  } else {
    const goals = new Map(ref.sdg.goals.map((g) => [g.sdgId, g]));
    const tags = [
      ...ref.sdg.roleTags.filter((t) => t.roleId === role.roleId).map((t) => ({ ...t, about: role.name })),
      ...ref.sdg.skillTags.filter((t) => skillIds.has(t.skillId)).map((t) => ({ ...t, about: skillName(t.skillId) })),
    ];
    inner = tags.length
      ? tags.map((t) => {
          const g = goals.get(t.sdgId);
          return `<div class="row" style="align-items:flex-start;gap:12px;flex-wrap:nowrap">
            <span class="sdg-num" aria-hidden="true">${esc(g ? g.number : "?")}</span>
            <div class="stack small" style="gap:2px"><strong>SDG ${esc(g ? `${g.number}: ${g.name}` : t.sdgId)}</strong><span class="muted">About: ${esc(t.about)}</span><span style="color:var(--ink-2)">${esc(t.rationale)}</span>${t.isPlaceholder ? `<span class="pill ph" style="align-self:flex-start;margin-top:4px">placeholder reason</span>` : ""}</div>
          </div>`;
        }).join("")
      : `<p class="small muted">No SDG links for this route yet.</p>`;
  }
  return `<div class="card pad stack" style="gap:14px"><h2 style="font-size:22px">How this route connects to the SDGs</h2>${inner}</div>`;
}

function evidenceItem(item) {
  const title = isSafeUrl(item.url) ? `<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a>` : esc(item.title);
  return `<li class="res"><strong>${title}</strong>
    <span class="small muted">${esc(item.publisher)} · ${esc(formatEvidenceDate(item))} · checked ${esc(item.checkedAt ?? "time not recorded")}</span>
    <span class="small"><strong>Supports:</strong> ${esc(item.supportedClaim)}</span>
    <span class="small"><strong>Limits:</strong> ${esc(item.limitation)}</span></li>`;
}

function evidencePanel(skillIds) {
  let inner;
  if (!ref.evidence) {
    inner = `<p class="small muted">${ref.evidenceFailed ? "We couldn't load trend evidence right now." : "No trend evidence loaded."}</p>`;
  } else {
    const items = ref.evidence.items.filter((i) => i.linkedSkillIds.some((id) => skillIds.has(id)));
    inner = items.length
      ? `<ul class="res-list">${items.map(evidenceItem).join("")}</ul>`
      : `<p class="small" style="color:var(--ink-2)">No trend evidence is listed for this selection. Available sources show publisher dates, actual check times, supported claims and limits.</p>`;
  }
  return `<div class="card pad stack" style="gap:10px"><h2 style="font-size:22px">Sources and trend evidence</h2>${inner}</div>`;
}

function drawer(role, other) {
  const id = state.open;
  const detail = stationDetails(role, state.pathway, ref.catalogue, id);
  if (!detail) return "";
  const { step } = detail;
  const notSure = state.profile.unconfirmedSkillIds.includes(id);
  const status = step
    ? `STOP ${step.order} · ${step.isPrerequisite ? "PREREQUISITE" : "LISTED SKILL"}${notSure ? " · NOT SURE" : ""}`
    : "ON YOUR PROFILE";
  const why = step ? step.why : `${detail.name} is listed for ${role.name} and confirmed in your profile. It counts once towards this role's coverage.`;
  const resources = step ? step.resources : [];
  const evidenceById = new Map((ref.evidence ? ref.evidence.items : []).map((i) => [i.id, i]));
  const refs = step && step.evidence ? step.evidence : [];
  const sdgTags = ref.sdg ? ref.sdg.skillTags.filter((t) => t.skillId === id) : [];
  const goals = ref.sdg ? new Map(ref.sdg.goals.map((g) => [g.sdgId, g])) : new Map();
  const onOther = other && other.skills.some((s) => s.skillId === id);

  return `<button class="scrim" type="button" data-action="close" aria-label="Close details" tabindex="-1"></button>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
    <div class="drawer-head">
      <div class="row" style="flex-wrap:nowrap;gap:12px">${lineBadge(role)}
        <div class="stack" style="gap:2px"><span class="mono small" style="opacity:.85">${esc(status)}</span><h2 id="drawer-title">${esc(detail.name)}</h2></div>
      </div>
      <button class="back" type="button" data-action="close" data-key="drawer-close" style="min-height:40px;padding:0 14px">✕ Close</button>
    </div>
    <div class="route-stripe ${lineOf(role).cls}" style="margin-top:-18px"></div>
    <div class="drawer-body">
      <div><h3>Why it's on your list</h3><p style="font-size:15px">${esc(why)}</p></div>
      ${!detail.countsForCoverage ? `<p class="notice info small">This prerequisite does not add another skill to this role's coverage.</p>` : ""}
      ${skillControls(id, role.roleId, { showWhy: false })}
      ${onOther ? `<p class="xchg" style="font-size:14px">${lineBadge(other, "xs")}Interchange: this skill is also on the ${esc(other.name)} line.</p>` : ""}
      ${step ? `<div><h3>Where to start</h3>
        <p class="mono small" style="margin-bottom:8px">${esc(estimateText(step.estimatedHours, step.estimateBasis))}${step.estimateNote ? ` · ${esc(step.estimateNote)}` : ""}</p>
        ${resources.length ? `<ul class="res-list">${resources.map((r) => {
          const fake = r.isPlaceholder || isSampleUrl(r.url) || !isSafeUrl(r.url);
          const title = fake ? `<strong>${esc(r.title)}</strong>` : `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(r.title)}</strong></a>`;
          return `<li class="res">${title}<span class="small">${esc(r.provider)} · ${esc(COST_LABEL[r.cost] ?? r.cost)}</span><span class="small muted">${esc(r.sourceNote)}</span>${r.estimateBasis ? `<span class="small">${r.estimateBasis === "app" ? "App-estimated" : "Provider-estimated"} practice time${r.estimateNote ? ` · ${esc(r.estimateNote)}` : ""}</span>` : ""}${r.checkedAt ? `<span class="small muted">Resource checked ${esc(r.checkedAt)}</span>` : ""}${fake ? `<span class="pill ph" style="align-self:flex-start">placeholder: not a real course</span>` : ""}</li>`;
        }).join("")}</ul>` : `<p class="small muted">No resource listed yet.</p>`}
      </div>
      <div><h3>Learn first</h3><p class="small" style="color:var(--ink-2)">${step.prerequisites.length ? esc(step.prerequisites.map(skillName).join(", ")) : "No prerequisites are listed for this step."}</p></div>` : ""}
      <div><h3>Trend evidence</h3>
        ${refs.length ? `<ul class="res-list">${refs.map((r) => evidenceById.has(r.evidenceId) ? evidenceItem(evidenceById.get(r.evidenceId)) : `<li class="res small">Source details unavailable (${esc(r.evidenceId)}).</li>`).join("")}</ul>` : `<p class="small muted">No trend evidence is listed for this skill.</p>`}
      </div>
      ${sdgTags.length ? `<div><h3>SDG links</h3>${sdgTags.map((t) => {
        const g = goals.get(t.sdgId);
        return `<p class="small" style="margin-bottom:6px"><strong>SDG ${esc(g ? `${g.number}: ${g.name}` : t.sdgId)}</strong> · ${esc(t.rationale)} ${t.isPlaceholder ? `<span class="pill ph">placeholder</span>` : ""}</p>`;
      }).join("")}</div>` : ""}
    </div>
  </aside>`;
}

function renderRoadmap() {
  const { role, other, stations } = stationsForRoadmap();
  const toLearn = stations.filter((s) => s.kind === "stop");
  const known = toLearn.filter((s) => s.hours != null);
  const totalHours = known.reduce((a, s) => a + s.hours, 0);
  const confirmed = new Set(state.profile.confirmedSkills.map(skill => skill.skillId));
  const summary = toLearn.length === 0
    ? role.skills.every(skill => confirmed.has(skill.skillId)) ? "All listed skills are confirmed in your profile." : "Some listed skills remain unconfirmed; learning guidance is unavailable."
    : `${toLearn.length} learning step(s), with prerequisites before dependent skills.${known.length ? ` The displayed practice estimates total about ${totalHours} h${known.length < toLearn.length ? " for the steps with an estimate" : ""}.` : ""}`;
  const skillIds = new Set([...role.skills.map((s) => s.skillId), ...state.pathway.steps.map(step => step.skillId)]);
  const map = state.view === "map";
  const tab = (value, label) => `<button type="button" class="seg${state.view === value ? " on" : ""}" aria-pressed="${state.view === value}" data-action="view" data-value="${value}" data-key="view-${value}">${label}</button>`;

  return `<section class="stack-lg">
    <div class="row"><button class="back" type="button" data-action="go" data-screen="results" data-key="back-results"><span class="ar">←</span> Back to results</button><button class="back" type="button" data-action="go" data-screen="review" data-key="back-review2"><span class="ar">←</span> Edit profile or change route</button></div>
    ${state.pathway.isPlaceholder ? placeholderBanner() : ""}
    <div class="row" style="gap:14px">${lineBadge(role, "xl")}
      <div class="stack" style="gap:2px"><span class="small muted" style="font-weight:600;letter-spacing:.1em;text-transform:uppercase">Your roadmap</span><h1 id="screen-title" tabindex="-1">${esc(role.name)} line</h1></div>
    </div>
    <p class="lead">${esc(summary)} Click any station for why it's on your list and where to start.</p>
    ${state.error ? errorBox(state.error, { retry: state.retry }) : ""}
    ${trendPanel()}
    <div class="card" style="padding:10px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 20px;font-size:14px">
      <strong>Key</strong>
      <span class="row" style="gap:8px"><span class="dot have inline" aria-hidden="true"></span>on your profile</span>
      <span class="row" style="gap:8px"><span class="dot todo inline" aria-hidden="true"></span>to learn</span>
      <span class="row" style="gap:8px"><span class="dot unsure inline" aria-hidden="true"></span>not sure: check if you know it</span>
      ${other ? `<span class="row" style="gap:8px"><span class="lb x xs" aria-hidden="true">⇄</span>interchange: on both lines</span>` : ""}
    </div>
    <div class="seg-group" role="group" aria-label="Roadmap view">${tab("map", "Map view")}${tab("list", "List with details")}</div>
    ${map ? mapView(stations, role, other) : listView(stations, role, other)}
    <p class="small muted">Steps follow the saved pathway's prerequisite order. Prerequisites outside the role's listed skills do not add coverage criteria. Time estimates are labelled by their app or provider basis.</p>
    ${guidancePanel(role.roleId)}
    <div class="grid-2">${sdgPanel(role, skillIds)}${evidencePanel(skillIds)}</div>
    ${state.open ? drawer(role, other) : ""}
  </section>`;
}

// ---------- render ----------

function render(screenChanged = false) {
  const focusedKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
  let html;
  switch (state.screen) {
    case "upload": html = renderUpload(); break;
    case "review": html = renderReview(); break;
    case "results": html = renderResults(); break;
    case "roadmap": html = renderRoadmap(); break;
    default: html = renderLoading();
  }
  appEl.innerHTML = html;
  stepperEl.innerHTML = renderStepper();
  document.body.style.overflow = state.open ? "hidden" : "";

  if (state.open) {
    const close = appEl.querySelector('[data-key="drawer-close"]');
    if (close && focusedKey !== "drawer-close") close.focus();
  } else if (screenChanged) {
    window.scrollTo(0, 0);
    const title = document.getElementById("screen-title");
    if (title) title.focus({ preventScroll: true });
    announce(title ? title.textContent : LOADING[state.screen] ?? "");
  } else if (focusedKey) {
    const el = document.querySelector(`[data-key="${CSS.escape(focusedKey)}"]`);
    if (el) el.focus({ preventScroll: true });
  }
}

// ---------- events ----------

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const action = actions[el.dataset.action];
  if (action) action(el);
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "cv-input") setFile(t.files && t.files[0]);
  if (t.dataset && t.dataset.level) profileChanged({ levels: { ...state.levels, [t.dataset.level]: t.value } });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.open) closeDrawer();
});

// Drag and drop onto the upload box.
document.addEventListener("dragover", (e) => {
  const zone = e.target.closest && e.target.closest("[data-drop]");
  if (!zone) return;
  e.preventDefault();
  zone.classList.add("is-over");
});
document.addEventListener("dragleave", (e) => {
  const zone = e.target.closest && e.target.closest("[data-drop]");
  if (zone) zone.classList.remove("is-over");
});
document.addEventListener("drop", (e) => {
  const zone = e.target.closest && e.target.closest("[data-drop]");
  if (!zone) return;
  e.preventDefault();
  setFile(e.dataTransfer.files && e.dataTransfer.files[0]);
});

window.addEventListener("resize", () => {
  const next = columnsFor(window.innerWidth);
  if (next !== cols) {
    cols = next;
    if (state.screen === "roadmap" && state.view === "map") render();
  }
});

// ---------- start ----------

render();
// Load route names early for the upload page; extraction loads them again if this fails.
const startupRequest = requestId;
loadRoles().then(references => {
  if (startupRequest !== requestId || state.screen !== "upload") return;
  Object.assign(ref, references);
  render();
}, () => {});
