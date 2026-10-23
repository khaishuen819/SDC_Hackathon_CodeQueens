// CV extraction behind an adapter, so the AI provider can change.
// Choose with LLM_PROVIDER=gemini|mock (default mock, which needs no key).
import { GoogleGenAI } from "@google/genai";
import { DraftProfile } from "../contracts/index.ts";
import { ApiFailure } from "../routes/errors.ts";
import { SYSTEM_PROMPT, buildUserText } from "./prompt.ts";

// The skills the model may map to (from the database).
export type SkillCatalogue = Array<{ id: string; name: string }>;

export interface LlmAdapter {
  readonly name: "gemini" | "mock";
  extractProfile(cvText: string, skillCatalogue: SkillCatalogue): Promise<DraftProfile>;
}

export const LLM_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

// Sends one request to the model and returns its raw text reply.
// A separate function so tests can replace it and never call the real API.
export type CallModel = (request: {
  systemInstruction: string;
  userText: string;
  signal: AbortSignal;
}) => Promise<string | undefined>;

// The real call, with the official Google Gen AI SDK.
export function geminiCallModel(apiKey: string, model: string): CallModel {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ systemInstruction, userText, signal }) => {
    const response = await ai.models.generateContent({
      model,
      contents: userText,
      config: {
        systemInstruction,
        responseMimeType: "application/json", // ask for JSON only
        temperature: 0, // as repeatable as possible
        abortSignal: signal,
      },
    });
    return response.text;
  };
}

export class GeminiAdapter implements LlmAdapter {
  readonly name = "gemini";
  callModel: CallModel;
  timeoutMs: number;

  constructor(callModel: CallModel, timeoutMs = LLM_TIMEOUT_MS) {
    this.callModel = callModel;
    this.timeoutMs = timeoutMs;
  }

  async extractProfile(cvText: string, skillCatalogue: SkillCatalogue): Promise<DraftProfile> {
    const reply = await callWithTimeout(
      this.callModel,
      { systemInstruction: SYSTEM_PROMPT, userText: buildUserText(cvText, skillCatalogue) },
      this.timeoutMs,
    );
    return parseModelReply(reply);
  }
}

async function callWithTimeout(
  callModel: CallModel,
  request: { systemInstruction: string; userText: string },
  timeoutMs: number,
): Promise<string | undefined> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort(); // also tell the SDK to stop waiting
      reject(new ApiFailure("LLM_TIMEOUT", "The AI took too long to read your CV. Please try again."));
    }, timeoutMs);
  });

  try {
    return await Promise.race([callModel({ ...request, signal: controller.signal }), timeout]);
  } catch (err) {
    if (err instanceof ApiFailure) throw err;
    // Provider error (bad key, quota, network...). Log the message only, never the CV.
    console.error("LLM call failed:", err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
    throw new ApiFailure("LLM_FAILED", "The AI service could not read your CV right now. Please try again later.");
  } finally {
    clearTimeout(timer);
  }
}

// The model must return a DraftProfile without `status` (we add it).
const ModelReply = DraftProfile.omit({ status: true });

export function parseModelReply(reply: string | undefined): DraftProfile {
  let json: unknown;
  try {
    json = JSON.parse(reply ?? "");
  } catch {
    throw new ApiFailure("LLM_FAILED", "The AI returned an answer we could not read. Please try again.");
  }
  const result = ModelReply.safeParse(json);
  if (!result.success) {
    throw new ApiFailure("LLM_FAILED", "The AI returned an answer in the wrong format. Please try again.");
  }
  return { status: "draft", ...result.data };
}

// ---------------------------------------------------------------------------
// Mock: lets the app run without an API key. Clearly labelled, fictional.
// ---------------------------------------------------------------------------

export const MOCK_WARNING =
  "MOCK EXTRACTION (LLM_PROVIDER=mock): this is a fixed FICTIONAL profile. It was NOT read from your CV.";

export class MockAdapter implements LlmAdapter {
  readonly name = "mock";

  async extractProfile(_cvText: string, _skillCatalogue: SkillCatalogue): Promise<DraftProfile> {
    return {
      status: "draft",
      extractedSkills: [
        { skillId: "javascript", rawName: "JavaScript", evidence: "(mock) Built a web app in JavaScript", confidence: 0.9 },
        { skillId: "sql", rawName: "SQL", evidence: "(mock) Wrote SQL queries for a coursework project", confidence: 0.8 },
        { skillId: "git", rawName: "Git", evidence: "(mock) Used Git for team coursework", confidence: 0.7 },
        { skillId: "testing-basics", rawName: "Unit testing", evidence: "(mock) Wrote unit tests", confidence: 0.5 },
      ],
      projects: [
        {
          title: "(mock) Fictional coursework project",
          summary: "Fictional example project from the mock adapter.",
          skillIds: ["javascript", "sql"],
        },
      ],
      experience: [],
      warnings: [MOCK_WARNING],
    };
  }
}

// ---------------------------------------------------------------------------
// Choose the adapter from environment variables (once, at start-up).
// ---------------------------------------------------------------------------

export function createLlmAdapter(env: NodeJS.ProcessEnv = process.env): LlmAdapter {
  const provider = env["LLM_PROVIDER"] || "mock";
  if (provider === "mock") return new MockAdapter();
  if (provider === "gemini") {
    const apiKey = env["GEMINI_API_KEY"];
    const model = env["GEMINI_MODEL"];
    if (!apiKey || !model) {
      throw new Error("LLM_PROVIDER=gemini needs GEMINI_API_KEY and GEMINI_MODEL. Set them in .env or Replit Secrets.");
    }
    return new GeminiAdapter(geminiCallModel(apiKey, model));
  }
  throw new Error(`Unknown LLM_PROVIDER "${provider}". Use "gemini" or "mock".`);
}
