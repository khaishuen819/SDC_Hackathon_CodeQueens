import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import { ERROR_HTTP_STATUS, type ApiError, type ErrorCode } from "../contracts/index.ts";

// Field-level problems, e.g. from Zod validation.
export type ErrorDetail = { path: string; message: string };

// Throw this anywhere in a route to answer with our standard error shape.
export class ApiFailure extends Error {
  code: ErrorCode;
  details: ErrorDetail[] | undefined;

  constructor(code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = "ApiFailure";
    this.code = code;
    this.details = details;
  }
}

export function sendError(res: Response, code: ErrorCode, message: string, details?: ErrorDetail[]) {
  const body: ApiError = { error: details ? { code, message, details } : { code, message } };
  res.status(ERROR_HTTP_STATUS[code]).json(body);
}

// Unknown /api paths.
export const notFoundHandler: RequestHandler = (_req, res) => {
  sendError(res, "NOT_FOUND", "There is no API endpoint at this path.");
};

// Last stop for every error in the API routes.
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof ApiFailure) {
    sendError(res, err.code, err.message, err.details);
    return;
  }

  // Errors from express.json(): the body is not valid JSON, or is too big.
  const bodyErrorType = typeof err === "object" && err !== null && "type" in err ? err.type : undefined;
  if (bodyErrorType === "entity.parse.failed") {
    sendError(res, "INVALID_INPUT", "The request body is not valid JSON.");
    return;
  }
  if (bodyErrorType === "entity.too.large") {
    sendError(res, "INVALID_INPUT", "The request body is too large.");
    return;
  }

  // Unexpected problem. Log only the error name and message: never request
  // bodies or CV text (our code never puts CV text into error messages).
  console.error("Unexpected error:", err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
  sendError(res, "INTERNAL_ERROR", "Something went wrong on the server. Please try again.");
};
