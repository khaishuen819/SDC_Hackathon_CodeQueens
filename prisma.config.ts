// Prisma 7 CLI config (migrate, generate, seed). Prisma finds it in the project root.
import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Locally, read DATABASE_URL from .env. On Replit, Secrets are already env vars.
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Plain node runs the .ts seed (native type stripping, no tsx).
    seed: "node prisma/seed.ts",
  },
  datasource: {
    // `?? ""` so `prisma generate` works without a database. Migrate needs a real URL.
    url: process.env["DATABASE_URL"] ?? "",
  },
});
