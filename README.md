# [NextArc]
<!-- TODO: add the project name agreed by the team. -->

> Helps fresh CS graduates find source-backed skills to learn for a backend or QA career, by linking their current skills and interests to AI developments.
<!-- TODO: team to confirm this one-sentence description. -->

Built by **Code Queens** for **SDC Hackathon 2026** (XMUM AI Club).

---

## Team Information

| Field                  | Details                                     |
| ---------------------- | ------------------------------------------- |
| **Team Name**          | Code Queens                                 |
| **Team Domain**        | Domain 1 — "Aiversecity Future-Ready Workforce" |
| **SDG Track (1–17)**   | [PLACEHOLDER: main SDG number and name] <!-- TODO: add the main SDG number and name. --> |
| **Team Leader**        | Chew Khai Shuen                             |
| **University**         | Sunway University                           |
| **Number of Members**  | 4                                           |

## Links

| Resource          | Link                                           |
| ----------------- | ---------------------------------------------- |
| GitHub Repository | https://github.com/khaishuen819/SDC_Hackathon_CodeQueens |
| Live Demo         | https://sdc-hackathon-code-queens-1.replit.app |
| Slide Deck        | [PLACEHOLDER: slide deck link] <!-- TODO: add the slide deck link. --> |
| Demo Video        | [PLACEHOLDER: demo video link] <!-- TODO: add the demo video link. --> |

---

## Overview

### Who It Is For

Our target users are **fresh graduates**. For this hackathon we narrowed the scope to **CS students and graduates** who are heading towards one of two roles:

- **Backend Development**
- **QA Automation**

We chose only two roles on purpose. With a small scope, it is easier for us to test whether the matching is accurate and whether the recommendations make sense.

### Problem

Fresh graduates often struggle to connect developments in AI with practical decisions about their careers and learning.

- Some already have a career direction. They need to know **which skills to develop** for it.
- Some do not have a direction yet. They need help to **explore suitable routes** before they decide what to learn.

<!-- TODO: add sources for this problem statement (from M3/M4). Do not add numbers without a real source. -->

### Solution

Our app helps fresh graduates find **source-backed skills to learn**. It connects their current skills and career interests with relevant AI developments. For each recommendation, it explains **why it matters** and **how it supports a career route**.

How it works:

1. The graduate uploads a CV (PDF or .txt). AI (Gemini) reads it and suggests a **draft** list of skills.
2. The graduate checks the list, fixes it, and confirms it.
3. The backend scores the two roles, Backend Development and QA Automation, and explains each score.
4. The app gives an ordered learning pathway: which skill to learn first, and why.

The AI only makes a suggestion. The graduate always has the final say on their own skills.

> **Honest note:** The trend evidence part (the "source-backed" link to AI developments) is not filled with real data yet. The evidence API works but is empty. Real, reviewed and dated evidence will come from our trend evidence teammates (M3/M4).

### Key Features

- **CV skills intake** — Upload a CV. Gemini suggests a draft skill list, with a quote from the CV as evidence for each skill.
- **Profile check** — The graduate removes, adds, or marks skills as "not sure". Only this confirmed profile is used for scores.
- **Role matching** — A score for each role, with the sum shown, plus strengths and skills not on the confirmed profile.
- **Learning pathway** — Ordered steps for the chosen role: required skills first, then the most important ones.
- **SDG mapping** — Links roles and skills to the UN Sustainable Development Goals.
- **Trend evidence slot** — An API slot for reviewed, dated, cited AI-trend evidence. It is empty for now.

### How the Score Works

- Score = (weight of confirmed skills) / (weight of all the role's skills) × 100.
- The score is **never** a hiring probability. Every response says so.
- "Not sure" skills are not counted.
- A skill missing from the CV is called "not on your confirmed profile". It does not mean zero ability.
- If the graduate picked a preferred route, it is kept, even if another role scores higher.
- Draft and confirmed profiles are separate types. Only the confirmed profile is scored.
- CVs are processed in memory only. They are never saved or logged.

> **Note:** Resources, skill weights, prerequisites and SDG reasons are still **PLACEHOLDER** content.
> The app labels them as placeholder. Real data will come from M3/M4.

### Tech Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Frontend      | Plain HTML, CSS and JavaScript (ES modules), no build step <!-- TODO: M1 to confirm this is final. --> |
| Backend       | Node 24 (runs TypeScript directly), Express 5, Zod 4, multer, unpdf |
| Database      | PostgreSQL on Neon, with Prisma 7 |
| AI / Compute  | Gemini API (`@google/genai`), behind an adapter (`LLM_PROVIDER=gemini` or `mock`).  |
| Hosting / Dev | Replit (development and Replit Deployments, Autoscale) |

### AI Tools Used

- **Claude Code** (major) — helped write the backend, tests and docs.
- **Replit Agent** (minor) — the first scaffold commits.
- **Gemini API** — reads CVs in the app. We use the free tier.
  We only use fictional CVs. No real CVs are used.

---

## Project Structure

```
.
├── docs/
│   ├── m2-technical-notes.md   # Backend decisions, endpoints, AI-assistance log
│   └── sample-cvs/             # Two FICTIONAL sample CVs (.txt)
├── frontend/
│   ├── public/                 # The web app (index.html, styles.css, js/, samples/)
│   ├── checks/                 # Frontend checks (*.check.mjs)
│   ├── dev-server.mjs          # Local dev server, forwards /api to the backend
│   ├── DESIGN.md               # Frontend design notes
│   ├── README.md               # Frontend guide
│   └── package.json
├── prisma/
│   ├── migrations/             # Database migrations
│   ├── schema.prisma           # Database tables
│   └── seed.ts                 # Loads the (placeholder) reference data
├── src/
│   └── server/
│       ├── contracts/          # Zod schemas and JSON examples for every endpoint
│       ├── db/                 # Prisma client and database reads (generated/ = Prisma client)
│       ├── extraction/         # CV text reading, Gemini/mock adapter, prompt
│       ├── matching/           # Match score engine
│       ├── pathway/            # Learning pathway engine
│       ├── routes/             # Express routes and error handling
│       └── env.ts              # Loads .env locally
├── .env.example                # Environment variable names (placeholders only)
├── .gitignore
├── .replit                     # Replit run and deployment configuration
├── CLAUDE.md                   # Rules for the Claude Code assistant
├── LICENSE
├── package.json                # Node scripts and dependencies
├── package-lock.json
├── prisma.config.ts            # Prisma CLI configuration
├── server.ts                   # Application entry point
├── tsconfig.json
└── README.md
```

Backend tests are `*.test.ts` files next to the code they test.

<!-- TODO: add the submission/ folder and its proof-of-use PDFs to this tree once they exist. -->

### Architecture

```
User (browser)
   │
   ▼
Replit Deployment (Express, server.ts)
   ├── serves the frontend (frontend/public)
   ├── /api routes ──► Neon PostgreSQL (roles, skills, resources, SDGs)
   └── POST /api/profile/extract ──► Gemini API (draft skill list)
                │
                └──► Response returned to user
```

<!-- TODO: waiting for committee answer on whether RunPod is required -->

### API Endpoints

| Endpoint | What it does |
|---|---|
| `GET /health` | Alive check |
| `GET /api/roles` | The 2 roles, with skills and weights |
| `POST /api/profile/extract` | Upload a CV (multipart field `cv`, max 2 MB). Returns a draft profile |
| `POST /api/match` | Takes a confirmed profile. Returns a score per role |
| `POST /api/pathway` | Takes `{ profile, roleId }`. Returns ordered learning steps |
| `GET /api/sdg` | The 17 UN goals, with role and skill links |
| `GET /api/evidence` | Reviewed trend evidence (empty for now) |

Errors always look like `{ "error": { "code", "message", "details"? } }`.
Request and response examples: `src/server/contracts/examples.ts`.

---

## How to Run

### Option 1 — Run on Replit (Recommended)

1. Open the [Replit Project](https://replit.com/t/codequeens/repls/SDCHackathonCodeQueens-1), or import this repository via **Create Repl → Import from GitHub**.
2. Open the **Secrets** tab (🔒) and add the variables listed in `.env.example`:
   - `DATABASE_URL` (a PostgreSQL database with the migration and seed applied)
   - `LLM_PROVIDER` (`gemini`, or `mock` for a fixed fictional profile with no key)
   - `GEMINI_API_KEY` (only needed when `LLM_PROVIDER=gemini`)
   - `GEMINI_MODEL` (only needed when `LLM_PROVIDER=gemini`)
3. Click **Run**. Replit uses the `.replit` file to start `PORT=3000 npm start` (which runs `node server.ts`).

### Option 2 — Run Locally

You need Node 24 or newer and a PostgreSQL database (for example, a free Neon database).

```bash
# 1. Clone the repository
git clone https://github.com/khaishuen819/SDC_Hackathon_CodeQueens.git
cd SDC_Hackathon_CodeQueens

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env            # then fill in your values
                                # LLM_PROVIDER=mock needs no API key

# 4. Create the tables and load the placeholder data
npx prisma migrate deploy
npx prisma db seed

# 5. Run the app
npm start                       # http://localhost:3000
```

### Run Tests

```bash
npm test                        # 74 backend tests (no database or AI key needed)
npm run typecheck               # TypeScript type check
cd frontend && npm test         # 10 frontend checks
```

---

## How We Use Replit *(Required)*

- **Development:** We developed and tested the app in Replit.
- **Hosting:** The app is deployed with Replit Deployments (Autoscale) at the Live Demo link above.
- **Secrets:** `DATABASE_URL` and the Gemini key are stored in Replit Secrets, never in the code.

📄 Proof of use: [PLACEHOLDER: which proof-of-use files are really required, e.g. `submission/SDC2026_TeamName_Replit_POU.pdf`]
<!-- TODO: add the real proof-of-use file and link once the team knows which files are required. -->

---

## Challenges & Learnings

- **Narrowing the scope.** We first looked at many tech roles. We narrowed to CS graduates going for Backend Development or QA Automation. This makes it easier to test matching accuracy and recommendations.
- **Placeholder content.** Resources, weights, prerequisites and SDG reasons are placeholder until real data arrives. We label them clearly in the app and the API, instead of inventing data.
- **Gemini is not perfect.** It sometimes misses skills (for example, testing tools). It also always returns confidence 1. So the graduate must confirm the list, and we never show confidence as accuracy.
- **Replit: "Could not find run command".** We fixed it by adding a `[deployment]` block to `.replit`.
- **Replit: wrong Node version after the workspace move.** We pinned `nodejs-24` in `.replit`.
- **Replit: private deployment.** We set Sharing to Public so judges can open the demo.
- [PLACEHOLDER: what the team learned]
<!-- TODO: add what the team learned. -->

## Future Improvements

- [ ] Real, reviewed and dated AI-trend evidence, linked to each recommendation
- [ ] A fallback AI model when Gemini fails
- [ ] Manual skill entry in the UI
- [ ] More roles beyond Backend Development and QA Automation
- [ ] A "more than one future scenario" feature

## Team

| Name        | Role                | GitHub                                   |
| ----------- | ------------------- | ---------------------------------------- |
| Chew Khai Shuen | Team Leader, Docs, Trend evidence (M4) | [@khaishuen819](https://github.com/khaishuen819) |
| Jeremy Tey Jie Ming | Backend and Deployment (M2) | [@jeremytey](https://github.com/jeremytey) |
| Teoh Chia Sin | Frontend, Design, Pitch, Video (M1) | [@chiasinnnnn](https://github.com/chiasinnnnn) |
| Gan Yi Jong | Trend evidence and Docs (M3) | [PLACEHOLDER: GitHub username] <!-- TODO: add GitHub username. --> |

---

## Submission Checklist

- [ ] Team name, domain (Domain 1 / Domain 2) and SDG track filled in
- [ ] Slide deck link added
- [ ] Demo video link added
- [ ] Replit used, with proof of use in `submission/`
- [ ] RunPod used, with proof of use in `submission/`
- [ ] Preliminary submission completed (`SDC2026_TeamName_Preliminary.pdf`)
- [ ] Technology declaration completed (`SDC2026_TeamName_TechDeclaration.pdf`)
- [ ] Submission files renamed with your team name (replace `TeamName`)
- [ ] "How to Run" steps verified
- [ ] No API keys or secrets committed to the repository

## License

This project is licensed under the [Apache License 2.0](LICENSE).