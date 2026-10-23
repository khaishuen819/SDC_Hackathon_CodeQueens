// Turn an uploaded CV (PDF or plain text) into text, in memory only.
// Nothing is written to disk and the text is never logged.
import { extractText, getDocumentProxy } from "unpdf";
import { ApiFailure } from "../routes/errors.ts";

export const MAX_CV_BYTES = 2 * 1024 * 1024; // 2 MB upload limit

// Text sent to the model is capped, to keep time and cost bounded.
// A normal CV is far shorter. Longer text is cut, with a warning.
export const MAX_CV_CHARS = 20_000;

// Fewer letters or digits than this, and we treat the file as unreadable
// (for example a scanned PDF, which holds images and no text).
const MIN_READABLE_CHARS = 30;

// The parts of a multer upload we use.
export type UploadedCv = { originalname: string; mimetype: string; buffer: Buffer };

export async function readCvText(file: UploadedCv): Promise<{ text: string; warnings: string[] }> {
  let raw: string;
  if (isPdf(file.buffer)) {
    raw = await pdfToText(file.buffer);
  } else {
    const decoded = looksLikeTextFile(file) ? decodeUtf8Text(file.buffer) : null;
    if (decoded === null) {
      throw new ApiFailure("UNSUPPORTED_FILE", "Please upload a PDF or a plain-text (.txt) file.");
    }
    raw = decoded;
  }

  let text = raw.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  const letters = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  if (letters < MIN_READABLE_CHARS) {
    throw new ApiFailure(
      "UNREADABLE_CV",
      "We could not read any text from this file. If it is a scanned PDF, please upload a text-based PDF or a .txt file.",
    );
  }

  const warnings: string[] = [];
  if (text.length > MAX_CV_CHARS) {
    text = text.slice(0, MAX_CV_CHARS);
    warnings.push("Your CV is very long, so only the first part was read. Please check the list of skills carefully.");
  }
  return { text, warnings };
}

// We check the file's first bytes ("%PDF-"), not just its name or type,
// because those come from the browser and can be wrong.
function isPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

function looksLikeTextFile(file: UploadedCv): boolean {
  return file.mimetype === "text/plain" || file.originalname.toLowerCase().endsWith(".txt");
}

// Returns the text, or null if the bytes are not valid UTF-8 text (e.g. an image renamed to .txt).
function decodeUtf8Text(buffer: Buffer): string | null {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return text.includes("\u0000") ? null : text;
  } catch {
    return null;
  }
}

async function pdfToText(buffer: Buffer): Promise<string> {
  try {
    // Copy into a plain Uint8Array: PDF.js may take ownership of the bytes it is given.
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch {
    // Broken or password-protected PDF.
    throw new ApiFailure(
      "UNREADABLE_CV",
      "We could not open this PDF. It may be damaged or password-protected. Please try another file.",
    );
  }
}
