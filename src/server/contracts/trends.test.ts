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
