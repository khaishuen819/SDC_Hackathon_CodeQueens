import type { DraftProfile } from "../contracts/index.ts";
import type { SkillCatalogue } from "./llmAdapter.ts";

// Make sure every skillId in a draft is a real catalogue ID. Never pass on invented IDs:
// an unknown skill keeps its raw name, gets skillId null, and the graduate gets a warning.
export function keepCatalogueIdsOnly(draft: DraftProfile, catalogue: SkillCatalogue): DraftProfile {
  const known = new Set(catalogue.map((s) => s.id));
  const warnings = [...draft.warnings];

  const extractedSkills = draft.extractedSkills.map((skill) => {
    if (skill.skillId !== null && known.has(skill.skillId)) return skill;
    warnings.push(`"${skill.rawName}" is not in the skill catalogue, so it is kept as written and not used for matching.`);
    return { ...skill, skillId: null };
  });

  const projects = draft.projects.map((p) => ({ ...p, skillIds: p.skillIds.filter((id) => known.has(id)) }));

  if (extractedSkills.length === 0) {
    warnings.push("We did not find any skills in this CV. You can add your skills on the next screen.");
  }

  // new Set removes duplicate warnings.
  return { ...draft, extractedSkills, projects, warnings: [...new Set(warnings)] };
}
