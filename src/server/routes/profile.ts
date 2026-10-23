import { Router, type RequestHandler } from "express";
import multer from "multer";
import { DraftProfile } from "../contracts/index.ts";
import { cleanDraft } from "../extraction/cleanDraft.ts";
import { MAX_CV_BYTES, readCvText } from "../extraction/cvText.ts";
import type { LlmAdapter, SkillCatalogue } from "../extraction/llmAdapter.ts";
import { ApiFailure } from "./errors.ts";

// What this route needs. Passed in (not imported) so tests can use a fake
// catalogue and adapter, with no database and no real AI.
export type ProfileRouteDeps = {
  adapter: LlmAdapter;
  loadCatalogue: () => Promise<SkillCatalogue>;
};

export function createProfileRouter(deps: ProfileRouteDeps) {
  const router = Router();

  // POST /api/profile/extract: one file in form field "cv" -> DraftProfile.
  router.post("/api/profile/extract", uploadOneCv, async (req, res) => {
    if (!req.file) {
      throw new ApiFailure("INVALID_INPUT", 'Send one PDF or .txt file in the form field "cv".');
    }

    const { text, warnings } = await readCvText(req.file);
    const catalogue = await deps.loadCatalogue();
    // Mock evidence is fixed fiction, not quotes from this CV, so it skips the evidence checks.
    const cvTextForChecks = deps.adapter.name === "mock" ? null : text;
    const draft = cleanDraft(await deps.adapter.extractProfile(text, catalogue), catalogue, cvTextForChecks);

    // Check our own output against the contract before sending it.
    res.json(DraftProfile.parse({ ...draft, warnings: [...warnings, ...draft.warnings] }));
  });

  return router;
}

// Multer keeps the upload in memory only (memoryStorage): it is never written to disk,
// and it is gone once the request ends.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CV_BYTES, files: 1 },
}).single("cv");

// Runs multer and turns its errors into our error codes.
const uploadOneCv: RequestHandler = (req, res, next) => {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return next(new ApiFailure("FILE_TOO_LARGE", "The file is larger than 2 MB. Please upload a smaller file."));
    }
    if (err instanceof multer.MulterError) {
      return next(new ApiFailure("INVALID_INPUT", 'Send exactly one file, in the form field "cv".'));
    }
    next(err);
  });
};
