import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCandidate, validateCriteriaBundle } from "./policy.ts";
import { candidate, context, NOW, RESOURCE_TEXT } from "./testFixtures.ts";

test("a distinct ready capability passes all eight gates without mutating input", () => {
  const input = candidate(), ctx = context();
  const before = structuredClone({ input, ctx });
  assert.equal(evaluateCandidate(input, ctx).status, "promote");
  assert.deepEqual({ input, ctx }, before);
  assert.deepEqual(validateCriteriaBundle(ctx.base), ctx.base);
});

for (const [name, gate, edit, status] of [
  ["unretrieved source", "A1", (c: any) => { c.sourceId = "invented"; }, "reject"],
  ["invented quote", "A1", (c: any) => { c.sourceExcerpt = "An invented quote that does not appear in the source."; }, "reject"],
  ["unrelated role", "A2", (c: any) => { c.roleId = "video-editing"; }, "reject"],
  ["invented reference", "A2", (c: any) => { c.referenceTaskId = "invented"; }, "reject"],
  ["missing observable outcome", "A3", (c: any) => { c.capability.observableOutcome = ""; }, "reject"],
  ["uncertain distinction", "A4", (c: any) => { c.relation = "uncertain"; }, "stage"],
  ["specialist-only fit", "A5", (c: any) => { c.fit = "specialist"; }, "stage"],
  ["missing prerequisite", "A5", (c: any) => { c.capability.prerequisiteSkillIds = ["unknown-prerequisite"]; }, "stage"],
  ["unresolved conflict", "A6", (c: any) => { c.conflict = true; }, "stage"],
  ["missing resource", "A7", (c: any) => { c.learning.resourceLinkIds = []; }, "stage"],
  ["missing SDG", "A8", (c: any) => { c.sdgTemplateIds = []; }, "stage"],
] as const) {
  test(`${gate}: ${name} has no scored promotion`, () => {
    const input = candidate(); edit(input);
    const result = evaluateCandidate(input, context());
    assert.equal(result.status, status);
    assert.ok("reasons" in result && result.reasons.some((reason) => reason.gate === gate));
  });
}

test("A1 retains useful old sources but rejects missing/future dates, hosts and altered content", () => {
  assert.equal(evaluateCandidate(candidate(), context()).status, "promote");
  for (const change of [
    { publishedAt: null }, { publishedAt: "2026-10-25T00:00:00Z" },
    { canonicalUrl: "https://unapproved.example/update" }, { contentHash: "0".repeat(64) },
  ]) {
    const ctx = context(); Object.assign(ctx.sources[0], change);
    assert.equal(evaluateCandidate(candidate(), ctx).status, "reject");
  }
});

test("A4 aliases, tools, versions and covered subpractices reuse a known capability", () => {
  for (const relation of ["same", "alias", "tool-for", "version-of", "example-of", "covered-subpractice"] as const) {
    const c = candidate(); c.relation = relation; c.existingSkillId = "api-basics";
    assert.deepEqual(evaluateCandidate(c, context()), { status: "reuse", existingSkillId: "api-basics" });
  }
  const renamed = candidate(); renamed.capability.name = " HTTP API BASICS ";
  assert.deepEqual(evaluateCandidate(renamed, context()), { status: "reuse", existingSkillId: "api-basics" });
  const covered = candidate(); covered.capability.observableOutcome = context().base.capabilities[0].observableOutcome;
  assert.equal(evaluateCandidate(covered, context()).status, "reuse");
});

test("A4 fabricated IDs and ambiguous aliases cannot create a scored duplicate", () => {
  const unknown = candidate(); unknown.relation = "same"; unknown.existingSkillId = "made-up";
  assert.equal(evaluateCandidate(unknown, context()).status, "reject");
  const ambiguous = candidate(); ambiguous.capability.aliases = ["API basics", "FICTIONAL skill 1"];
  assert.equal(evaluateCandidate(ambiguous, context()).status, "stage");
  const optional = candidate(); optional.relation = "alternative-stack";
  assert.equal(evaluateCandidate(optional, context()).status, "stage");
});

test("known-capability advice can reuse the ready baseline without inventing a new lesson estimate", () => {
  const c = { ...candidate(), relation: "same" as const, existingSkillId: "api-basics", learning: null, sdgTemplateIds: [] };
  assert.equal(evaluateCandidate(c, context()).status, "reuse");
  assert.equal(evaluateCandidate({ ...candidate(), learning: null }, context()).status, "stage");
});

test("A7 requires free retrieved resources and real teaching support", () => {
  for (const change of [{ access: "paid" }, { text: "An unrelated synthetic page with no instructional support." }, { url: "https://unapproved.example/course" }]) {
    const ctx = context(); Object.assign(ctx.resources[0], change);
    assert.equal(evaluateCandidate(candidate(), ctx).status, "stage");
  }
  const c = candidate(); c.learning.estimateBasis = "provider"; c.learning.estimateExcerpt = RESOURCE_TEXT;
  assert.equal(evaluateCandidate(c, context()).status, "stage");
});

test("A6 uncertainty is explicit and timestamps are not model confidence", () => {
  const c = candidate(); c.uncertainties = ["Graduate fit is unclear."];
  assert.equal(evaluateCandidate(c, context()).status, "stage");
  const ctx = context(); ctx.now = NOW;
  assert.equal(evaluateCandidate(candidate(), ctx).status, "promote");
});
