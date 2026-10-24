// Coordinates versioned requests without storing personal data outside the page.
import { ApiError } from "./api.js";
import { skillCatalogue } from "./profile.js";
import { buildOptionalQuestions, mergeSkillAnswers } from "./trends.js";

const snapshotId = value => typeof value === "string" && /^criteria-[a-f0-9]{64}$/.test(value);
const slug = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const instant = value => value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
const badReply = () => new ApiError("INTERNAL_ERROR", "The server returned inconsistent criteria. Reload the catalogue and try again.");

function checkedMeta(meta, target) {
  if (!record(meta)) throw badReply();
  if (meta.snapshotId === null) throw new ApiError("TRENDS_UNAVAILABLE", "No saved criteria are available. Please try again later.", [], { status: 503 });
  if (!snapshotId(meta.snapshotId) || (target && meta.snapshotId !== target) || meta.policyVersion !== "count-coverage-v1"
    || !["fresh", "partial", "unavailable", "disabled"].includes(meta.status)
    || !instant(meta.lastSuccessfulCheckAt) || !instant(meta.lastAttemptAt)
    || !Array.isArray(meta.providers) || !meta.providers.every(p => record(p) && slug(p.providerId)
      && ["ok", "unchanged", "failed", "disabled"].includes(p.status) && instant(p.lastAttemptAt) && instant(p.lastSuccessfulCheckAt))
    || !Array.isArray(meta.notices) || !meta.notices.every(n => typeof n === "string")
    || !Number.isInteger(meta.deferredItemCount) || meta.deferredItemCount < 0
    || !Number.isInteger(meta.quarantinedItemCount) || meta.quarantinedItemCount < 0
    || !["ready", "busy", "cooldown"].includes(meta.refreshControl?.state) || !instant(meta.refreshControl.retryAt)) throw badReply();
  return meta;
}

function checkedProfile(profile, catalogue, original) {
  if (profile?.status !== "confirmed" || !Array.isArray(profile.confirmedSkills)
    || ![profile.removedSkillIds, profile.addedSkillIds, profile.unconfirmedSkillIds].every(Array.isArray)
    || !["preferred-route", "exploring"].includes(profile.entryPath)
    || (profile.entryPath === "preferred-route" && !slug(profile.preferredRouteId))
    || typeof profile.confirmedAt !== "string" || !Number.isFinite(Date.parse(profile.confirmedAt))) throw badReply();
  const confirmed = profile.confirmedSkills.map(s => s?.skillId);
  const all = [...confirmed, ...profile.removedSkillIds, ...profile.unconfirmedSkillIds];
  if (all.some(id => !slug(id) || (catalogue && !catalogue.has(id))) || new Set(all).size !== all.length
    || !profile.addedSkillIds.every(id => confirmed.includes(id))
    || (original && (profile.entryPath !== original.entryPath || profile.preferredRouteId !== original.preferredRouteId
      || profile.confirmedAt !== original.confirmedAt))) throw badReply();
  return profile;
}

function checkedInput(profile, answers, fromSnapshotId) {
  try {
    checkedProfile(profile);
    if (fromSnapshotId !== undefined && !snapshotId(fromSnapshotId)) throw badReply();
    mergeSkillAnswers(profile, answers);
    return { ...(fromSnapshotId ? { fromSnapshotId } : {}), answers: answers.map(answer => ({ ...answer })) };
  } catch {
    throw new ApiError("INVALID_INPUT", "Use a confirmed profile and a valid criteria version with possession answers.");
  }
}

function checkedRequest(profile, review) {
  if (!record(review) || Object.keys(review).some(k => !["fromSnapshotId", "targetSnapshotId", "answers"].includes(k))
    || !snapshotId(review.targetSnapshotId)) throw new ApiError("INVALID_INPUT", "Use a valid criteria version with possession answers.");
  return { ...checkedInput(profile, review.answers === undefined ? [] : review.answers, review.fromSnapshotId), targetSnapshotId: review.targetSnapshotId };
}

function checkedReview(review, profile, target) {
  if (review?.targetSnapshotId !== target) throw badReply();
  try { buildOptionalQuestions(review, profile); } catch { throw badReply(); }
  return review;
}

function checkedRoles(response, target, profile) {
  checkedMeta(response?.criteria, target);
  let catalogue;
  try { catalogue = skillCatalogue(response); } catch { throw badReply(); }
  if (!response.roles.length || (profile.preferredRouteId && !response.roles.some(role => role.roleId === profile.preferredRouteId))) throw badReply();
  checkedProfile(profile, catalogue);
  return catalogue;
}

function checkedMatch(response, target, roles, profile) {
  checkedMeta(response?.criteria, target);
  checkedReview(response.review, profile, target);
  if (typeof response.scoreMeaning !== "string" || !response.scoreMeaning.length
    || !Array.isArray(response.roles) || response.roles.length !== roles.roles.length
    || new Set(response.roles.map(r => r.roleId)).size !== response.roles.length) throw badReply();
  for (const result of response.roles) {
    const role = roles.roles.find(r => r.roleId === result.roleId);
    if (!role || !Number.isInteger(result.score) || result.score < 0 || result.score > 100
      || ![result.strengths, result.gaps, result.unconfirmedSkills].every(Array.isArray)) throw badReply();
    const skills = [...result.strengths, ...result.gaps, ...result.unconfirmedSkills];
    if (skills.length !== role.skills.length || new Set(skills.map(s => s.skillId)).size !== skills.length
      || skills.some(s => s.weight !== 1 || s.evidenceAdjustments?.length || !role.skills.some(r => r.skillId === s.skillId))) throw badReply();
  }
}

export function createCriteriaFlow(api) {
  let generation = 0;
  const obsolete = Symbol("obsolete criteria operation");
  function current(id) { if (id !== generation) throw obsolete; }
  async function receive(id, promise) { const result = await promise; current(id); return result; }
  async function run(id, operation) {
    try { return await operation(); }
    catch (error) { if (id !== generation || error === obsolete) return { status: "stale" }; throw error; }
  }

  async function retryContext(id, profile, review, mayChangeVersion, operation) {
    try { return await operation(review, false); }
    catch (error) {
      current(id);
      if (!(error instanceof ApiError) || error.status !== 409 || error.code !== "CRITERIA_CONTEXT_REQUIRED" || !error.review) throw error;
      try { checkedReview(error.review, profile, error.review.targetSnapshotId); } catch { throw error; }
      if (!mayChangeVersion && error.review.targetSnapshotId !== review.targetSnapshotId) {
        throw new ApiError("CRITERIA_CONTEXT_REQUIRED", "The criteria changed. Reload or check for updates before applying this skill change.", [],
          { status: 409, review: error.review });
      }
      // Exactly one reload/resubmission. This branch never invokes refresh or extraction.
      return operation({ ...review, targetSnapshotId: error.review.targetSnapshotId }, true);
    }
  }

  async function ready(id, profile, review) {
    const target = review.targetSnapshotId;
    const rolesResponse = await receive(id, api.roles(target));
    const catalogue = checkedRoles(rolesResponse, target, profile);
    const reconciled = await receive(id, api.reconcile(profile, review));
    if (reconciled?.status !== "ready" || reconciled.snapshotId !== target) throw badReply();
    checkedMeta(reconciled.criteria, target);
    checkedProfile(reconciled.profile, catalogue, profile);
    checkedReview(reconciled.review, reconciled.profile, target);
    const matchResponse = await receive(id, api.match(reconciled.profile, { snapshotId: target, criteriaReview: review }));
    checkedMatch(matchResponse, target, rolesResponse, reconciled.profile);
    return { status: "ready", profile: reconciled.profile, snapshotId: target,
      review: matchResponse.review, criteria: matchResponse.criteria, rolesResponse, matchResponse };
  }

  return {
    confirm(profile, { fromSnapshotId, answers = [] } = {}) {
      const id = ++generation;
      return run(id, async () => {
        // Validate personal inputs before asking the shared service to do work.
        const input = checkedInput(profile, answers, fromSnapshotId);
        const criteria = checkedMeta(await receive(id, api.refreshTrends()));
        const review = { ...input, targetSnapshotId: criteria.snapshotId };
        return retryContext(id, profile, review, true, context => ready(id, profile, context));
      });
    },
    updatePossession(profile, criteriaReview) {
      const id = ++generation;
      return run(id, async () => {
        const review = checkedRequest(profile, criteriaReview);
        return retryContext(id, profile, review, false, context => ready(id, profile, context));
      });
    },
    loadPathway(profile, roleId, criteriaReview) {
      const id = ++generation;
      return run(id, async () => {
        const review = checkedRequest(profile, criteriaReview);
        if (!slug(roleId)) throw new ApiError("INVALID_INPUT", "Choose a supported route.");
        return retryContext(id, profile, review, false, async (context, reload) => {
          const target = context.targetSnapshotId;
          if (reload) checkedRoles(await receive(id, api.roles(target)), target, profile);
          const responses = await receive(id, Promise.allSettled([
            api.pathway(profile, roleId, { snapshotId: target, criteriaReview: context }), api.evidence(target), api.sdg(target),
          ]));
          if (responses[0].status === "rejected") throw responses[0].reason;
          const pathway = responses[0].value;
          checkedMeta(pathway?.criteria, target);
          checkedReview(pathway.review, profile, target);
          if (pathway.roleId !== roleId || !Array.isArray(pathway.steps)) throw badReply();
          const view = { status: "ready", snapshotId: target, pathway, evidence: null, sdg: null, panelErrors: {} };
          for (const [index, name] of [[1, "evidence"], [2, "sdg"]]) {
            try {
              const result = responses[index];
              if (result.status === "rejected") throw result.reason;
              checkedMeta(result.value?.criteria, target);
              const fields = name === "evidence" ? ["items"] : ["goals", "roleTags", "skillTags"];
              if (!fields.every(field => Array.isArray(result.value[field]))) throw badReply();
              view[name] = result.value;
            } catch (error) {
              view.panelErrors[name] = error instanceof ApiError ? error : badReply();
            }
          }
          return view;
        });
      });
    },
    invalidate() { generation++; },
  };
}
