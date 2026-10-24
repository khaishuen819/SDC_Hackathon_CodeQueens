import { createHash } from "node:crypto";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { Instant, isCalendarDate } from "../contracts/trends.ts";
import type { HttpFetcher, ProviderState, ResourceCandidate, SourceBatch, SourceItem } from "../contracts/trends.ts";
import { fetchBoundedText } from "./http.ts";
import { pilotConfig } from "./pilotConfig.ts";

// Configured publisher feeds. Dates and URLs always come from the feed itself.
export const SOURCE_PROVIDERS = [
  { providerId: "github-changelog", feedUrl: "https://github.blog/changelog/feed/", host: "github.blog" },
  { providerId: "jetbrains-ai", feedUrl: "https://blog.jetbrains.com/ai/feed/", host: "blog.jetbrains.com" },
] as const;
export const SOURCE_LIMITS = { maxBytes: 2 * 1024 * 1024, timeoutMs: 10_000, maxRedirects: 2, itemsPerFeed: 6, textChars: 4000,
  titleChars: 500, linksPerItem: 8, resourceLinks: 6, maxNesting: 64, futureSkewMs: 300_000 } as const;
export type SourceOptions = { now?: () => string; conditional?: boolean; timeoutMs?: number; resourceHosts?: string[] };

class SourceError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const bounds = (hosts: string[], timeoutMs: number) => ({ allowedHosts: hosts, maxBytes: SOURCE_LIMITS.maxBytes, timeoutMs, maxRedirects: SOURCE_LIMITS.maxRedirects });

function errorCode(error: unknown): string {
  if (error instanceof SourceError) return error.code;
  const message = error instanceof Error ? error.message : "";
  const status = /^Source HTTP (\d{3})\.$/.exec(message);
  if (status) return `http-${status[1]}`;
  if (/timed out/.test(message)) return "timeout";
  if (/size limit/.test(message)) return "too-large";
  if (/not permitted/.test(message)) return "host-not-allowed";
  if (/redirect limit/.test(message)) return "redirect-limit";
  if (error instanceof TypeError && /decode|encoded/i.test(message)) return "invalid-encoding";
  return "fetch-failed";
}

// Only XML's predefined and numeric entities are decoded. Publisher HTML is
// reduced to plain text and never rendered.
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_m, entity: string) => {
    const key = entity.toLowerCase();
    if (!key.startsWith("#")) return NAMED[key];
    const code = key[1] === "x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : "�";
  });
}
function plain(html: string): string {
  return decode(decode(html).replace(/<head\b[\s\S]*?<\/head\s*>/gi, " ").replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]*>/g, " ")).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}
function cut(text: string, max: number): string {
  const value = text.slice(0, max);
  return /[\ud800-\udbff]$/.test(value) ? value.slice(0, -1) : value;
}

// Provider + canonical URL is the source identity: drop fragments and
// tracking parameters, keep meaningful query data.
function canonicalUrl(raw: string, hosts: readonly string[]): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !hosts.includes(url.hostname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|mc_)/i.test(key) || ["fbclid", "gclid", "msclkid"].includes(key.toLowerCase())) url.searchParams.delete(key);
    }
    return url.href;
  } catch { return null; }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Strict RFC 822/2822 feed dates; Date.parse would roll impossible days forward.
export function parseFeedDate(value: string): string | null {
  const m = /^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s*)?(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+(?:([+-])(\d{2})(\d{2})|GMT|UTC?|Z)$/.exec(value.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2]);
  const [day, year, hour, minute, second] = [Number(m[1]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  const pad = (n: number) => String(n).padStart(2, "0");
  if (month < 0 || hour > 23 || minute > 59 || second > 59 || !isCalendarDate(`${year}-${pad(month + 1)}-${pad(day)}`)) return null;
  const offset = m[7] ? (m[7] === "-" ? -1 : 1) * (Number(m[8]) * 60 + Number(m[9])) * 60_000 : 0;
  return new Date(Date.UTC(year, month, day, hour, minute, second) - offset).toISOString();
}

const parser = new XMLParser({ ignoreAttributes: false, processEntities: false, htmlEntities: false, parseTagValue: false,
  parseAttributeValue: false, trimValues: true, maxNestedTags: SOURCE_LIMITS.maxNesting, isArray: (_name, path) => String(path) === "rss.channel.item" });
const value = (node: unknown): string => typeof node === "string" ? node :
  node && typeof node === "object" && typeof (node as Record<string, unknown>)["#text"] === "string" ? (node as Record<string, string>)["#text"] : "";

function parseFeed(xml: string): Record<string, unknown>[] {
  // Declarations are rejected before parsing; CDATA article text is data.
  if (/<!(DOCTYPE|ENTITY)/i.test(xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, ""))) throw new SourceError("dtd-not-allowed");
  if (XMLValidator.validate(xml) !== true) throw new SourceError("invalid-xml");
  let document: any;
  try { document = parser.parse(xml); } catch { throw new SourceError("invalid-xml"); }
  const channel = document?.rss?.channel;
  if (!channel || typeof channel !== "object") throw new SourceError("not-rss");
  return Array.isArray(channel.item) ? channel.item.filter((i: unknown) => i && typeof i === "object") : [];
}

function extractLinks(html: string, sourceId: string, hosts: string[]): SourceItem["extractedLinks"] {
  const links: SourceItem["extractedLinks"] = [];
  for (const match of decode(html).matchAll(/<a\b[^>]*?\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    const url = canonicalUrl(decode(match[2]), hosts);
    if (!url || links.some((l) => l.url === url)) continue;
    links.push({ linkId: `${sourceId}-l${links.length + 1}`, url, title: cut(plain(match[3]) || url, SOURCE_LIMITS.titleChars) });
    if (links.length === SOURCE_LIMITS.linksPerItem) break;
  }
  return links;
}

function toItems(xml: string, provider: (typeof SOURCE_PROVIDERS)[number], now: number, hosts: string[]): SourceItem[] {
  const items: SourceItem[] = [];
  for (const raw of parseFeed(xml)) {
    const url = canonicalUrl(decode(value(raw.link)), [provider.host]);
    const publishedAt = parseFeedDate(decode(value(raw.pubDate)));
    // Missing or far-future dates cannot support admission; age alone never excludes an item.
    if (!url || !publishedAt || Date.parse(publishedAt) > now + SOURCE_LIMITS.futureSkewMs || items.some((i) => i.canonicalUrl === url)) continue;
    const html = value(raw["content:encoded"]) || value(raw.description);
    const text = cut(plain(html), SOURCE_LIMITS.textChars), title = cut(plain(value(raw.title)), SOURCE_LIMITS.titleChars);
    if (!text || !title) continue;
    const sourceId = `${provider.providerId}-${sha256(url).slice(0, 16)}`;
    items.push({ sourceId, providerId: provider.providerId, canonicalUrl: url, title, publishedAt, dateBasis: "published", text,
      contentHash: sha256(text), extractedLinks: extractLinks(html, sourceId, hosts) });
    if (items.length === SOURCE_LIMITS.itemsPerFeed) break;
  }
  return items;
}

// Reads both feeds concurrently. A failed feed keeps its previous success time;
// cancellation by the caller aborts the whole read instead of faking failures.
export async function fetchSourceItems(previous: ProviderState[], fetcher: HttpFetcher, signal: AbortSignal, options: SourceOptions = {}): Promise<SourceBatch> {
  const at = Instant.parse((options.now ?? (() => new Date().toISOString()))());
  const hosts = options.resourceHosts ?? pilotConfig.resourceHosts;
  const results = await Promise.all(SOURCE_PROVIDERS.map(async (provider) => {
    const { errorCode: _old, ...prior } = previous.find((p) => p.providerId === provider.providerId) ??
      { providerId: provider.providerId, status: "failed" as const, lastAttemptAt: null, lastSuccessfulCheckAt: null };
    const headers: Record<string, string> = {};
    if (options.conditional !== false && prior.etag) headers["if-none-match"] = prior.etag;
    if (options.conditional !== false && prior.lastModified) headers["if-modified-since"] = prior.lastModified;
    try {
      const response = await fetchBoundedText(provider.feedUrl, { ...bounds([provider.host], options.timeoutMs ?? SOURCE_LIMITS.timeoutMs), headers }, fetcher, signal);
      if (response.status === 304) return { items: [], state: { ...prior, status: "unchanged" as const, lastAttemptAt: at, lastSuccessfulCheckAt: at } };
      if (response.status !== 200) throw new SourceError(`http-${response.status}`);
      const items = toItems(response.text, provider, Date.parse(at), hosts);
      const state: ProviderState = { providerId: provider.providerId, status: "ok", lastAttemptAt: at, lastSuccessfulCheckAt: at };
      const etag = response.headers.get("etag"), lastModified = response.headers.get("last-modified");
      if (etag) state.etag = etag;
      if (lastModified) state.lastModified = lastModified;
      return { items, state };
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      return { items: [], state: { ...prior, status: "failed" as const, lastAttemptAt: at, errorCode: errorCode(error) } };
    }
  }));
  return { items: results.flatMap((r) => r.items), providers: results.map((r) => r.state), resources: [] };
}

// Runs only for the items already selected for interpretation. Fetches links
// the publisher actually included, on configured free documentation hosts.
export async function fetchResourceCandidates(items: SourceItem[], fetcher: HttpFetcher, signal: AbortSignal, options: SourceOptions = {}): Promise<ResourceCandidate[]> {
  const checkedAt = Instant.parse((options.now ?? (() => new Date().toISOString()))());
  const hosts = options.resourceHosts ?? pilotConfig.resourceHosts;
  const links = items.flatMap((i) => i.extractedLinks).filter((l, n, all) => canonicalUrl(l.url, hosts) === l.url && all.findIndex((x) => x.url === l.url) === n)
    .slice(0, SOURCE_LIMITS.resourceLinks);
  const results = await Promise.all(links.map(async (link): Promise<ResourceCandidate | null> => {
    try {
      const page = await fetchBoundedText(link.url, bounds(hosts, options.timeoutMs ?? SOURCE_LIMITS.timeoutMs), fetcher, signal);
      if (page.status !== 200) return null;
      const text = cut(plain(page.text), SOURCE_LIMITS.textChars);
      const title = cut(plain(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(page.text)?.[1] ?? "") || link.title, SOURCE_LIMITS.titleChars);
      return text ? { linkId: link.linkId, url: link.url, title, text, contentHash: sha256(text), access: "free", checkedAt } : null;
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      return null;
    }
  }));
  return results.filter((r): r is ResourceCandidate => r !== null);
}
