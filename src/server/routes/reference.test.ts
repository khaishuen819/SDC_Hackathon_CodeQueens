import test from "node:test";
import assert from "node:assert/strict";
import { createReferenceRouter } from "./reference.ts";
import { startApp, request, criteriaHarness } from "./criteriaTestSupport.ts";
import { bundle } from "../trends/testFixtures.ts";
import { VersionedEvidenceListResponse } from "../contracts/evidence.ts";
import { VersionedSdgResponse } from "../contracts/sdg.ts";

test("evidence and SDG readers retain publication precision and the requested version", async () => {
  const b = bundle(2);
  Object.assign(b.evidence[0], { publishedDate: null, publishedAt: null, originalDate: "2020", datePrecision: "year" });
  const h = await criteriaHarness(b), base = await startApp(createReferenceRouter(h));
  await h.publish(bundle(3));
  const result = await request(base, `/api/evidence?snapshotId=${h.id}`);
  assert.equal(result.status, 200);
  const evidence = VersionedEvidenceListResponse.parse(result.body);
  assert.equal(evidence.criteria.snapshotId, h.id);
  assert.deepEqual([evidence.items[0].publishedDate, evidence.items[0].publishedAt, evidence.items[0].originalDate, evidence.items[0].datePrecision], [null, null, "2020", "year"]);
  const sdg = VersionedSdgResponse.parse((await request(base, `/api/sdg?snapshotId=${h.id}`)).body);
  assert.equal(sdg.criteria.snapshotId, h.id); assert.deepEqual(sdg.skillTags.map((s) => s.skillId), ["api-basics", "fixture-skill-1"]);
});

test("reference readers reject malformed, repeated and unknown versions consistently", async () => {
  const h = await criteriaHarness(), base = await startApp(createReferenceRouter(h));
  for (const path of ["/api/evidence", "/api/sdg"]) {
    assert.equal((await request(base, `${path}?snapshotId=bad`)).status, 400);
    assert.equal((await request(base, `${path}?snapshotId=${h.id}&snapshotId=${h.id}`)).status, 400);
    const absent = await request(base, `${path}?snapshotId=criteria-${"f".repeat(64)}`);
    assert.equal(absent.status, 409); assert.equal(absent.body.error.code, "CRITERIA_UNAVAILABLE");
  }
});
