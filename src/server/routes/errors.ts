import type { ErrorRequestHandler, RequestHandler, Response } from "express";
import { ERROR_HTTP_STATUS, type ApiError, type ErrorCode } from "../contracts/index.ts";

// Throw this anywhere in a route to answer with our standard error shape.
export class ApiFailure extends Error {
  code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ApiFailure";
    this.code = code;
  }
}

export function sendError(res: Response, code: ErrorCode, message: string) {
  const body: ApiError = { error: { code, message } };
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
    sendError(res, err.code, err.message);
    return;
  }

  // Unexpected problem. Log only the error name and message: never request
  // bodies or CV text (our code never puts CV text into error messages).
  console.error("Unexpected error:", err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
  sendError(res, "INTERNAL_ERROR", "Something went wrong on the server. Please try again.");
};
