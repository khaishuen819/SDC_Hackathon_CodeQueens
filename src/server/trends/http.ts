export type FetchBounds = {
  allowedHosts: string[]; maxBytes: number; timeoutMs: number; maxRedirects: number; headers?: HeadersInit;
};
export type FetchedText = { url: string; status: number; headers: Headers; text: string; bytes: number };

function checkedUrl(value: string, hosts: string[], originalHost?: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      !hosts.includes(url.hostname) || (originalHost && url.hostname !== originalHost)) {
    throw new Error("Source URL or redirect is not permitted.");
  }
  return url;
}

function cancellable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

// Bounds apply to actual streamed (decoded-by-fetch) bytes and the whole request.
export async function fetchBoundedText(value: string, options: FetchBounds, fetcher: typeof fetch, caller: AbortSignal): Promise<FetchedText> {
  if (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1 || !Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0 ||
      !Number.isInteger(options.maxRedirects) || options.maxRedirects < 0) throw new Error("Invalid fetch bounds.");
  let url = checkedUrl(value, options.allowedHosts);
  const originalHost = url.hostname;
  caller.throwIfAborted();
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new Error("Source request timed out.")), options.timeoutMs);
  const signal = AbortSignal.any([caller, deadline.signal]);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    for (let redirects = 0; ; redirects++) {
      const response = await cancellable(fetcher(url.href, { headers: options.headers, signal, redirect: "manual" }), signal);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        void response.body?.cancel().catch(() => {});
        const location = response.headers.get("location");
        if (!location || redirects >= options.maxRedirects) throw new Error("Source redirect limit reached.");
        url = checkedUrl(new URL(location, url).href, options.allowedHosts, originalHost);
        continue;
      }
      if (response.status === 304) return { url: url.href, status: 304, headers: response.headers, text: "", bytes: 0 };
      if (!response.ok) { void response.body?.cancel().catch(() => {}); throw new Error(`Source HTTP ${response.status}.`); }
      const length = response.headers.get("content-length");
      if (length && Number(length) > options.maxBytes) { void response.body?.cancel().catch(() => {}); throw new Error("Source size limit exceeded."); }
      reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true });
      const parts: string[] = [];
      let bytes = 0;
      if (reader) for (;;) {
        const chunk = await cancellable(reader.read(), signal);
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > options.maxBytes) throw new Error("Source size limit exceeded.");
        parts.push(decoder.decode(chunk.value, { stream: true }));
      }
      parts.push(decoder.decode());
      return { url: url.href, status: response.status, headers: response.headers, text: parts.join(""), bytes };
    }
  } finally {
    clearTimeout(timer);
    if (reader) void reader.cancel().catch(() => {});
  }
}
