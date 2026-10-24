// Local fictional API composition for Phase 6 verification; never production startup.
import express from "express";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCriteriaApiRouter } from "../../src/server/routes/criteriaApi.ts";
import { ApiFailure } from "../../src/server/routes/errors.ts";
import { MemoryCriteriaStore } from "../../src/server/trends/snapshotStore.ts";
import { bundle, context, NOW } from "../../src/server/trends/testFixtures.ts";

const SCENARIOS = ["coverage", "historical", "prerequisite", "empty"];
const PUBLIC_DIR = fileURLToPath(new URL("../public/", import.meta.url));

function fictionalBundle(scenario) {
  const data = bundle(scenario === "coverage" ? 2 : 3);
  const names = ["API basics", "AI-assisted test design (fictional)", "Test-case foundations (fictional)"];
  data.capabilities.forEach((skill, index) => { skill.name = names[index]; });
  for (const role of data.roles) {
    role.name = role.roleId === "backend-development" ? "Backend Development" : "QA Automation";
    role.description = "FICTIONAL local fixture, not an occupational recommendation.";
    const ids = scenario === "historical" ? role.roleId === "backend-development" ? ["fixture-skill-2"] : ["fixture-skill-1"]
      : role.roleId === "backend-development" ? ["api-basics"] : ["api-basics", "fixture-skill-1"];
    role.skills = role.skills.filter(skill => ids.includes(skill.skillId));
    for (const skill of role.skills) skill.name = data.capabilities.find(capability => capability.skillId === skill.skillId).name;
  }
  for (const decision of data.criteriaDecisions) {
    const associated = data.roles.find(role => role.roleId === decision.roleId).skills.some(skill => skill.skillId === decision.skillId);
    decision.action = associated ? "admit" : "retire";
    decision.reason = "FICTIONAL fixture association; not a live admission or retirement claim.";
  }
  if (scenario === "prerequisite") {
    data.capabilities.find(skill => skill.skillId === "fixture-skill-1").prerequisiteSkillIds = ["fixture-skill-2"];
    data.prerequisiteEdges = [{ skillId: "fixture-skill-1", prerequisiteSkillId: "fixture-skill-2" }];
    Object.assign(data.evidence[0], { originalDate: "2020", datePrecision: "year", publishedDate: null, publishedAt: null });
    data.resources.find(resource => resource.skillId === "fixture-skill-1").estimateBasis = "provider";
  }
  return data;
}

async function syntheticPartialState(store, setClock) {
  // A frozen, labelled outage scenario; no publisher, model or database call occurs.
  const old = new Date(Date.parse(NOW) - 26 * 60 * 60 * 1000).toISOString();
  setClock(Date.parse(old));
  let lease = await store.reserveRefresh();
  let state = (await store.readRefreshState()).state;
  state.providers = [{ providerId: "fictional-feed", status: "ok", lastAttemptAt: old, lastSuccessfulCheckAt: old }];
  await store.saveRefreshState(lease.generation, state, true);
  await store.releaseRefresh(lease.generation);
  setClock(Date.parse(NOW));
  lease = await store.reserveRefresh();
  state = (await store.readRefreshState()).state;
  state.providers = [{ providerId: "fictional-feed", status: "failed", lastAttemptAt: NOW, lastSuccessfulCheckAt: old, errorCode: "FICTIONAL_FAILURE" }];
  state.notices = ["FICTIONAL partial-update scenario; fixed clock, no live sources or AI."];
  state.queue.items = ["pending", "quarantined"].map((status, index) => ({
    key: String(index + 1).repeat(64), sourceId: `fictional-item-${index}`, providerId: "fictional-feed",
    contentHash: String(index + 3).repeat(64), interpreterFingerprint: "fictional-interpreter",
    state: status, firstQueuedAt: NOW, lastAttemptAt: status === "pending" ? null : NOW,
    attemptCount: status === "pending" ? 0 : 3, inputFailureCount: status === "pending" ? 0 : 3,
    nextAttemptAt: null, lastErrorCode: status === "pending" ? null : "FICTIONAL_INPUT_FAILURE",
  }));
  await store.saveRefreshState(lease.generation, state, false);
  await store.releaseRefresh(lease.generation);
}

async function scenarioApi(scenario) {
  let clock = scenario === "prerequisite" ? Date.parse(NOW) - 26 * 60 * 60 * 1000 : Date.parse(NOW);
  const store = new MemoryCriteriaStore({ now: () => clock });
  const snapshotId = scenario === "empty" ? null : await store.bootstrap(fictionalBundle(scenario));
  if (scenario === "prerequisite") await syntheticPartialState(store, value => { clock = value; });
  const fixture = context();
  const router = createCriteriaApiRouter({
    store, reference: fixture.reference, config: fixture.config, now: () => new Date(clock).toISOString(),
    fetcher: async () => { throw new Error("External source requests are blocked in this fictional fixture."); },
    interpreter: scenario === "prerequisite" ? { model: "fictional-disabled", interpretBatch: async () => { throw new Error("No model calls in the fixture."); } } : null,
    adapter: { name: "mock", extractProfile: async (text, catalogue) => {
      if (!text.startsWith("FICTIONAL")) throw new ApiFailure("INVALID_INPUT", "Use a sample or a CV explicitly labelled FICTIONAL in this local fixture.");
      const skillId = scenario !== "historical" && text.includes("Sam Rivera") ? "fixture-skill-1" : "api-basics";
      return { status: "draft", extractedSkills: [{ skillId, rawName: catalogue.find(skill => skill.id === skillId).name,
        evidence: "FICTIONAL synthetic extraction; not model analysis of this CV.", confidence: 1 }], projects: [], experience: [],
        warnings: ["FICTIONAL fixture: fixed synthetic extraction. No AI model was called."] };
    } },
  });
  return { router, snapshotId };
}

function fixtureHtml(index, scenario) {
  const banner = `<aside role="note" style="padding:14px 20px;background:#fff3cd;color:#332701;border-bottom:2px solid #8a6500">
    <strong>FICTIONAL / NOT LIVE EVIDENCE</strong> · ${scenario} scenario.<br>
    Real API routes, synthetic extraction and evidence; memory storage only. No publisher, model or database requests.
    The prerequisite scenario uses a frozen synthetic clock (${NOW}).
    <nav aria-label="Fictional test scenarios">${SCENARIOS.map(name => `<a href="/fixtures/${name}/" style="margin-right:16px">${name}</a>`).join("")}</nav>
  </aside>`;
  return index.replace(/<link[^>]*href="https:\/\/fonts\.[^"]*"[^>]*>\s*/g, "")
    .replace("<head>", `<head><base href="/"><script>window.CQ_API_BASE="/fixtures/${scenario}";</script>`)
    .replace("<body>", `<body>${banner}`);
}

export async function startCriteriaFixtureServer({ port = 0, scenario = "coverage" } = {}) {
  if (!SCENARIOS.includes(scenario) || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error("Use a named fixture scenario and a valid local port.");
  const app = express();
  app.disable("x-powered-by");
  const index = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const scenarios = new Map();
  for (const name of SCENARIOS) {
    const entry = await scenarioApi(name);
    scenarios.set(name, entry);
    app.get(`/fixtures/${name}/`, (_req, res) => res.type("html").set("cache-control", "no-store").send(fixtureHtml(index, name)));
    app.use(`/fixtures/${name}`, entry.router);
  }
  app.get("/", (_req, res) => res.type("html").set("cache-control", "no-store").send(fixtureHtml(index, scenario)));
  app.use(scenarios.get(scenario).router);
  app.use(express.static(PUBLIC_DIR, { index: false, cacheControl: false, setHeaders: res => res.setHeader("cache-control", "no-store") }));
  app.use((_req, res) => res.status(404).type("text").send("Not found in this fictional fixture."));
  const server = createServer(app);
  await new Promise((yes, no) => { server.once("error", no); server.listen(port, "127.0.0.1", yes); });
  const address = server.address();
  return { url: `http://${address.address}:${address.port}`, snapshotId: scenarios.get(scenario).snapshotId,
    close: () => new Promise((yes, no) => server.close(error => error ? no(error) : yes())) };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const server = await startCriteriaFixtureServer({ port: Number(process.env.CQ_FIXTURE_PORT ?? 5174), scenario: process.argv[2] ?? "coverage" });
  console.log(`FICTIONAL / NOT LIVE EVIDENCE — ${server.url}`);
  console.log("Local verification only. Stop with Ctrl+C. No production credentials or external requests.");
}
