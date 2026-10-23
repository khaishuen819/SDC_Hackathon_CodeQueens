// Load local secrets from .env (if the file exists) before anything reads process.env.
// On Replit there is no .env: Secrets are already environment variables.
// Variables that are already set win over values in .env.
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
