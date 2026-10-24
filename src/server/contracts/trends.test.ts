import test from "node:test";
import assert from "node:assert/strict";
import { CriteriaBundle, CandidateInterpretation, SourceItem } from "./trends.ts";
import { bundle, candidate, context } from "../trends/testFixtures.ts";

test("ready synthetic bundle and interpretations parse without losing decision records", () => {
  const data = bundle();
  assert.deepEqual(CriteriaBundle.parse(data), data);
  assert.deepEqual(CandidateInterpretation.parse(candidate()), candidate());
  assert.deepEqual(SourceItem.parse(context().sources[0]), context().sources[0]);
});

test("decision records are required with known references and consistent associations", () => {
  const data: any = bundle();
  delete data.criteriaDecisions;
  assert.equal(CriteriaBundle.safeParse(data).success, false);
  const unknown = bundle(); unknown.criteriaDecisions[0].evidenceIds = ["made-up"];
  assert.equal(CriteriaBundle.safeParse(unknown).success, false);
  const retired = bundle(); retired.criteriaDecisions[0].action = "retire";
  assert.equal(CriteriaBundle.safeParse(retired).success, false);
  const duplicate = bundle(); duplicate.criteriaDecisions.push(structuredClone(duplicate.criteriaDecisions[0]));
  assert.equal(CriteriaBundle.safeParse(duplicate).success, false);
});

test("historical capabilities can remain recognised without current role association", () => {
  const data = bundle(2);
  for (const role of data.roles) role.skills = role.skills.filter((s) => s.skillId !== "fixture-skill-1");
  for (const decision of data.criteriaDecisions) if (decision.skillId === "fixture-skill-1") decision.action = "retire";
  assert.equal(CriteriaBundle.safeParse(data).success, true);
});

test("readiness rejects non-one weights, placeholders, missing resources/SDG and unknown skills", () => {
  const variants: any[] = Array.from({ length: 5 }, () => bundle());
  variants[0].roles[0].skills[0].weight = 3;
  variants[1].resources[0].isPlaceholder = true;
  variants[2].resources = [];
  variants[3].sdg.skillTags = [];
  variants[4].roles[0].skills[0].skillId = "made-up";
  for (const value of variants) assert.equal(CriteriaBundle.safeParse(value).success, false);
});

test("prerequisites reject unknown IDs and cycles", () => {
  const unknown = bundle(2); unknown.capabilities[0].prerequisiteSkillIds = ["missing"];
  assert.equal(CriteriaBundle.safeParse(unknown).success, false);
  const cycle = bundle(2);
  cycle.capabilities[0].prerequisiteSkillIds = ["fixture-skill-1"];
  cycle.capabilities[1].prerequisiteSkillIds = ["api-basics"];
  cycle.prerequisiteEdges = [{ skillId: "api-basics", prerequisiteSkillId: "fixture-skill-1" }, { skillId: "fixture-skill-1", prerequisiteSkillId: "api-basics" }];
  assert.equal(CriteriaBundle.safeParse(cycle).success, false);
});

test("year-only source provenance does not invent a publication day", () => {
  const data = bundle();
  Object.assign(data.evidence[0], { publishedDate: null, publishedAt: null, originalDate: "2020", datePrecision: "year" });
  assert.equal(CriteriaBundle.safeParse(data).success, true);
});

test("co-scored duplicate definitions/outcomes reject, while retired history is retained", () => {
  const duplicated = bundle(2);
  duplicated.capabilities[1].definition = duplicated.capabilities[0].definition;
  duplicated.capabilities[1].observableOutcome = duplicated.capabilities[0].observableOutcome;
  assert.equal(CriteriaBundle.safeParse(duplicated).success, false);
  duplicated.roles.forEach((r) => { r.skills = r.skills.filter((s) => s.skillId !== "fixture-skill-1"); });
  duplicated.criteriaDecisions.forEach((d) => { if (d.skillId === "fixture-skill-1") d.action = "retire"; });
  assert.equal(CriteriaBundle.safeParse(duplicated).success, true);
});

test("known date precision requires its original value; wholly unknown dates stay honest", () => {
  for (const precision of ["year", "month"] as const) {
    const data = bundle(); Object.assign(data.evidence[0], { publishedDate: null, publishedAt: null, originalDate: null, datePrecision: precision });
    assert.equal(CriteriaBundle.safeParse(data).success, false);
    Object.assign(data.evidence[0], { datePrecision: "unknown" });
    assert.equal(CriteriaBundle.safeParse(data).success, true);
  }
});

test("evidence dates must be real and agree with their precision and publication day", () => {
  const none = { publishedDate: null, publishedAt: null };
  for (const bad of [
    { datePrecision: "day", originalDate: "2020-02-31", publishedDate: "2020-03-02", publishedAt: null },
    { datePrecision: "day", originalDate: "2019-06-30" },
    { datePrecision: "day", originalDate: "2020" },
    { datePrecision: "month", originalDate: "2020-01-15", ...none },
    { datePrecision: "month", originalDate: "2020-13", ...none },
    { datePrecision: "year", originalDate: "2020-01", ...none },
    { datePrecision: "year", originalDate: "not a date", ...none },
    { datePrecision: "unknown", originalDate: "2020-01-01", ...none },
  ]) {
    const data = bundle(); Object.assign(data.evidence[0], bad);
    assert.equal(CriteriaBundle.safeParse(data).success, false, JSON.stringify(bad));
  }
  for (const good of [
    { datePrecision: "month", originalDate: "2020-02", ...none },
    { datePrecision: "day", originalDate: "2020-02-29", publishedDate: "2020-02-29", publishedAt: "2020-02-29T08:00:00Z" },
  ]) {
    const data = bundle(); Object.assign(data.evidence[0], good);
    assert.equal(CriteriaBundle.safeParse(data).success, true, JSON.stringify(good));
  }
});

test("decision evidence must support the decision's capability, not just be a known ID", () => {
  const data = bundle(2);
  data.evidence.push({ ...structuredClone(data.evidence[0]), id: "other-fictional-evidence", linkedSkillIds: ["fixture-skill-1"] });
  data.criteriaDecisions[0].evidenceIds = ["other-fictional-evidence"];
  assert.equal(CriteriaBundle.safeParse(data).success, false);
});
