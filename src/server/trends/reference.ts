import { Instant } from "../contracts/criteria.ts";
import type { RoleReference } from "../contracts/trends.ts";
import { fetchBoundedText } from "./http.ts";

export const REFERENCE_VERSION = "31.0";
export const REFERENCE_URLS = ["task_statements", "software_skills"].map(name =>
  `https://www.onetcenter.org/dl_files/database/db_31_0_json/${name}.json`);
export const REFERENCE_ATTRIBUTION = "O*NET 31.0 Database, U.S. Department of Labor, Employment and Training Administration; CC BY 4.0 https://creativecommons.org/licenses/by/4.0/. Filtered to two occupations; pilot mappings are Code Queens adaptations, not endorsed by USDOL/ETA. https://www.onetcenter.org/license_db.html";
export type RoleReferenceRecord = RoleReference & { retrievedAt: string };
const occupations = new Set(["15-1252.00", "15-1253.00"]);
const text = (value: unknown, field: string): string => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Invalid reference ${field}.`);
  return value.trim();
};
function rows(value: unknown): Record<string, unknown>[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as any).row)) throw new Error("Reference table must contain row data.");
  return (value as any).row.filter((r: unknown) => r && typeof r === "object" && occupations.has((r as any).onetsoc_code));
}
function flag(value: unknown): boolean {
  if (value !== "Y" && value !== "N") throw new Error("Invalid reference software flag.");
  return value === "Y";
}
function date(value: unknown): { originalDate: string | null; datePrecision: "day" | "month" | "year" | "unknown" } {
  if (value === null || value === undefined || value === "") return { originalDate: null, datePrecision: "unknown" };
  const originalDate = text(value, "date");
  const datePrecision = /^\d{4}-\d{2}-\d{2}$/.test(originalDate) ? "day" : /^\d{4}-\d{2}$/.test(originalDate) ? "month" : /^\d{4}$/.test(originalDate) ? "year" : null;
  if (!datePrecision || Number.isNaN(Date.parse(originalDate))) throw new Error("Invalid reference date precision.");
  return { originalDate, datePrecision };
}

export function parseRoleReference(taskData: unknown, softwareData: unknown, retrievedAt: string): RoleReferenceRecord {
  Instant.parse(retrievedAt);
  const tasks = rows(taskData).map(r => {
    if (!Number.isSafeInteger(r.task_id) || Number(r.task_id) <= 0) throw new Error("Invalid reference task ID.");
    return { occupationId: text(r.onetsoc_code, "occupation"), taskId: String(r.task_id), text: text(r.task, "task"), taskType: r.task_type == null ? "Unknown" : text(r.task_type, "task type"), ...date(r.date_updated) };
  });
  const software = rows(softwareData).map(r => ({
    occupationId: text(r.onetsoc_code, "occupation"), name: text(r.workplace_example, "software"), hotTechnology: flag(r.hot_technology), inDemand: flag(r.in_demand),
  }));
  for (const id of occupations) {
    if (!tasks.some(t => t.occupationId === id) || !software.some(s => s.occupationId === id)) throw new Error("Reference missing a pilot occupation.");
  }
  if (new Set(tasks.map(t => `${t.occupationId}:${t.taskId}`)).size !== tasks.length) throw new Error("Duplicate reference task.");
  return { version: REFERENCE_VERSION, urls: [...REFERENCE_URLS], attribution: REFERENCE_ATTRIBUTION, retrievedAt, tasks, software };
}

export async function fetchRoleReference(fetcher: typeof fetch = fetch, signal: AbortSignal = new AbortController().signal): Promise<RoleReferenceRecord> {
  const data = await Promise.all(REFERENCE_URLS.map(async url => {
    const result = await fetchBoundedText(url, { allowedHosts: ["www.onetcenter.org"], maxBytes: 16 * 1024 * 1024, timeoutMs: 30_000, maxRedirects: 2 }, fetcher, signal);
    if (result.status !== 200) throw new Error("Reference import requires complete HTTP 200 content.");
    return JSON.parse(result.text);
  }));
  return parseRoleReference(data[0], data[1], new Date().toISOString());
}
