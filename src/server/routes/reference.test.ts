// Tests for GET /api/sdg and GET /api/evidence, using the real database read
// functions with a fake Prisma client (no real database).
// Run with: npm test

import { after, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { EvidenceListResponse, SdgResponse } from "../contracts/index.ts";
import { EVIDENCE_LIST_WHERE, loadEvidenceList, loadSdg } from "../db/referenceData.ts";
import { errorHandler } from "./errors.ts";
import { createReferenceRouter } from "./reference.ts";

type Db = Parameters<typeof loadSdg>[0];

const source = {
  id: "fictional-source-1",
  title: "FICTIONAL source (test only)",
  publisher: "Example Publisher (fictional)",
  url: "https://example.com/fictional/source-1",
  publishedDate: new Date("2026-01-15T00:00:00Z"),
  retrievedAt: new Date("2026-10-23T00:00:00Z"),
  isPlaceholder: false,
};
const evidenceRow = (id: string, isPlaceholder: boolean) => ({
  id,
  sourceId: source.id,
  skillId: "docker",
  direction: "rising",
  summary: "Fictional summary.",
  supportedClaim: "Fictional claim, test only.",
  limitation: "Fictional, not a real source.",
  priorityAdjustment: null,
  adjustmentExplanation: null,
  isPlaceholder,
  source,
});

// A fake client: returns the given rows (even ones the query would exclude) and records queries.
function fakeDb(evidenceRows: unknown[]) {
  const evidenceQueries: unknown[] = [];
  const db = {
    sdgGoal: {
      findMany: async () => [
        { id: "sdg-4", number: 4, name: "Quality Education" },
        { id: "sdg-9", number: 9, name: "Industry, Innovation and Infrastructure" },
      ],
    },
    roleSdg: {
      findMany: async () => [{ roleId: "qa-automation", sdgId: "sdg-9", rationale: "PLACEHOLDER rationale.", isPlaceholder: true }],
    },
    skillSdg: {
      findMany: async () => [{ skillId: "testing-basics", sdgId: "sdg-9", rationale: "PLACEHOLDER rationale.", isPlaceholder: true }],
    },
    trendEvidence: { findMany: async (args: unknown) => (evidenceQueries.push(args), evidenceRows) },
  };
  return { db: db as unknown as Db, evidenceQueries };
}

const servers: Server[] = [];
after(() => servers.forEach((s) => s.close()));

async function get(db: Db, path: string) {
  const app = express();
  app.use(createReferenceRouter({ loadSdg: () => loadSdg(db), loadEvidenceList: () => loadEvidenceList(db) }));
  app.use(errorHandler);
  const server = app.listen(0);
  servers.push(server);
  await new Promise((resolve) => server.once("listening", resolve));
  const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`);
  return { status: res.status, body: (await res.json()) as unknown };
}

// (g)
test("GET /api/sdg passes the SdgResponse schema", async () => {
  const result = await get(fakeDb([]).db, "/api/sdg");
  assert.equal(result.status, 200);
  const sdg = SdgResponse.parse(result.body);
  assert.deepEqual(sdg.goals.map((g) => g.sdgId), ["sdg-4", "sdg-9"]);
  assert.equal(sdg.roleTags[0]?.isPlaceholder, true);
});

test("GET /api/evidence with no evidence returns an empty items array", async () => {
  const result = await get(fakeDb([]).db, "/api/evidence");
  assert.equal(result.status, 200);
  assert.deepEqual(EvidenceListResponse.parse(result.body), { items: [] });
});

test("GET /api/evidence returns reviewed rows only, one row = one item with one skill", async () => {
  const { db, evidenceQueries } = fakeDb([evidenceRow("reviewed-1", false), evidenceRow("placeholder-1", true)]);
  const result = await get(db, "/api/evidence");
  assert.equal(result.status, 200);
  const list = EvidenceListResponse.parse(result.body);
  assert.deepEqual(list.items, [
    {
      id: "reviewed-1",
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      publishedDate: "2026-01-15",
      retrievedAt: "2026-10-23",
      supportedClaim: "Fictional claim, test only.",
      limitation: "Fictional, not a real source.",
      linkedSkillIds: ["docker"],
    },
  ]);
  // The database query itself asks only for reviewed rows.
  assert.deepEqual((evidenceQueries[0] as { where: unknown }).where, EVIDENCE_LIST_WHERE);
  assert.deepEqual(EVIDENCE_LIST_WHERE, { isPlaceholder: false });
});
