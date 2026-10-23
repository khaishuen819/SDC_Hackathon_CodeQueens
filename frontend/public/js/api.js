// Calls to M2's backend. Shapes: src/server/contracts/ (examples in examples.ts).
// Every backend error is { error: { code, message, details? } }; we turn it into an ApiError.

// Same address as the page by default (Express serves this folder). Set window.CQ_API_BASE
// before app.js loads to call a backend on another address (needs CORS on the backend).
const BASE = (globalThis.CQ_API_BASE ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.details = details ?? [];
  }
}

async function request(path, options) {
  let res;
  try {
    res = await fetch(BASE + path, options);
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
    );
  }
  if (body === null) throw new ApiError("INTERNAL_ERROR", "The server sent a reply we could not read.");
  return body;
}

function postJson(path, data) {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });
}

export const api = {
  roles: () => request("/api/roles"),
  sdg: () => request("/api/sdg"),
  evidence: () => request("/api/evidence"),
  extract(file) {
    const form = new FormData();
    form.append("cv", file);
    return request("/api/profile/extract", { method: "POST", body: form });
  },
  match: (profile) => postJson("/api/match", profile),
  pathway: (profile, roleId) => postJson("/api/pathway", { profile, roleId }),
};

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
