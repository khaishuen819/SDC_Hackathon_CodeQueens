import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SourceItem, ResourceCandidate } from "../contracts/trends.ts";
import { fetchSourceItems, fetchResourceCandidates, SOURCE_PROVIDERS, parseFeedDate } from "./sources.ts";
import { rssFeed, item, RESOURCE_PAGE } from "./fixtures/feeds.ts";

const NOW = "2026-10-24T10:00:00Z";
const [GITHUB, JETBRAINS] = SOURCE_PROVIDERS;
type Reply = () => Response;
function fake(replies: Record<string, Reply>) {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    const reply = replies[String(url)];
    return reply ? reply() : new Response("missing", { status: 404 });
  }) as typeof fetch;
  return { fetcher, calls };
}
const ok = (body: string, headers: HeadersInit = {}): Reply => () => new Response(body, { status: 200, headers });
const run = (replies: Record<string, Reply>, previous = [] as Parameters<typeof fetchSourceItems>[0], options = {}) => {
  const f = fake(replies);
  return { f, result: fetchSourceItems(previous, f.fetcher, new AbortController().signal, { now: () => NOW, ...options }) };
};

test("feeds parse into bounded, hashed, sanitised source items with real publisher dates", async () => {
  const { result } = run({ [GITHUB.feedUrl]: ok(rssFeed([item(1, { title: "FICTIONAL A &amp; B &#8217;s update", link: "https://github.blog/changelog/fictional-1/?utm_source=rss&amp;id=7#top" })]), { etag: "\"v1\"", "last-modified": "Fri, 23 Oct 2026 00:00:00 GMT" }),
    [JETBRAINS.feedUrl]: ok(rssFeed([])) });
  const batch = await result;
  assert.equal(batch.items.length, 1);
  const [source] = batch.items;
  assert.deepEqual(SourceItem.parse(source), source);
  assert.equal(source.providerId, GITHUB.providerId);
  assert.equal(source.canonicalUrl, "https://github.blog/changelog/fictional-1/?id=7");
  assert.equal(source.title, "FICTIONAL A & B ’s update");
  assert.equal(source.publishedAt, "2026-10-02T10:00:00.000Z"); assert.equal(source.dateBasis, "published");
  assert.doesNotMatch(source.text, /[<>]|&amp;/); assert.match(source.text, /reproducible checks & inspect/);
  assert.equal(source.contentHash, createHash("sha256").update(source.text).digest("hex"));
  assert.deepEqual(source.extractedLinks.map((l) => l.url), ["https://developer.mozilla.org/en-US/docs/Web/HTTP/Status"]);
  assert.deepEqual(batch.resources, []);
  const github = batch.providers.find((p) => p.providerId === GITHUB.providerId)!;
  assert.deepEqual({ ...github }, { providerId: GITHUB.providerId, status: "ok", lastAttemptAt: NOW, lastSuccessfulCheckAt: NOW, etag: "\"v1\"", lastModified: "Fri, 23 Oct 2026 00:00:00 GMT" });
});

test("useful old items stay; missing, impossible and far-future dates never enter the batch", async () => {
  const items = [item(1, { pubDate: "Mon, 01 Jul 2019 08:00:00 +0000" }), item(2, { pubDate: undefined }), item(3, { pubDate: "Mon, 31 Feb 2025 10:00:00 +0000" }),
    item(4, { pubDate: "Sat, 24 Oct 2026 10:06:00 +0000" }), item(5, { pubDate: "Sat, 24 Oct 2026 10:04:00 +0000" }), item(6, { pubDate: "not a date" })];
  const batch = await run({ [GITHUB.feedUrl]: ok(rssFeed(items)), [JETBRAINS.feedUrl]: ok(rssFeed([])) }).result;
  assert.deepEqual(batch.items.map((s) => s.title), ["FICTIONAL update 1", "FICTIONAL update 5"]);
  assert.equal(batch.items[0].publishedAt, "2019-07-01T08:00:00.000Z");
});

test("publisher dates are parsed strictly with their offsets", () => {
  assert.equal(parseFeedDate("Fri, 23 Oct 2026 23:42:03 +0000"), "2026-10-23T23:42:03.000Z");
  assert.equal(parseFeedDate("23 Oct 2026 23:42 +0800"), "2026-10-23T15:42:00.000Z");
  assert.equal(parseFeedDate("Sat, 24 Oct 2026 01:00:00 GMT"), "2026-10-24T01:00:00.000Z");
  for (const bad of ["Mon, 31 Feb 2025 10:00:00 +0000", "Fri, 23 Foo 2026 10:00:00 +0000", "Fri, 23 Oct 2026 25:00:00 +0000", "", "2026-10-23"]) assert.equal(parseFeedDate(bad), null, bad);
});

test("feeds keep at most six dated items, collapse duplicate URLs and bound text", async () => {
  const long = "<p>" + "FICTIONAL words ".repeat(400) + "</p>";
  const items = [item(1, { body: long, title: "T".repeat(600) }), item(1, { link: item(1).link + "?utm_campaign=x#frag" }),
    ...[2, 3, 4, 5, 6, 7, 8].map((n) => item(n)), item(9, { link: "https://elsewhere.example/post" })];
  const batch = await run({ [GITHUB.feedUrl]: ok(rssFeed(items)), [JETBRAINS.feedUrl]: ok(rssFeed([])) }).result;
  assert.equal(batch.items.length, 6);
  assert.equal(new Set(batch.items.map((s) => s.canonicalUrl)).size, 6);
  assert.ok(batch.items.every((s) => new URL(s.canonicalUrl).hostname === "github.blog"));
  assert.ok(batch.items[0].text.length <= 4000); assert.ok(batch.items[0].title.length <= 500);
  assert.equal(new Set(batch.items.map((s) => s.sourceId)).size, 6);
});

test("HTTP 304 reuses validators, advances only the check and returns no items", async () => {
  const previous = [{ providerId: GITHUB.providerId, status: "ok" as const, lastAttemptAt: "2026-10-23T10:00:00Z", lastSuccessfulCheckAt: "2026-10-23T10:00:00Z", etag: "\"v1\"", lastModified: "Thu, 22 Oct 2026 00:00:00 GMT" }];
  const { f, result } = run({ [GITHUB.feedUrl]: () => new Response(null, { status: 304 }), [JETBRAINS.feedUrl]: ok(rssFeed([])) }, previous);
  const batch = await result;
  assert.equal(f.calls.find((c) => c.url === GITHUB.feedUrl)!.headers.get("if-none-match"), "\"v1\"");
  assert.equal(f.calls.find((c) => c.url === GITHUB.feedUrl)!.headers.get("if-modified-since"), "Thu, 22 Oct 2026 00:00:00 GMT");
  assert.deepEqual(batch.items, []);
  assert.deepEqual(batch.providers.find((p) => p.providerId === GITHUB.providerId), { ...previous[0], status: "unchanged", lastAttemptAt: NOW, lastSuccessfulCheckAt: NOW });
  const fresh = run({ [GITHUB.feedUrl]: ok(rssFeed([])), [JETBRAINS.feedUrl]: ok(rssFeed([])) }, previous, { conditional: false });
  await fresh.result;
  assert.equal(fresh.f.calls[0].headers.get("if-none-match"), null);
});

test("one failing feed is reported honestly while the other still succeeds", async () => {
  const previous = [{ providerId: GITHUB.providerId, status: "ok" as const, lastAttemptAt: "2026-10-23T10:00:00Z", lastSuccessfulCheckAt: "2026-10-23T10:00:00Z", etag: "\"v1\"" }];
  const deep = "<rss><channel>" + "<x>".repeat(70) + "</x>".repeat(70) + "</channel></rss>";
  const cases: Array<[Reply, string]> = [
    [() => new Response("down", { status: 503 }), "http-503"],
    [ok("<rss><channel><item><title>broken</item></channel></rss>"), "invalid-xml"],
    [ok("<?xml version=\"1.0\"?><!DOCTYPE rss [<!ENTITY x \"boom\">]><rss><channel></channel></rss>"), "dtd-not-allowed"],
    [ok(deep), "invalid-xml"],
    [ok("<html><body>not a feed</body></html>"), "not-rss"],
    [() => new Response("x".repeat(2 * 1024 * 1024 + 1), { status: 200 }), "too-large"],
    [() => new Response(null, { status: 302, headers: { location: "https://elsewhere.example/feed" } }), "host-not-allowed"],
  ];
  for (const [reply, code] of cases) {
    const batch = await run({ [GITHUB.feedUrl]: reply, [JETBRAINS.feedUrl]: ok(rssFeed([item(1, { link: "https://blog.jetbrains.com/ai/2026/10/fictional/" })])) }, previous).result;
    const github = batch.providers.find((p) => p.providerId === GITHUB.providerId)!;
    assert.deepEqual(github, { ...previous[0], status: "failed", lastAttemptAt: NOW, errorCode: code }, code);
    assert.equal(batch.items.length, 1, code); assert.equal(batch.items[0].providerId, JETBRAINS.providerId);
    assert.equal(batch.providers.find((p) => p.providerId === JETBRAINS.providerId)!.status, "ok");
  }
});

test("DOCTYPE text inside CDATA article content is data, not a declaration", async () => {
  const batch = await run({ [GITHUB.feedUrl]: ok(rssFeed([item(1, { body: "<p>FICTIONAL snippet: <!DOCTYPE html> appears in sample code.</p>" })])), [JETBRAINS.feedUrl]: ok(rssFeed([])) }).result;
  assert.equal(batch.items.length, 1); assert.match(batch.items[0].text, /appears in sample code/);
});

test("per-source timeouts fail that feed, while caller cancellation aborts the whole read", async () => {
  const hang = (async (_url: string, init?: RequestInit) => new Promise<Response>((_r, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)))) as typeof fetch;
  const batch = await fetchSourceItems([], hang, new AbortController().signal, { now: () => NOW, timeoutMs: 20 });
  assert.deepEqual(batch.providers.map((p) => [p.status, p.errorCode]), [["failed", "timeout"], ["failed", "timeout"]]);
  const caller = new AbortController();
  const pending = fetchSourceItems([], hang, caller.signal, { now: () => NOW });
  caller.abort(new Error("refresh cancelled"));
  await assert.rejects(pending, /refresh cancelled/);
});

test("resource enrichment fetches at most six extracted, allowed links for selected items only", async () => {
  const sources = (await run({ [GITHUB.feedUrl]: ok(rssFeed([1, 2, 3, 4].map((n) => item(n, {
    body: [1, 2].map((k) => `<a href="https://developer.mozilla.org/fictional-${n}-${k}">FICTIONAL guide ${n}.${k}</a>`).join(" ") })))), [JETBRAINS.feedUrl]: ok(rssFeed([])) }).result).items;
  const pages: Record<string, Reply> = {};
  for (const s of sources) for (const l of s.extractedLinks) pages[l.url] = ok(RESOURCE_PAGE);
  pages[sources[0].extractedLinks[0].url] = () => new Response("gone", { status: 410 });
  const f = fake(pages);
  const resources = await fetchResourceCandidates(sources, f.fetcher, new AbortController().signal, { now: () => NOW });
  assert.equal(f.calls.length, 6);
  assert.ok(f.calls.every((c) => sources.some((s) => s.extractedLinks.some((l) => l.url === c.url))));
  assert.equal(resources.length, 5);
  for (const r of resources) {
    assert.deepEqual(ResourceCandidate.parse(r), r);
    assert.equal(r.access, "free"); assert.equal(r.checkedAt, NOW); assert.equal(r.title, "FICTIONAL status guide");
    assert.doesNotMatch(r.text, /ignored\(\)|</); assert.match(r.text, /runnable example & verify/);
    assert.ok(sources.some((s) => s.extractedLinks.some((l) => l.linkId === r.linkId && l.url === r.url)));
  }
});
