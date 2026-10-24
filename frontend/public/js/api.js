// Calls to M2's backend. Shapes: src/server/contracts/ (examples in examples.ts).
// Context errors also carry optional skill guidance, separate from possession answers.

// Same address as the page by default (Express serves this folder). Set window.CQ_API_BASE
// before app.js loads to call a backend on another address (needs CORS on the backend).
const BASE = (globalThis.CQ_API_BASE ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(code, message, details = [], { status = 0, review = null } = {}) {
    super(message);
    this.code = code;
    this.details = details ?? [];
    this.status = status;
    this.review = status === 409 && code === "CRITERIA_CONTEXT_REQUIRED" && validReview(review) ? review : null;
  }
}

const snapshotId = value => typeof value === "string" && /^criteria-[a-f0-9]{64}$/.test(value);
const slug = value => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const text = value => typeof value === "string" && value.length > 0;
const onlyKeys = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).every(key => keys.includes(key));

// Mirrors contracts/criteria.ts without adding a browser dependency on Zod.
// Invalid context stays an ordinary error; it cannot authorize automatic recovery.
function validReview(review) {
  return onlyKeys(review, ["fromSnapshotId", "targetSnapshotId", "questions"])
    && snapshotId(review.targetSnapshotId)
    && (!Object.hasOwn(review, "fromSnapshotId") || snapshotId(review.fromSnapshotId))
    && Array.isArray(review.questions)
    && review.questions.every(q => onlyKeys(q, ["skillId", "name", "roleIds", "why", "evidenceIds", "state"])
      && slug(q.skillId) && text(q.name) && text(q.why)
      && Array.isArray(q.roleIds) && q.roleIds.length > 0 && q.roleIds.every(slug)
      && Array.isArray(q.evidenceIds) && q.evidenceIds.every(slug)
      && ["not-sure", "unanswered"].includes(q.state))
    && new Set(review.questions.map(q => q.skillId)).size === review.questions.length;
}

export function createApi({ base = "", fetchImpl = globalThis.fetch } = {}) {
  const address = base.replace(/\/$/, "");
  async function request(path, options) {
    let res;
    try {
      res = await fetchImpl(address + path, options);
    } catch {
      throw new ApiError("NETWORK", "We couldn't reach the server. Check your connection and try again.");
    }
    let body = null;
    try {
      body = await res.json();
    } catch {
      // Not JSON: handled below.
    }
    if (!res.ok) {
      const e = body && body.error;
      throw new ApiError(
        (e && e.code) || "INTERNAL_ERROR",
        (e && e.message) || "Something went wrong on the server. Please try again.",
        e && e.details,
        { status: res.status, review: body && body.review },
      );
    }
    if (body === null) throw new ApiError("INTERNAL_ERROR", "The server sent a reply we could not read.", [], { status: res.status });
    return body;
  }

  function postJson(path, data) {
    return request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  const pinned = (path, id) => id === undefined ? path : `${path}?${new URLSearchParams({ snapshotId: id })}`;
  return {
    roles: id => request(pinned("/api/roles", id)),
    sdg: id => request(pinned("/api/sdg", id)),
    evidence: id => request(pinned("/api/evidence", id)),
    trends: () => request("/api/trends"),
    refreshTrends: () => postJson("/api/trends/refresh", {}),
    reconcile: (profile, review) => postJson("/api/trends/reconcile", { profile, review }),
    extract(file) {
      const form = new FormData();
      form.append("cv", file);
      return request("/api/profile/extract", { method: "POST", body: form });
    },
    match: (profile, { snapshotId, criteriaReview } = {}) => postJson("/api/match", { ...profile, snapshotId, criteriaReview }),
    pathway: (profile, roleId, { snapshotId, criteriaReview } = {}) => postJson("/api/pathway", { profile, roleId, snapshotId, criteriaReview }),
  };
}

export const api = createApi({ base: BASE });

// Extra help shown under the server's message, per error code.
export const ERROR_HINTS = {
  UNSUPPORTED_FILE: "Use a PDF with real text, or a .txt file.",
  FILE_TOO_LARGE: "The file must be 2 MB or smaller.",
  UNREADABLE_CV: "Scanned PDFs don't work. Try a PDF with real text, or a .txt file.",
  LLM_TIMEOUT: "Reading took too long. Please try again.",
  LLM_FAILED: "The CV reader had a problem. Please try again.",
  INVALID_INPUT: "Something in the request didn't check out.",
  NETWORK: "If this keeps happening, the server may be waking up: wait a few seconds and retry.",
  INTERNAL_ERROR: "Please try again in a moment.",
  NOT_FOUND: "We couldn't find that. Go back and try again.",
};
