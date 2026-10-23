# M1 design: personas, journeys and screens

Owner: M1. Status: **DRAFT for team review** (23 Oct 2026). Deadline: **Sun 25 Oct 07:59:59 MYT**.
Built against M2's API (`src/server/contracts/`, `docs/m2-technical-notes.md`, M2's `TEAM_HANDOFF.md`).
Clickable prototype (fictional data): https://claude.ai/artifact/WPKowVBwzQGHfo1HnopeCv
Frontend code: `frontend/public/` (plain HTML, CSS and JavaScript, no build step).

---

## 1. Personas (fictional)

Both personas are **invented design examples**, not interview or survey findings. They match the
fictional sample CVs in `docs/sample-cvs/`. Background and route preference are separate: the app
calculates their results.

| | Jordan Lee (fictional) | Sam Rivera (fictional) |
|---|---|---|
| Background | CS fresh graduate, 2026. Course-booking web app (Node.js, Express, PostgreSQL, REST API). Intern on a Node.js service. | Software Engineering fresh graduate, 2026. Selenium + pytest UI tests in GitHub Actions. QA intern. |
| Route | **Has a route: Backend Development** | **Not yet: exploring** |
| Goal | "With AI writing more code, which backend skill should I learn next?" | "Show me how my skills fit each route, and why, before I pick." |
| Worry | A generic course list; not knowing what matters most. | A tool deciding for them; a score that sounds like a hiring chance. |
| Success | Sees what is not on their profile yet for backend, gets an ordered roadmap. | Compares both routes with reasons, chooses QA themself, gets a QA roadmap. |
| CV file | `backend-graduate.txt` | `qa-graduate.txt` (contains a deliberate prompt-injection test line) |

---

## 2. Flow (CV first, agreed with teammate 23 Oct)

Everyone uploads a CV first. The route question comes after the profile check.
This differs from the leader's handoff (route first for graduates with a goal): **tell M4.**

| # | Screen | User does | API |
|---|---|---|---|
| 1 | Upload CV | Picks a PDF/.txt (or a sample CV) | `POST /api/profile/extract` (+ `GET /api/roles` once) |
| 2 | Check profile | For each skill: I have it / Not sure / Remove (+ optional level). Adds skills the CV missed. Answers "Do you already have a route in mind?" (Backend / QA / Not yet). Confirms. | none (builds the confirmed profile) |
| 3a | Results: has a route | Sees "To learn for this route" first, then what they have, score + meaning. Optional comparison with the other route. | `POST /api/match` |
| 3b | Results: not yet | Sees both routes ranked, "closest match to your CV" on rank 1, reasons and gaps. Chooses a route. | `POST /api/match` |
| 4 | Roadmap | Follows a metro line of stations; clicks a station for details. SDG and sources below. | `POST /api/pathway`, `GET /api/sdg`, `GET /api/evidence` |

Navigation: a step bar (Upload CV → Check profile → Results → Roadmap) where reached steps are clickable,
plus a back button on every screen. Changing anything on the profile clears old results (never shown
as current) until the graduate confirms again.

---

## 3. Theme: metro map

- Each route is a **line** with a badge: **B** Backend Development (blue `#1E5AA8`), **Q** QA Automation
  (orange `#B84A00`). Blue/orange stay distinct for colour-blind users. Unknown future routes get a
  neutral badge with their first letter.
- Fonts: IBM Plex Sans (body), IBM Plex Sans Condensed (headings, station names), IBM Plex Mono (scores,
  sums, file names). Clean white/grey surfaces, dark ink `#1B1F24`.
- The step bar is itself a small metro line.
- **Roadmap map view:** a line that winds left→right, turns, right→left (4 stations per row on desktop,
  3 on tablet, 2 on phone). Order: *Your CV* terminus → stations already on the profile (filled) →
  *You are here* → stops to learn (rings; required stops bigger, grouped "Required" then "Optional") →
  *Goal* terminus. **⇄ interchange** = a skill that is on both lines.
- **Roadmap list view:** the same stations as a vertical list with the full "why" and resources.
- Clicking a station opens a **details panel**: status, why, resources, time, prerequisites, trend
  evidence, SDG links.

---

## 4. Rules on every screen

- `isPlaceholder: true` anywhere → amber "Sample data" banner; placeholder resources and SDG reasons
  get a "placeholder" tag; `example.com/placeholder` links are shown as text, not as real course links.
- Every score sits next to the `scoreMeaning` text from the API. Never a percentage "chance".
- Wording: "**not on your confirmed profile**" / "**to learn for this route**", never "missing".
- "Not sure" skills: tagged "**not sure: check if you know it**" (the backend keeps them in the
  pathway and its `why` says to check them first).
- The app never picks a route. "Closest match" is a label, not a selection.
- Skill names come from `GET /api/roles`; route list and names too (nothing hard-coded except line
  colours/letters).
- `estimatedHours: null` → "time not known yet". `prerequisites: []` → "not available yet".
- All text from the API (including CV quotes) is escaped before display.

## 5. Building the confirmed profile (Check profile screen)

| User choice | Goes into |
|---|---|
| Found skill → I have it | `confirmedSkills` (+ `level` if set) |
| Found skill → Not sure | `unconfirmedSkillIds` |
| Found skill → Remove | `removedSkillIds` |
| Other skill → I have it | `confirmedSkills` **and** `addedSkillIds` |
| Other skill → Not sure | `unconfirmedSkillIds` |
| Other skill → Leave | nothing (backend shows it as "not on your confirmed profile") |
| Route: Backend / QA | `entryPath: "preferred-route"`, `preferredRouteId` |
| Route: Not yet | `entryPath: "exploring"` |

Plus `status: "confirmed"`, `confirmedAt` (now). Duplicate draft skills are merged; `skillId: null`
skills are shown greyed ("not in our skill list") and never sent.

## 6. States and errors

Upload errors use `error.code` (and show `error.message`): UNSUPPORTED_FILE, FILE_TOO_LARGE,
UNREADABLE_CV (never continue to an empty profile), LLM_TIMEOUT / LLM_FAILED (retry), INVALID_INPUT,
network. The first call after a quiet period can take ~10 s (Neon/Replit wake up): every loading
screen says so. Match/pathway errors offer Retry and a way back. SDG/evidence failures only affect
their own panel.

## 7. Open questions

1. **Sub-topics** in the roadmap: the prototype shows SAMPLE sub-topics. The real app shows none until
   M3 supplies reviewed sub-topics and M2 adds them to the API. (M3, M2)
2. **Flow order** changed to CV first: confirm with the leader so the docs and pitch match. (M4)
3. **Connecting the frontend:** Option A (Express serves `frontend/public`, one line in `server.ts`
   after the API routes) requested from M2. (M2)
4. **Feature 6 (future scenarios):** no API and no owner yet. No screen designed.
5. **"Switch route" button** for a graduate with a route: currently comparison only. (leader)
6. Wording for two pilot lines: say "our two pilot career lines", not "the only careers". (team)

Resolved: frontend folder `frontend/`; `confidence` hidden (Gemini nearly always returns 1); SDG and
sources sit under the roadmap; skill level picker included (optional, does not change scores).
