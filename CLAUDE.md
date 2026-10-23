# CLAUDE.md — Code Queens (SDC Hackathon, Domain 1)

Product: helps CS fresh graduates choose which skill to learn next in the AI era.
Pilot routes: `backend-development`, `qa-automation`. Claude Code here assists M2 (backend + deployment).

## Working rules
- Never run `git add`, `git commit` or `git push`. M2 commits and pushes.
- One phase at a time. After each phase: STOP, list changed files, suggest a commit message, wait for "next phase".
- Another teammate uses Codex in this repo. Only edit files inside M2's paths, or files a phase explicitly names. Never reformat or tidy other files.
- Small changes, short comments, plain-language explanations. If unsure or a decision is open, ask. Do not guess.
- No secrets in files. Use env vars. `.env.example` holds placeholder names only. `.env` and `node_modules` stay git-ignored.
- Fictional CVs and data only. Never invent real sources, courses, links or statistics. Mark placeholders clearly.
- Check current official docs for package names and versions.

## Folder ownership (M2)
`src/server/**`, `prisma/**`, `docs/m2-technical-notes.md`, `.env.example`.
`server.ts` (root) stays the entry file: edit it only when a phase needs it, minimal lines. Never touch `README.md` unless asked.
Frontend = M1. Trend evidence (feature 2) = M3/M4; M2 only provides the API slot.

## Stack
Node 24 runs `.ts` directly via type stripping (no tsx, no build step): relative imports end in `.ts`;
erasable syntax only (no enums, namespaces, parameter properties). Type-check: `npx tsc --noEmit`. Tests: `node --test`.
TypeScript, Express 5, Zod, Prisma, PostgreSQL (Neon), Gemini API behind an adapter (`LLM_PROVIDER=gemini|mock`).
Before relying on a package API, check the installed version and its current official docs.

## Product rules
- A CV gives a DRAFT profile. The graduate corrects and confirms it. Matching and pathways use only the CONFIRMED profile (separate types).
- A skill missing from the CV is "unconfirmed", not zero ability.
- The graduate's chosen route is kept even if another route scores higher.
- A match score is NOT a hiring probability and must be explainable.
- Unreadable or unsupported CVs return a clear error, never an empty profile.
- CVs are processed in memory only. Never write uploads to disk or log their contents.

## Notes
Decisions, endpoints, progress and AI-assistance log: `docs/m2-technical-notes.md`.
