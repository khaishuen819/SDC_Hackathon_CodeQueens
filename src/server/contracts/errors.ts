import * as z from "zod";

export const ErrorCode = z.enum([
  "INVALID_INPUT", // request body or query failed validation
  "UNSUPPORTED_FILE", // not a PDF or plain-text file
  "UNREADABLE_CV", // no text could be read (e.g. scanned or empty PDF)
  "FILE_TOO_LARGE", // over the upload size limit
  "LLM_FAILED", // the model returned bad JSON, or the provider failed
  "LLM_TIMEOUT", // the model did not answer in time
  "NOT_FOUND", // unknown route, role, skill, etc.
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

// HTTP status for each code, so every route answers the same way.
export const ERROR_HTTP_STATUS = {
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE: 415,
  UNREADABLE_CV: 422,
  LLM_FAILED: 502,
  LLM_TIMEOUT: 504,
} as const satisfies Record<ErrorCode, number>;

// The one error shape every endpoint returns.
export const ApiError = z.object({
  error: z.object({
    code: ErrorCode,
    // Plain text the frontend can show to the graduate.
    message: z.string().min(1),
    // Optional field-level problems, e.g. from Zod validation.
    details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;
