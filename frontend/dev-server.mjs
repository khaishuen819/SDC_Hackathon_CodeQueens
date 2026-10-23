// Local development server for the frontend (M1). No dependencies.
// Serves frontend/public and forwards /api/* and /health to the backend, so the browser
// sees one address and no CORS is needed. In production, Express serves frontend/public itself.
//
//   node dev-server.mjs                      -> http://localhost:5173, backend = deployed Replit app
//   API_TARGET=http://localhost:3000 node dev-server.mjs   -> use a local backend instead

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 5173);
const API_TARGET = (process.env.API_TARGET ?? "https://sdc-hackathon-code-queens.replit.app").replace(/\/$/, "");
const PUBLIC_DIR = fileURLToPath(new URL("./public/", import.meta.url));

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

async function proxy(req, res) {
  // Pass the request body through as a stream (the CV upload is multipart).
  const headers = { ...req.headers };
  delete headers.host;
  try {
    const upstream = await fetch(API_TARGET + req.url, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
      duplex: "half",
    });
    const out = {};
    upstream.headers.forEach((value, key) => {
      if (key !== "content-encoding" && key !== "content-length" && key !== "transfer-encoding") out[key] = value;
    });
    res.writeHead(upstream.status, out);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Dev server could not reach the backend." } }));
    console.error("proxy error:", err.name, err.message);
  }
}

async function serveStatic(req, res) {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const file = normalize(join(PUBLIC_DIR, path === "/" ? "index.html" : path));
  if (!file.startsWith(PUBLIC_DIR.endsWith(sep) ? PUBLIC_DIR : PUBLIC_DIR + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
}

createServer((req, res) => {
  if (req.url.startsWith("/api/") || req.url === "/health") return proxy(req, res);
  return serveStatic(req, res);
}).listen(PORT, () => {
  console.log(`Frontend: http://localhost:${PORT}  (API -> ${API_TARGET})`);
});
