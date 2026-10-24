# NextArc

Helps fresh graduates decide what to learn next by connecting their confirmed skills and career interests with source-backed guidance about changing AI capabilities.

Built by **Code Queens** for **SDC Hackathon 2026**, hosted by the XMUM AI Club. Our preliminary pilot supports **CS fresh graduates exploring Backend Development or QA Automation**.

## Team Information

| Field | Details |
|---|---|
| Team Name | Code Queens |
| Project | NextArc |
| Team Domain | Domain 1 — Aiversecity Future-Ready Workforce |
| SDG Track | **SDG 4 — Quality Education, Target 4.4** |
| Team Leader | Chew Khai Shuen |
| University | Sunway University |
| Number of Members | 4 |

Target 4.4 concerns relevant technical and vocational skills for work. Each supported role and recommended skill explains how its suggested practice can contribute to this target. A learning recommendation is not proof that a user has acquired a skill or improved their employment outcome. [UN Goal 4](https://sdgs.un.org/goals/goal4)

## Links and Submission Materials

| Resource | Link or status |
|---|---|
| Source repository | [SDC_Hackathon_CodeQueens](https://github.com/khaishuen819/SDC_Hackathon_CodeQueens) |
| Live application | [NextArc on Replit](https://sdc-hackathon-code-queens-1.replit.app/) |
| Replit workspace | [Team project](https://replit.com/t/codequeens/repls/SDCHackathonCodeQueens-1) |
| Replit proof of use | [SDC2026_CodeQueens_Replit_POU.pdf](submission/SDC2026_CodeQueens_Replit_POU.pdf) |
| Preliminary PRD | [SDC2026_CodeQueens_Preliminary.pdf](submission/SDC2026_CodeQueens_Preliminary.pdf) |
| Technical & Tools Declaration | [SDC2026_CodeQueens_TechDeclaration.pdf](submission/SDC2026_CodeQueens_TechDeclaration.pdf) |
| Slide deck | [SDC2026_CodeQueens_Slides.pdf](submission/SDC2026_CodeQueens_Slides.pdf) |
| YouTube pitch/demo | [NextArc pitch and demo video](https://youtu.be/6mnbyhZJxhc) |

Pending items are not completed submissions. Replace their status with working links when the final files and video are available.

## Problem and Pilot Scope

Fresh graduates may struggle to connect developments in AI with practical career and learning decisions. Someone with a career direction needs relevant learning priorities; an explorer needs understandable alternatives before choosing what to learn.

The [World Economic Forum's Future of Jobs Report 2025](https://www.weforum.org/publications/the-future-of-jobs-report-2025/) projects that 39% of workers' existing skill sets will change or become outdated during 2025–2030. This is a global employer outlook, not a measured result for CS fresh graduates or NextArc.

Our broader audience remains fresh graduates across disciplines. For the preliminary pilot, we focus on **CS fresh graduates and two routes: Backend Development and QA Automation**. A smaller scope lets us inspect role-task mappings, resources and recommendation behaviour. It does not establish measured matching accuracy or support for other careers. No new model training is required for this prototype.

## Key Features

| Domain 1 feature | Prototype behaviour and status |
|---|---|
| **1. Skills profile intake** | Fictional CV upload, Gemini/mock draft extraction, supporting excerpts, profile correction, adding/removing skills and explicit confirmation. Only the confirmed profile is used downstream. |
| **2. AI-trend signal layer** | Implemented public-feed retrieval, Gemini interpretation, fixed admission checks and versioned criteria. Sources, original dates where known and update status are displayed. Production interpretation is currently disabled; reviewed baseline evidence remains available. |
| **3. Future-role matching** | Explained equal-count coverage for backend and QA, skill gaps and optional possession questions. A user's preferred route remains available even when another ranks higher. |
| **4. Personalised reskilling pathway** | Prerequisites precede dependent steps, followed by required capabilities and other relevant learning. Links are real free/low-cost starting resources. Time is labelled as estimated practice effort, not guaranteed mastery time. |
| **5. SDG mapping** | Each supported role and recommended skill has a meaningful SDG explanation. The current pilot maps to **SDG 4, Target 4.4**. |
| **6. Handling uncertainty** | **Planned for the final round:** moderate and faster AI-adoption scenarios, with explicit assumptions, evidence and estimated effects on skills, roles and learning priorities. This feature is not currently implemented. |

The metro-map interface uses a career route as a line and a capability as a station. Shared capabilities are interchanges. The graduate chooses the route and learning actions.

## How the Score Works

**Coverage score = round(100 × confirmed admitted capabilities / all admitted capabilities for that route).**

- Every distinct admitted capability counts once. For example, seven confirmed out of ten gives 70%.
- **No importance weighting, proficiency bonus or penalty for unrelated extra skills.** Older weighted engine helpers remain in the source, but the versioned API supplies weight 1 and citation-only evidence without numerical adjustments.
- **Proficiency levels are informational only.** The Beginner/Intermediate/Advanced dropdown does not affect coverage scores or learning priorities.
- **Not sure, omitted and unanswered capabilities earn no credit yet, but do not block scores or pathways.** Their unconfirmed state remains distinguishable from an explicit Not yet answer; omission does not prove zero ability.
- Users can later confirm a capability without reuploading a CV. Choosing to learn it or opening a resource does not confirm possession.
- The percentage can change when a supported, distinct capability enters the role's criteria. We explain the criteria change and invite the user to confirm possession. A new article or renamed tool does not automatically add a criterion.
- Matching, pathways and citations use the same immutable criteria version. A coverage percentage describes our assessed pilot subset, **not proficiency, employability or a hiring probability**.

## Automated Sources and Update Behaviour

The intended connected pipeline is:

```text
GitHub Changelog / JetBrains AI feeds
                |
                v
Bounded retrieval -> Gemini interpretation -> fixed validation
                |
                v
Versioned role criteria in PostgreSQL
                |
                v
Confirmed-profile matching -> learning pathway -> sources and SDG explanations
```

Eligible refresh requests perform bounded work; this is not a claim of continuous real-time monitoring. Shared cooldown/in-flight controls prevent duplicate work, and bounded retries isolate failing articles. Routine incoming articles do not require manual per-article approval.

Admission checks examine source support, relevance to the pilot's occupational tasks, canonical identity and readiness of learning resources, prerequisites and SDG explanations. A new tool, alias or existing practice alone is insufficient to enlarge the scored capability list. A valid refresh may add no scored capability.

Useful older evidence retains its original date. Publication age alone does not prove a skill obsolete. Retrieval/check dates are separate; undated documentation is not given an invented publication date. On update failure, retain the last valid criteria with honest status and retry when eligible. There is no 24-hour expiry that erases valid criteria or resets the score. If no initial valid criteria exist, return an unavailable error rather than inventing a catalogue.

O*NET supplies broad U.S. occupational context; publisher feeds describe AI product capabilities. Neither alone establishes Malaysian graduate hiring demand or a measured forecast of job growth/decline.

## Architecture and Technology

| Layer | Technology and responsibility |
|---|---|
| Frontend | Plain HTML, CSS and JavaScript modules; profile review, results and metro roadmap; no frontend build step |
| Backend | Node.js 24+, TypeScript, Express 5, Zod, multer, unpdf |
| Database | Neon PostgreSQL with Prisma 7; reference content, criteria snapshots and shared refresh state |
| Application AI | Gemini through `@google/genai`; CV extraction and optional trend interpretation configured separately |
| Feed parsing | `fast-xml-parser`; bounded public-feed and resource retrieval |
| Hosting/development | Replit workspace/scaffold and Replit Deployments; GitHub source and incremental commit history |

```text
Browser
   |
   v
Replit deployment: Express serves the frontend and API
   |-- profile extraction ---------------------> Gemini API
   |-- roles / matching / pathways / sources ---> Neon PostgreSQL
   `-- eligible trend refresh
          |-- public publisher feeds and permitted resources
          |-- bounded Gemini interpretation and fixed checks
          `-- saved criteria version / update status in PostgreSQL
```

### Project Structure

```text
.
|-- docs/
|   |-- m2-technical-notes.md       # Contracts, provenance and tool-use records
|   |-- feature-2-progress.md       # Dated implementation/verification history
|   `-- sample-cvs/                # Fictional profiles
|-- frontend/
|   |-- public/                    # HTML/CSS/JS, versioned journey and samples
|   |-- checks/                    # Frontend checks
|   |-- fixtures/criteria-server.mjs # Fictional local verification server
|   `-- dev-server.mjs             # Static frontend and configurable API proxy
|-- prisma/
|   |-- migrations/                # Reference and criteria-snapshot tables
|   |-- schema.prisma
|   `-- seed.ts                    # Legacy demo rows; not criteria bootstrap
|-- scripts/
|   |-- import-role-reference.ts
|   `-- bootstrap-criteria.ts      # Explicit verified-baseline bootstrap
|-- src/server/
|   |-- contracts/                 # Input/output validation and examples
|   |-- db/                        # Prisma client and legacy reference readers
|   |-- extraction/                # In-memory CV reading and model adapters
|   |-- matching/                  # Reusable score engine
|   |-- pathway/                   # Reusable pathway engine
|   |-- routes/                    # Versioned HTTP API and error handling
|   `-- trends/                    # Sources, rules, snapshots, refresh and presentation
|-- submission/
|   |-- SDC2026_CodeQueens_Preliminary.pdf
|   |-- SDC2026_CodeQueens_Replit_POU.pdf
|   |-- SDC2026_CodeQueens_TechDeclaration.pdf
|   `-- SDC2026_CodeQueens_Slides.pdf
|-- .env.example
|-- .replit
|-- LICENSE
|-- package.json
`-- server.ts                      # Application entry point and static serving
```

The tree lists currently tracked submission files. Add final PDFs and accessible presentation/video links when completed.

### API Endpoints and Criteria Versions

| Endpoint | Purpose |
|---|---|
| `GET /health` | Server health check; does not certify model/database behaviour |
| `GET /api/roles` | Pilot roles, one-point associations, complete recognised-skills catalogue and criteria metadata |
| `POST /api/profile/extract` | Multipart `cv` upload, maximum 2 MB; returns a labelled draft profile |
| `POST /api/match` | Confirmed-profile fields plus criteria context; returns explained role coverage |
| `POST /api/pathway` | `{ profile, roleId, snapshotId, criteriaReview }`; ordered learning steps for the selected route |
| `GET /api/sdg` | Mapped goals and role/skill explanations; the current baseline maps to Goal 4 |
| `GET /api/evidence` | Saved source evidence with provenance, date precision and criteria metadata |
| `GET /api/trends` | Current criteria version, provider status, notices and refresh availability |
| `POST /api/trends/refresh` | Empty body; bounded shared refresh, with no CV/profile or caller-supplied URLs |
| `POST /api/trends/reconcile` | `{ profile, review }`; reconciles possession answers with a target criteria version |

Obtain the actual snapshot ID from `GET /api/trends` or roles metadata. Match/pathway requests should supply `snapshotId` and a `criteriaReview` with `targetSnapshotId` and `answers`; `fromSnapshotId` is optional when moving from a saved version. Answers use `have`, `not-yet` or `not-sure`. Never invent snapshot IDs. Reference readers accept `?snapshotId=...` to keep sources and SDGs pinned to the same version.

Missing or mismatched criteria context can return HTTP 409 with `review` and its target version. Saved immutable versions remain usable when available. These questions are optional possession guidance; they do not impose a score-blocking answer gate. Unavailable storage or no initial criteria returns an unavailable error. Ordinary errors retain `{ "error": { "code", "message", "details"? } }`; version-context errors additionally carry the validated review payload. See [contracts](src/server/contracts/) and the [technical notes](docs/m2-technical-notes.md).


## Try the Live App

**[Open NextArc](https://sdc-hackathon-code-queens-1.replit.app/)** — no local installation is needed to try the deployed prototype.

1. Choose **Jordan (fictional)** or **Sam (fictional)**, or upload another fictional CV: a text PDF or UTF-8 `.txt`, maximum 2 MB.
2. Review the extracted skills. Correct mistakes, remove incorrect entries, add omissions and confirm your profile.
3. Keep a preferred career route or explore the two explained role matches.
4. Choose a route and inspect its learning roadmap, prerequisites, estimated practice time, resources, sources and SDG explanations.
5. If a suggested capability is already familiar, confirm possession later to update your coverage without another CV upload.

Use fictional CVs only. Our application processes uploads in memory and does not save CV files or profiles to its database. With Gemini extraction enabled, CV text is sent to Google's API; provider data handling depends on the configured service terms and tier.

### Current Prototype Status

**Deployment checked 25 October 2026 MYT:** the public application and reviewed baseline are available. The baseline recognises 16 capabilities and assesses eight capabilities per pilot route, with real learning links, prerequisites and SDG explanations.

**Automatic trend interpretation is currently disabled in production.** The fetching, interpretation, validation, storage and frontend integration are implemented, but the deployed service reports `status: disabled` and no successful update check. Baseline evidence is available; it is not a demonstration of freshly interpreted AI news. Live model acceptance, interpretation quality and a visible source-to-advice refresh still need verification before that capability is presented as working live.

## How to Run

### Option 1 — Use the live app (recommended for judges)

Open **[NextArc](https://sdc-hackathon-code-queens-1.replit.app/)**. No installation or account is needed. Use the fictional sample CVs (Jordan or Sam), or upload another fictional CV.

### Option 2 — Run on Replit

1. Open the [Replit workspace](https://replit.com/t/codequeens/repls/SDCHackathonCodeQueens-1), or import this repository with **Create Repl → Import from GitHub**.
2. In **Secrets**, add the variables listed under *Configuration* below.
3. In the **Shell**, prepare the database once:
   ```bash
   npm install
   npx prisma migrate deploy
   npm run criteria:bootstrap -- --apply
   ```
4. Press **Run** for a private preview, or **Publish** to deploy. `.replit` pins Node 24 and starts the app with `npm start`.

### Option 3 — Run locally

You need **Node.js 24 or newer** and a **PostgreSQL database** (a free [Neon](https://neon.tech) database works).

```bash
git clone https://github.com/khaishuen819/SDC_Hackathon_CodeQueens.git
cd SDC_Hackathon_CodeQueens
npm ci
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
```

Edit `.env` (see *Configuration*), then prepare the database once and start the app:

```bash
npx prisma migrate deploy               # creates the tables
npm run criteria:bootstrap -- --apply   # stores the verified 16-skill baseline
npm start                               # http://localhost:3000
```

- `npm run criteria:bootstrap` without `--apply` only reports whether a criteria version exists. With `--apply` it stores the baseline **only if none exists**; it never replaces an existing version.
- The legacy `npx prisma db seed` is **not** needed and does not set up the new criteria.
- The app does not set up the database automatically on startup. Without the two commands above, pages return "criteria unavailable".

### Configuration

Set these in `.env` (local) or Replit **Secrets**. Never commit real values.

| Variable | Needed for | Example / notes |
|---|---|---|
| `DATABASE_URL` | Always | PostgreSQL connection string, e.g. from Neon |
| `LLM_PROVIDER` | CV reading | `mock` (default, no key: a fixed, labelled fictional profile) or `gemini` |
| `GEMINI_API_KEY` | Gemini | Only when `LLM_PROVIDER=gemini` or `TREND_PROVIDER=gemini` |
| `GEMINI_MODEL` | Gemini CV reading | A current Gemini model ID; free tier needs a Flash model |
| `TREND_PROVIDER` | AI-news updates | `disabled` (default) or `gemini` |
| `TREND_GEMINI_MODEL` | Gemini trend updates | Only when `TREND_PROVIDER=gemini` |

**Quickest local trial:** set only `DATABASE_URL`, and leave `LLM_PROVIDER=mock` and `TREND_PROVIDER=disabled`. No Gemini key is needed.

### Frontend-only development (optional)

To work on the frontend against the live backend:

```bash
API_TARGET=https://sdc-hackathon-code-queens-1.replit.app npm --prefix frontend run dev
```

PowerShell: `$env:API_TARGET = "https://sdc-hackathon-code-queens-1.replit.app"; npm --prefix frontend run dev`. The page runs at `http://localhost:5173`. Use `API_TARGET=http://localhost:3000` for a local backend.


## Tests and Verification

```bash
npm test
npm run typecheck
npm --prefix frontend test
```

Latest recorded full verification, **24 October 2026**, at merged checkpoint `0aebfdb`:

| Check | Result |
|---|---|
| Backend | **210 passed, 0 failed, 9 skipped** |
| Frontend | **60 passed, 0 failed** |
| TypeScript | Passed |

The nine skipped checks require `TEST_DATABASE_URL` pointing to a disposable, migrated PostgreSQL database. They reset test data and must never use the team database. Run them sequentially; the independent-connection check additionally requires the documented concurrency setting. See `.env.example` and [store test setup](src/server/trends/testDatabase.ts).

The recorded checks use fictional inputs, mocked models and local fixtures. Live checks confirmed baseline roles, sources, one-point scores and a same-version pathway; **no live Gemini trend interpretation was established by those checks**. Passing tests do not establish matching accuracy, employment outcomes or measured learning benefit.

### Current Limitations and Remaining Preliminary Work

- Verify model/schema acceptance and a controlled live publisher-to-advice update before enabling and demonstrating production interpretation.
- Address reviewed error cases: a failed route switch can retain another route's cached roadmap; source processing has edge cases involving cross-route capability reuse, shared tutorial links and queue overflow with unchanged feeds.
- Complete disposable PostgreSQL/concurrency verification and the final submission documents/links. Historical progress-note headings describe their own checkpoints; the dated results above identify the scope of this README's verification claim.

## Challenges & Learnings

- **Choosing a testable scope.** Two CS-related routes let us inspect mappings, resources and the two entry paths without claiming coverage of every graduate career.
- **Separating tools from capabilities.** A product announcement or alternative name is not automatically a new scored skill. Canonical identities, occupational task bridges and content-readiness checks make admission explainable.
- **Keeping dynamic results consistent.** Roles, scores, learning steps and citations must share one criteria snapshot; the frontend also has to discard late replies and preserve explicit possession answers.
- **Handling failures and cost.** Shared refresh controls, bounded batches, retries and retained valid criteria support recovery. Fixtures establish behaviour under test; they do not certify live model quality.
- **Reviewing AI extraction.** The model can omit or misidentify skills. We treat its output as a draft, show supporting excerpts and let the graduate correct and confirm it. Model confidence is not verified accuracy or proficiency.
- **Replacing initial demo content.** The versioned baseline now has reviewed public resources, prerequisites and SDG rationales. Legacy placeholder rows are distinct from that baseline; provenance and app-estimated effort remain visible.
- **Deploying on Replit.** Earlier setup work added the deployment run command, pinned Node 24 and made the published demo accessible. Baseline release and live interpretation activation are separate verification steps.

## Future Improvements

### Required Final-Round Delivery

- [ ] Implement multiple future scenarios, such as moderate and faster AI adoption, with evidence and explicit assumptions. Label outlooks as estimates and explain supported changes in skills, roles and learning priorities, including emerging/declining directions where evidence supports them.

### Optional Expansion After the Pilot

- [ ] Add validated career routes, starting with more technical routes before considering other disciplines. New routes need occupational mappings, sources, resources, SDG content, configuration and journey tests.
- [ ] Evaluate a fallback model for provider outages with consistent validation and disclosure.
- [ ] Improve accessibility, language coverage and low-bandwidth usability.
- [ ] Broaden recommendation-quality and fairness evaluation before claiming wider applicability.

Manual skill entry and reviewed baseline content already exist. Current bugs, unfinished live activation and submission work are tracked above rather than presented as optional future enhancements.

## AI Tools, Data and Licensing

| Tool or source | Actual project use |
|---|---|
| Replit Agent | Initial application scaffold and Replit configuration |
| Claude Code | Backend, trend processing/storage and release-related development, tests and documentation as recorded in technical notes |
| Codex | Product/source research, rules and documentation; Feature 2 implementation/review across the recorded phases, including versioned backend and frontend integration |
| Gemini API | Application CV draft extraction and configurable interpretation of retrieved publisher text; model IDs come from `GEMINI_MODEL` and `TREND_GEMINI_MODEL` |

These development assistants are separate from the application's model service. The final Technical & Tools Declaration must record actual model identifiers, scope of use and human review; do not infer a model version or completed deployment from a tool name. Detailed assistance and provenance records are in [technical notes](docs/m2-technical-notes.md) and [feature history](docs/feature-2-progress.md).

- **O*NET 31.0 Database:** U.S. Department of Labor, Employment and Training Administration, used under **CC BY 4.0**. The data are filtered to software developer and QA occupations; junior-task/capability mappings, learning selections and SDG reasoning are team adaptations without USDOL/ETA endorsement. [Database](https://www.onetcenter.org/database.html) · [Attribution/licence guidance](https://www.onetcenter.org/license_db.html)
- **Publisher feeds:** [GitHub Changelog](https://github.blog/changelog/feed/) and [JetBrains AI](https://blog.jetbrains.com/ai/feed/). Publishers retain their content rights. Saved evidence uses source links, dates and brief supported interpretations; public availability is not a blanket open licence.
- **Learning resources:** linked provider documentation retains its own terms. The app's selected practice activities and time estimates are labelled team interpretations, not copied full courses or guaranteed completion times. [Baseline provenance](src/server/trends/data/baseline-provenance.json)
- **Software packages:** retain their individual notices, including MIT-licensed packages and Apache-2.0 components such as Prisma, TypeScript and the Gemini SDK. SDK licences are separate from API service terms.

The project's source code is licensed under the [Apache License 2.0](LICENSE). That licence does not relicense third-party datasets, articles or learning resources.

## Team

| Name | Role | GitHub |
|---|---|---|
| Chew Khai Shuen | Team Leader, Docs, Trend evidence (M4) | [@khaishuen819](https://github.com/khaishuen819) |
| Jeremy Tey Jie Ming | Backend and Deployment (M2) | [@jeremytey](https://github.com/jeremytey) |
| Teoh Chia Sin | Frontend, Design, Pitch, Video (M1) | [@chiasinnnnn](https://github.com/chiasinnnnn) |
| Gan Yi Jong | Trend evidence and Docs (M3) | [@yijong1115](https://github.com/yijong1115) |

## Submission Checklist

- [x] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [x] Slide deck link added
- [x] Demo video link added
- [x] Replit used, with proof of use in submission
- [x] Preliminary submission completed (SDC2026_TeamName_Preliminary.pdf)
- [x] Technology declaration completed (SDC2026_TeamName_TechDeclaration.pdf)
- [x] Submission files renamed with your team name (replace TeamName)
- [x] "How to Run" steps verified
- [x] No API keys or secrets committed to the repository
