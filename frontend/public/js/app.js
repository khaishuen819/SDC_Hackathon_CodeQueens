// Code Queens frontend (M1). Screens: Upload CV -> Check profile -> Results -> Roadmap.
// Design: frontend/DESIGN.md. API: src/server/contracts/ (M2).
// Rendering: each screen is an HTML string; ALL text from the API or the CV goes through esc().

import { api, ApiError, ERROR_HINTS } from "./api.js";
import { checkFile, skillCatalogue, reviewModel, buildConfirmedProfile } from "./profile.js";
import { lineOf, buildStations, snakeRows, columnsFor } from "./roadmap.js";

const STEPS = [
  ["upload", "Upload CV"],
  ["review", "Check profile"],
  ["results", "Results"],
  ["roadmap", "Roadmap"],
];
const STEP_OF = { upload: 1, reading: 1, review: 2, matching: 3, results: 3, building: 4, roadmap: 4 };
const LOADING = { reading: "Reading your CV…", matching: "Matching your profile…", building: "Drawing your line…" };
const WEIGHT_LABEL = { 1: "nice to have", 2: "important", 3: "core" };
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
    match: null,
    compareOpen: false,
    chosen: null,
    pathway: null,
    open: null, // skillId shown in the details panel
    view: "map",
  };
}

// Reference data survives "Start over".
const ref = { roles: null, catalogue: null, sdg: null, sdgFailed: false, evidence: null, evidenceFailed: false };
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
const isSampleUrl = (url) => /^https?:\/\/(www\.)?example\.(com|org|net)\//i.test(url);
const weightLabel = (w) => WEIGHT_LABEL[w] ?? `weight ${w}`;
const hoursText = (h) => (h == null ? "time not known yet" : `~${h} h`);

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
  return `<div class="notice ph" role="note"><span class="icon" aria-hidden="true">!</span><span><strong>Sample data.</strong> Roles, weights, resources and SDG reasons are placeholder content that has not been reviewed yet. Scores and hours are for illustration only.</span></div>`;
}

function announce(text) {
  liveEl.textContent = "";
  setTimeout(() => { liveEl.textContent = text; }, 50);
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
  update({ ...patch, screen, maxStep, open: null, error: patch.error ?? null });
}

// Any change on the profile makes old results out of date: clear them.
function profileChanged(patch) {
  update({ ...patch, match: null, pathway: null, chosen: null, maxStep: Math.min(state.maxStep, 2), error: null });
}

// ---------- actions ----------

async function loadRoles() {
  if (ref.roles) return;
  const roles = await api.roles();
  ref.roles = roles;
  ref.catalogue = skillCatalogue(roles);
}

function setFile(file) {
  if (!file) return;
  const code = checkFile(file);
  const uploadError = code ? new ApiError(code, code === "FILE_TOO_LARGE" ? "This file is over 2 MB." : "This file type isn't supported.") : null;
  update({ file: code ? null : file, uploadError });
}

async function useSample(name) {
  try {
    const res = await fetch(`samples/${encodeURIComponent(name)}`);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    setFile(new File([blob], name, { type: "text/plain" }));
  } catch {
    update({ uploadError: new ApiError("NETWORK", "We couldn't load the sample CV.") });
  }
}

async function readCv() {
  if (!state.file) return;
  const id = ++requestId;
  goTo("reading", { uploadError: null });
  try {
    const [draft] = await Promise.all([api.extract(state.file), loadRoles()]);
    if (id !== requestId) return;
    const review = reviewModel(draft, ref.catalogue);
    goTo("review", {
      draft,
      review: { found: review.found, unknown: review.unknown, others: review.others },
      choices: review.choices,
      levels: {},
      route: null,
      profile: null,
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
  if (!state.route) return;
  const profile = buildConfirmedProfile({
    choices: state.choices,
    levels: state.levels,
    foundIds: state.review.found.map((f) => f.skillId),
    route: state.route,
  });
  const id = ++requestId;
  goTo("matching");
  try {
    const match = await api.match(profile);
    if (id !== requestId) return;
    goTo("results", { profile, match, compareOpen: false, pathway: null, chosen: null });
  } catch (err) {
    if (id !== requestId) return;
    update({ screen: "review", error: asApiError(err), retry: "confirm" });
  }
}

async function chooseRoute(roleId) {
  const id = ++requestId;
  goTo("building", { chosen: roleId });
  // SDG and evidence are optional: a failure only empties their panel.
  const sdg = ref.sdg ? Promise.resolve(ref.sdg) : api.sdg().then((r) => { ref.sdg = r; ref.sdgFailed = false; }, () => { ref.sdgFailed = true; });
  const evidence = ref.evidence ? Promise.resolve(ref.evidence) : api.evidence().then((r) => { ref.evidence = r; ref.evidenceFailed = false; }, () => { ref.evidenceFailed = true; });
  try {
    const [pathway] = await Promise.all([api.pathway(state.profile, roleId), sdg, evidence]);
    if (id !== requestId) return;
    goTo("roadmap", { pathway, view: state.view });
  } catch (err) {
    if (id !== requestId) return;
    update({ screen: "results", error: asApiError(err), retry: "choose-again" });
  }
}

function restart() {
  if (state.draft && !window.confirm("Start over? Your checked profile and results will be cleared.")) return;
  requestId++;
  state = freshState();
  render(true);
}

const actions = {
  restart,
  step: (el) => {
    const target = el.dataset.screen;
    if (STEP_OF[target] <= state.maxStep) goTo(target);
  },
  go: (el) => goTo(el.dataset.screen),
  sample: (el) => useSample(el.dataset.file),
  "clear-file": () => update({ file: null, uploadError: null }),
  read: readCv,
  choice: (el) => profileChanged({ choices: { ...state.choices, [el.dataset.skill]: el.dataset.value } }),
  route: (el) => profileChanged({ route: el.dataset.value }),
  confirm: confirmProfile,
  "toggle-compare": () => update({ compareOpen: !state.compareOpen }),
  choose: (el) => chooseRoute(el.dataset.role),
  "choose-again": () => chooseRoute(state.chosen),
  view: (el) => update({ view: el.dataset.value }),
  open: (el) => update({ open: el.dataset.skill }),
  close: closeDrawer,
};

function closeDrawer() {
  const skill = state.open;
  update({ open: null });
  const back = skill && appEl.querySelector(`[data-key="open-${CSS.escape(skill)}"]`);
  if (back) back.focus();
}

// ---------- screens ----------

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
      <p class="lead">Fix anything wrong before we match. AI can miss skills, so add any we didn't find. Skills you mark "not sure" are not counted as zero.</p>
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
      <h2 style="font-size:24px;margin:14px 0 2px">Other skills on these lines</h2>
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

function skillChips(list, cls, withWeight) {
  return list.map((s) => `<span class="chip ${cls}">${esc(skillName(s.skillId))}${withWeight ? ` · ${esc(weightLabel(s.weight))}` : ""}</span>`).join("");
}

function evidenceNotes(m) {
  const all = [...m.strengths, ...m.gaps, ...m.unconfirmedSkills].filter((s) => s.evidenceAdjustments && s.evidenceAdjustments.length);
  if (!all.length) return "";
  return `<div class="small" style="color:var(--ink-2)"><strong>Trend evidence:</strong> ${all.map((s) => `${esc(skillName(s.skillId))} weight ${esc(s.baseWeight)} → ${esc(s.weight)} (${s.evidenceAdjustments.map((a) => esc(a.evidenceId)).join(", ")})`).join("; ")}</div>`;
}

function routeCard(m, { mine, closest, secondary }) {
  const role = roleById(m.roleId) ?? { roleId: m.roleId, name: m.roleId, skills: [] };
  const line = lineOf(role);
  const gapsBlock = mine
    ? `<div class="to-learn"><strong style="font-size:17px">To learn for this route (${m.gaps.length})</strong>
        <span class="small muted">Not on your confirmed profile yet. These become your next stations.</span>
        <div class="chips">${m.gaps.length ? skillChips(m.gaps, "gap", true) : `<span>Nothing: you have every skill on this line!</span>`}</div></div>`
    : `<div class="stack" style="gap:8px"><strong style="font-size:15px">Not on your confirmed profile (${m.gaps.length})</strong>
        <div class="chips">${m.gaps.length ? skillChips(m.gaps, "gap", true) : `<span class="small muted">None</span>`}</div></div>`;
  const haveBlock = `<div class="stack" style="gap:8px"><strong style="font-size:15px">${mine ? "Already on your profile" : "Why it matches: skills you have"}</strong>
    <div class="chips">${m.strengths.length ? skillChips(m.strengths, "have", true) : `<span class="small muted">None yet</span>`}</div></div>`;
  const unsureBlock = m.unconfirmedSkills.length
    ? `<div class="stack" style="gap:8px"><strong style="font-size:15px">Not sure (not counted, not a gap)</strong><div class="chips">${skillChips(m.unconfirmedSkills, "unsure", false)}</div></div>`
    : "";
  return `<article class="card route-card">
    <div class="route-head">${lineBadge(role)}<h2>${esc(role.name)}</h2>
      ${mine ? `<span class="pill light">Your route</span>` : ""}${closest ? `<span class="pill light">Closest match to your CV</span>` : ""}
    </div>
    <div class="route-stripe ${line.cls}"></div>
    <div class="route-body">
      <div class="row" style="align-items:flex-end;gap:6px 16px"><span class="score">${esc(m.score)}</span><span class="small muted" style="padding-bottom:6px">/ 100 skill coverage · rank ${esc(m.rank)} of ${state.match.roles.length}</span></div>
      <p class="meaning">${esc(state.match.scoreMeaning)}</p>
      ${m.preferredRouteKept && m.rank > 1 ? `<p>Another route scored higher, but this stays <strong>your</strong> route. You decide.</p>` : ""}
      <details><summary>How was this calculated?</summary><p class="mono small" style="margin-top:8px;color:var(--ink-2)">${esc(m.scoreExplanation)}</p></details>
      ${mine ? gapsBlock + haveBlock : haveBlock + gapsBlock}
      ${unsureBlock}
      ${evidenceNotes(m)}
      <div><button class="${secondary ? "btn2" : "btn"}" type="button" data-action="choose" data-role="${esc(m.roleId)}" data-key="choose-${esc(m.roleId)}">${mine ? `See my ${esc(role.name)} roadmap →` : secondary ? `See the ${esc(role.name)} roadmap` : `Choose the ${esc(role.name)} line →`}</button></div>
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
    ${body}
  </section>`;
}

// ----- roadmap -----

function stationsForRoadmap() {
  const role = roleById(state.chosen);
  const other = ref.roles.roles.find((r) => r.roleId !== state.chosen) ?? null;
  return { role, other, stations: buildStations(role, other, state.profile, state.pathway) };
}

function stopMeta(s) {
  return `stop ${s.order} · ${s.required ? "required" : "optional"} · ${hoursText(s.hours)}${s.notSure ? " · not sure: check if you know it" : ""}`;
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
          const dot = s.kind === "term" ? "term" : s.kind === "here" ? "here" : s.kind === "passed" ? "have" : s.notSure ? "unsure" : s.required ? "todo big" : "todo";
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
        body = `<button type="button" class="stop${s.required ? " req" : ""}" data-action="open" data-skill="${esc(s.skillId)}" data-key="open-${esc(s.skillId)}">
          <span class="row" style="gap:8px"><span class="mono small muted">STOP ${esc(s.order)}</span><span class="name">${esc(s.name)}</span><span class="pill">${s.required ? "required" : "optional"}</span>${s.notSure ? `<span class="chip unsure" style="font-size:12px;padding:2px 8px">not sure: check if you know it</span>` : ""}<span class="mono small" style="margin-left:auto">${esc(hoursText(s.hours))}</span></span>
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
    <span class="small muted">${esc(item.publisher)} · published ${esc(item.publishedDate)} · checked ${esc(item.retrievedAt)}</span>
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
      : `<p class="small" style="color:var(--ink-2)">No reviewed trend evidence for this route yet. Each source will show its title, publisher, published date, date checked, the claim it supports and its limits.</p>`;
  }
  return `<div class="card pad stack" style="gap:10px"><h2 style="font-size:22px">Sources and trend evidence</h2>${inner}</div>`;
}

function drawer(role, other) {
  const id = state.open;
  const info = role.skills.find((s) => s.skillId === id);
  if (!info) return "";
  const step = state.pathway.steps.find((s) => s.skillId === id);
  const notSure = state.profile.unconfirmedSkillIds.includes(id);
  const status = step
    ? `STOP ${step.order} · ${info.isRequired ? "REQUIRED" : "OPTIONAL"}${notSure ? " · NOT SURE: CHECK IF YOU KNOW IT" : ""}`
    : "ON YOUR PROFILE";
  const why = step ? step.why : `${info.name} is ${info.isRequired ? "required" : "optional"} for ${role.name} (${weightLabel(info.weight)}). It is already on your confirmed profile, so it is a station you have passed.`;
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
        <div class="stack" style="gap:2px"><span class="mono small" style="opacity:.85">${esc(status)}</span><h2 id="drawer-title">${esc(info.name)}</h2></div>
      </div>
      <button class="back" type="button" data-action="close" data-key="drawer-close" style="min-height:40px;padding:0 14px">✕ Close</button>
    </div>
    <div class="route-stripe ${lineOf(role).cls}" style="margin-top:-18px"></div>
    <div class="drawer-body">
      <div><h3>Why it's on your list</h3><p style="font-size:15px">${esc(why)}</p></div>
      ${onOther ? `<p class="xchg" style="font-size:14px">${lineBadge(other, "xs")}Interchange: this skill is also on the ${esc(other.name)} line.</p>` : ""}
      ${step ? `<div><h3>Where to start</h3>
        <p class="mono small" style="margin-bottom:8px">Estimated time: ${esc(hoursText(step.estimatedHours))}</p>
        ${resources.length ? `<ul class="res-list">${resources.map((r) => {
          const fake = r.isPlaceholder || isSampleUrl(r.url) || !isSafeUrl(r.url);
          const title = fake ? `<strong>${esc(r.title)}</strong>` : `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(r.title)}</strong></a>`;
          return `<li class="res">${title}<span class="small">${esc(r.provider)} · ${esc(COST_LABEL[r.cost] ?? r.cost)}</span><span class="small muted">${esc(r.sourceNote)}</span>${fake ? `<span class="pill ph" style="align-self:flex-start">placeholder: not a real course</span>` : ""}</li>`;
        }).join("")}</ul>` : `<p class="small muted">No resource listed yet.</p>`}
      </div>
      <div><h3>Learn first</h3><p class="small" style="color:var(--ink-2)">${step.prerequisites.length ? esc(step.prerequisites.map(skillName).join(", ")) : "Prerequisite information is not available yet."}</p></div>` : ""}
      <div><h3>Trend evidence</h3>
        ${refs.length ? `<ul class="res-list">${refs.map((r) => evidenceById.has(r.evidenceId) ? evidenceItem(evidenceById.get(r.evidenceId)) : `<li class="res small">${esc(r.evidenceId)}</li>`).join("")}</ul>` : `<p class="small muted">No reviewed trend evidence for this skill yet.</p>`}
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
  const summary = toLearn.length === 0
    ? "You already have every skill on this line. Nice!"
    : `${toLearn.length} station(s) to go, top to bottom.${known.length ? ` About ${totalHours} h in total${known.length < toLearn.length ? " for the stations with a time estimate" : ""}.` : ""}`;
  const skillIds = new Set(role.skills.map((s) => s.skillId));
  const map = state.view === "map";
  const tab = (value, label) => `<button type="button" class="seg${state.view === value ? " on" : ""}" aria-pressed="${state.view === value}" data-action="view" data-value="${value}" data-key="view-${value}">${label}</button>`;

  return `<section class="stack-lg">
    <div class="row"><button class="back" type="button" data-action="go" data-screen="results" data-key="back-results"><span class="ar">←</span> Back to results</button><button class="back" type="button" data-action="go" data-screen="review" data-key="back-review2"><span class="ar">←</span> Edit profile or change route</button></div>
    ${state.pathway.isPlaceholder ? placeholderBanner() : ""}
    <div class="row" style="gap:14px">${lineBadge(role, "xl")}
      <div class="stack" style="gap:2px"><span class="small muted" style="font-weight:600;letter-spacing:.1em;text-transform:uppercase">Your roadmap</span><h1 id="screen-title" tabindex="-1">${esc(role.name)} line</h1></div>
    </div>
    <p class="lead">${esc(summary)} Click any station for why it's on your list and where to start.</p>
    <div class="card" style="padding:10px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 20px;font-size:14px">
      <strong>Key</strong>
      <span class="row" style="gap:8px"><span class="dot have inline" aria-hidden="true"></span>on your profile</span>
      <span class="row" style="gap:8px"><span class="dot todo inline" aria-hidden="true"></span>to learn</span>
      <span class="row" style="gap:8px"><span class="dot unsure inline" aria-hidden="true"></span>not sure: check if you know it</span>
      ${other ? `<span class="row" style="gap:8px"><span class="lb x xs" aria-hidden="true">⇄</span>interchange: on both lines</span>` : ""}
    </div>
    <div class="seg-group" role="group" aria-label="Roadmap view">${tab("map", "Map view")}${tab("list", "List with details")}</div>
    ${map ? mapView(stations, role, other) : listView(stations, role, other)}
    <p class="small muted">Prerequisites between skills are not available yet, so stations are ordered required first, then by weight.</p>
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
loadRoles().then(() => { if (state.screen === "upload") render(); }, () => {});
