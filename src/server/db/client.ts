// One shared Prisma client for the whole server and the seed script.
import "../env.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  // Fail at start-up with a clear message, not later on the first query.
  throw new Error("DATABASE_URL is not set. Put it in .env (local) or Replit Secrets.");
}

// Prisma 7 talks to PostgreSQL through a driver adapter (node-postgres).
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
