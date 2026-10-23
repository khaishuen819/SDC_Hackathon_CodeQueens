// FICTIONAL EXAMPLES. Not real people, CVs, sources, courses or statistics.
// One example per request and response, for M1 (frontend) to build against.
// They follow one fictional graduate ("Graduate A") from draft profile to pathway.
// Role weights, scores, hours and resources are ILLUSTRATIVE PLACEHOLDERS.
// example.com links are reserved example domains, not real resources.
// Checked against the schemas by examples.test.ts.

import {
  SCORE_MEANING,
  type ApiError,
  type ConfirmedProfile,
  type DraftProfile,
  type EvidenceListResponse,
  type MatchRequest,
  type MatchResponse,
  type PathwayRequest,
  type PathwayResponse,
  type SdgResponse,
} from "./index.ts";

// POST /api/profile/extract: the request is a multipart file upload (field "cv"),
// so there is no JSON request example. Response:
export const exampleExtractResponse = {
  status: "draft",
  extractedSkills: [
    {
      skillId: "javascript",
      rawName: "JavaScript",
      evidence: "Built a course-booking web app in JavaScript (final-year project)",
      confidence: 0.9,
    },
    {
      skillId: "nodejs",
      rawName: "Node.js",
      evidence: "Wrote the booking app's backend with Node.js and Express",
      confidence: 0.85,
    },
    {
      skillId: "sql",
      rawName: "PostgreSQL",
      evidence: "Designed tables and queries in PostgreSQL for the booking app",
      confidence: 0.8,
    },
    {
      skillId: "git",
      rawName: "Git",
      evidence: "Used Git and GitHub for team coursework",
      confidence: 0.75,
    },
    {
      skillId: "testing-basics",
      rawName: "Jest",
      evidence: "Wrote unit tests with Jest for the booking API",
      confidence: 0.6,
    },
    {
      skillId: "python",
      rawName: "Python",
      evidence: "Introduction to Programming (Python), Year 1 module",
      confidence: 0.4,
    },
    {
      skillId: null, // not in our catalogue: kept as written, no invented ID
      rawName: "Figma",
      evidence: "Made wireframes in Figma",
      confidence: 0.7,
    },
  ],
  projects: [
    {
      title: "Course-booking web app (final-year project)",
      summary: "Fictional example project: a web app for booking university courses.",
      skillIds: ["javascript", "nodejs", "sql", "testing-basics"],
    },
  ],
  experience: [
    {
      title: "Teaching assistant",
      organisation: "Example University (fictional)",
      summary: "Helped first-year students in programming labs.",
    },
  ],
  warnings: [
    '"Figma" is not in the skill catalogue, so it is kept as written and not used for matching.',
  ],
} satisfies DraftProfile;

// The graduate reviewed the draft: removed Python (only one first-year module),
// added API basics, and marked Docker as "not sure". They prefer QA automation.
export const exampleConfirmedProfile = {
  status: "confirmed",
  confirmedSkills: [
    { skillId: "javascript", level: "intermediate" },
    { skillId: "nodejs", level: "beginner" },
    { skillId: "sql", level: "intermediate" },
    { skillId: "git", level: "intermediate" },
    { skillId: "testing-basics", level: "beginner" },
    { skillId: "api-basics", level: "beginner" },
  ],
  removedSkillIds: ["python"],
  addedSkillIds: ["api-basics"],
  unconfirmedSkillIds: ["docker"],
  entryPath: "preferred-route",
  preferredRouteId: "qa-automation",
  confirmedAt: "2026-10-23T10:00:00Z",
} satisfies ConfirmedProfile;

// POST /api/match
export const exampleMatchRequest = exampleConfirmedProfile satisfies MatchRequest;

export const exampleMatchResponse = {
  scoreMeaning: SCORE_MEANING,
  roles: [
    {
      roleId: "backend-development",
      rank: 1,
      score: 78,
      scoreExplanation:
        "Example only, with illustrative weights. Your confirmed skills cover 14 of this role's 18 " +
        "skill-weight points: 14 / 18 x 100 = 78 (rounded). Not counted: Docker (weight 2), which you " +
        "marked as not sure, and database design (weight 2), which you have not confirmed.",
      strengths: [
        { skillId: "nodejs", weight: 3, isRequired: true },
        { skillId: "sql", weight: 3, isRequired: true },
        { skillId: "api-basics", weight: 3, isRequired: true },
        { skillId: "git", weight: 2, isRequired: true },
        { skillId: "javascript", weight: 2, isRequired: false },
        { skillId: "testing-basics", weight: 1, isRequired: false },
      ],
      gaps: [{ skillId: "database-design", weight: 2, isRequired: false }],
      unconfirmedSkills: [{ skillId: "docker", weight: 2, isRequired: false }],
      preferredRouteKept: false,
    },
    {
      roleId: "qa-automation",
      rank: 2,
      score: 67,
      scoreExplanation:
        "Example only, with illustrative weights. Your confirmed skills cover 10 of this role's 15 " +
        "skill-weight points: 10 / 15 x 100 = 67 (rounded). Not counted: test automation (weight 3, " +
        "required) and CI/CD basics (weight 2). This is your preferred route, so it stays your route " +
        "even though backend development scores higher.",
      strengths: [
        { skillId: "testing-basics", weight: 3, isRequired: true },
        { skillId: "api-basics", weight: 2, isRequired: true },
        { skillId: "git", weight: 2, isRequired: true },
        { skillId: "javascript", weight: 2, isRequired: false },
        { skillId: "sql", weight: 1, isRequired: false },
      ],
      gaps: [
        { skillId: "test-automation", weight: 3, isRequired: true },
        { skillId: "ci-cd-basics", weight: 2, isRequired: false },
      ],
      unconfirmedSkills: [],
      preferredRouteKept: true,
    },
  ],
} satisfies MatchResponse;

// POST /api/pathway: the graduate keeps their preferred route.
export const examplePathwayRequest = {
  profile: exampleConfirmedProfile,
  roleId: "qa-automation",
} satisfies PathwayRequest;

export const examplePathwayResponse = {
  roleId: "qa-automation",
  steps: [
    {
      order: 1,
      skillId: "test-automation",
      why: "Required for QA automation and not in your confirmed profile. It has the highest weight of your gaps.",
      estimatedHours: 20,
      resources: [
        {
          resourceId: "placeholder-test-automation-1",
          title: "PLACEHOLDER: test automation basics",
          url: "https://example.com/placeholder/test-automation",
          provider: "Placeholder provider",
          cost: "unknown",
          sourceNote: "Placeholder. The content owner replaces this with a reviewed resource.",
          isPlaceholder: true,
        },
      ],
      prerequisites: ["testing-basics", "javascript"],
      evidence: [],
    },
    {
      order: 2,
      skillId: "ci-cd-basics",
      why: "Automated tests usually run in a CI/CD pipeline. You already have Git, which this builds on.",
      estimatedHours: 8,
      resources: [
        {
          resourceId: "placeholder-ci-cd-basics-1",
          title: "PLACEHOLDER: CI/CD basics",
          url: "https://example.com/placeholder/ci-cd-basics",
          provider: "Placeholder provider",
          cost: "unknown",
          sourceNote: "Placeholder. The content owner replaces this with a reviewed resource.",
          isPlaceholder: true,
        },
      ],
      prerequisites: ["git"],
      evidence: [{ evidenceId: "fictional-evidence-1" }],
    },
  ],
} satisfies PathwayResponse;

// GET /api/sdg (no request body). Goal names are the official UN SDG names;
// the role and skill links and their rationales are placeholders.
export const exampleSdgResponse = {
  goals: [
    { sdgId: "sdg-4", number: 4, name: "Quality Education" },
    { sdgId: "sdg-8", number: 8, name: "Decent Work and Economic Growth" },
    { sdgId: "sdg-9", number: 9, name: "Industry, Innovation and Infrastructure" },
  ],
  roleTags: [
    {
      roleId: "backend-development",
      sdgId: "sdg-9",
      rationale: "PLACEHOLDER rationale: backend developers build and maintain digital infrastructure. To be reviewed.",
      isPlaceholder: true,
    },
    {
      roleId: "qa-automation",
      sdgId: "sdg-8",
      rationale: "PLACEHOLDER rationale: a route into skilled technology work for graduates. To be reviewed.",
      isPlaceholder: true,
    },
  ],
  skillTags: [
    {
      skillId: "testing-basics",
      sdgId: "sdg-9",
      rationale: "PLACEHOLDER rationale: testing helps software infrastructure stay reliable. To be reviewed.",
      isPlaceholder: true,
    },
  ],
} satisfies SdgResponse;

// GET /api/evidence (no request body). Contract is PROPOSED, to be agreed with M3/M4.
export const exampleEvidenceResponse = {
  items: [
    {
      id: "fictional-evidence-1",
      title: "FICTIONAL example source (format only)",
      publisher: "Example Publisher (fictional)",
      url: "https://example.com/fictional/evidence-1",
      publishedDate: "2026-01-15",
      retrievedAt: "2026-10-23",
      supportedClaim: "Fictional claim used only to show the data format.",
      limitation: "Fictional. Not a real source and must not be shown as evidence.",
      linkedSkillIds: ["ci-cd-basics"],
    },
  ],
} satisfies EvidenceListResponse;

// Error response (any endpoint), e.g. a scanned PDF with no readable text.
export const exampleErrorResponse = {
  error: {
    code: "UNREADABLE_CV",
    message:
      "We could not read any text from this file. If it is a scanned PDF, please upload a text-based PDF or a .txt file.",
  },
} satisfies ApiError;
