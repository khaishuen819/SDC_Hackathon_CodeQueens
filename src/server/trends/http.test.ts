import test from "node:test";
import assert from "node:assert/strict";
import { fetchBoundedText } from "./http.ts";

const bounds = { allowedHosts: ["reference.example"], maxBytes: 32, timeoutMs: 200, maxRedirects: 2 };
const signal = () => new AbortController().signal;
const fake = (run: (url: string, init?: RequestInit) => Response | Promise<Response>): typeof fetch =>
  (async (input, init) => run(String(input), init)) as typeof fetch;

test("bounded fetch returns actual URL, status, headers and text", async () => {
  const result = await fetchBoundedText("https://reference.example/data", bounds, fake((url, init) => {
    assert.equal(url, "https://reference.example/data");
    assert.equal(init?.redirect, "manual");
    return new Response("reference", { headers: { etag: "revision-1" } });
  }), signal());
  assert.equal(result.text, "reference"); assert.equal(result.bytes, 9);
  assert.equal(result.status, 200); assert.equal(result.headers.get("etag"), "revision-1");
});

test("unsafe source URLs are rejected before dispatch", async () => {
  let calls = 0;
  const fetcher = fake(() => { calls++; return new Response("wrong"); });
  for (const url of ["http://reference.example/x", "https://other.example/x", "https://u:p@reference.example/x", "https://reference.example:444/x"]) {
    await assert.rejects(fetchBoundedText(url, bounds, fetcher, signal()));
  }
  assert.equal(calls, 0);
});

test("same-host redirects work but cross-host and endless redirects fail", async () => {
  const result = await fetchBoundedText("https://reference.example/old", bounds, fake((url) =>
    url.endsWith("/old") ? new Response(null, { status: 302, headers: { location: "/new" } }) : new Response("new")), signal());
  assert.equal(result.url, "https://reference.example/new");
  await assert.rejects(fetchBoundedText("https://reference.example/x", bounds, fake(() =>
    new Response(null, { status: 302, headers: { location: "https://other.example/x" } })), signal()));
  await assert.rejects(fetchBoundedText("https://reference.example/x", bounds, fake(() =>
    new Response(null, { status: 302, headers: { location: "/again" } })), signal()));
});

test("stream size is enforced without trusting Content-Length", async () => {
  const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(20)); c.enqueue(new Uint8Array(20)); c.close(); } });
  await assert.rejects(fetchBoundedText("https://reference.example/data", bounds, fake(() => new Response(body)), signal()), /size/i);
});

test("deadline bounds a stalled request and caller cancellation prevents dispatch", async () => {
  await assert.rejects(fetchBoundedText("https://reference.example/data", { ...bounds, timeoutMs: 10 }, fake(() => new Promise(() => {})), signal()), /timed out/i);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(fetchBoundedText("https://reference.example/data", bounds, fake(() => assert.fail("must not dispatch")), cancelled.signal));
});

test("304 keeps its real status and failed HTTP responses do not become content", async () => {
  const result = await fetchBoundedText("https://reference.example/data", { ...bounds, headers: { "If-None-Match": "v1" } }, fake((_, init) => {
    assert.equal(new Headers(init?.headers).get("If-None-Match"), "v1"); return new Response(null, { status: 304 });
  }), signal());
  assert.equal(result.status, 304); assert.equal(result.text, "");
  await assert.rejects(fetchBoundedText("https://reference.example/data", bounds, fake(() => new Response("no", { status: 503 })), signal()), /503/);
});
