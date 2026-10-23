import type { DraftProfile } from "../contracts/index.ts";
import type { SkillCatalogue } from "./llmAdapter.ts";

// Check a draft from the model before the graduate sees it:
// 1. Drop skills whose evidence is not really in the CV (the model made it up).
// 2. Drop skills whose evidence comes only from a line that gives orders to the AI
//    (prompt injection), with a warning that does not repeat the line.
// 3. Never pass on invented IDs: an unknown skill keeps its raw name, gets skillId null,
//    and the graduate gets a warning.
// cvText is the exact text the model saw. null skips checks 1 and 2: the mock adapter's
// evidence is fixed fiction (clearly labelled), not quotes from the uploaded CV.
export function cleanDraft(draft: DraftProfile, catalogue: SkillCatalogue, cvText: string | null): DraftProfile {
  const known = new Set(catalogue.map((s) => s.id));
  const warnings: string[] = [];

  // The CV without lines that look like instructions. Evidence must be found here.
  const lines = cvText?.split("\n") ?? [];
  const trustedText = normalise(lines.filter((line) => !looksLikeInstruction(line)).join("\n"));
  const fullText = normalise(cvText ?? "");

  // The model's own warnings may quote an injected line, so those are not passed on.
  for (const w of draft.warnings) {
    if (!looksLikeInstruction(w)) warnings.push(w);
  }

  const extractedSkills = [];
  for (const skill of draft.extractedSkills) {
    if (cvText !== null) {
      const evidence = normalise(skill.evidence);
      const onlyInSuspiciousLine = fullText.includes(evidence) && !trustedText.includes(evidence);
      if (looksLikeInstruction(skill.evidence) || onlyInSuspiciousLine) {
        warnings.push(SUSPICIOUS_LINE_WARNING);
        continue;
      }
      if (evidence === "" || !trustedText.includes(evidence)) {
        warnings.push(`"${skill.rawName}" was removed because its evidence was not found in your CV. Add it yourself if you have this skill.`);
        continue;
      }
    }

    if (skill.skillId !== null && known.has(skill.skillId)) {
      extractedSkills.push(skill);
    } else {
      warnings.push(`"${skill.rawName}" is not in the skill catalogue, so it is kept as written and not used for matching.`);
      extractedSkills.push({ ...skill, skillId: null });
    }
  }

  const projects = draft.projects.map((p) => ({ ...p, skillIds: p.skillIds.filter((id) => known.has(id)) }));

  if (extractedSkills.length === 0) {
    warnings.push("We did not find any skills in this CV. You can add your skills on the next screen.");
  }

  // new Set removes duplicate warnings.
  return { ...draft, extractedSkills, projects, warnings: [...new Set(warnings)] };
}

export const SUSPICIOUS_LINE_WARNING =
  "A line in your CV looked like an instruction to the AI, so it was ignored. Skills only come from what you did.";

// Lower case, one space between words, and no quote marks or dots around the ends,
// so small copying differences by the model do not count as "not found".
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’.,;:…-]+|[\s"'“”‘’.,;:…-]+$/g, "");
}

// Phrases that give orders to an AI rather than describe a person's work.
// Kept narrow on purpose, so normal CV lines are not caught.
const INSTRUCTION_PATTERNS = [
  /\b(ignore|disregard|forget|override)\b.{0,40}\b(instructions?|rules|prompts?|directions)\b/i,
  /\b(system prompt|developer message|jailbreak)\b/i,
  /\byou are (now )?(an? )?(ai|assistant|language model|chatbot)\b/i,
  /\b(list|add|include|mark|rate|treat|output|return)\b.{0,60}\bas (an? )?(expert|advanced|senior)\b/i,
  /\b(ai|model|assistant|llm)\s+(must|should)\b/i,
];

function looksLikeInstruction(text: string): boolean {
  return INSTRUCTION_PATTERNS.some((pattern) => pattern.test(text));
}
