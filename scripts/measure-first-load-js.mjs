// Measures "First Load JS" per prerendered route.
//
// Next.js 16 removed the `size` / `First Load JS` columns from `next build`
// output (see node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md
// "Performance Improvements"). This script reconstructs an equivalent, stable
// figure directly from the build artifacts: for each prerendered HTML file it
// collects every <script src> under /_next/static, then sums the on-disk
// (raw) and gzipped bytes of those chunk files.
//
// "Shared" = the chunk set common to every route. Per-route = that route's
// full set (shared included), which is what First Load JS meant.
//
// Dev tooling only. Node stdlib only — adds no dependency.

import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, relative } from "node:path";
import { readdirSync } from "node:fs";

const root = process.cwd();
const appDir = join(root, ".next", "server", "app");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (entry.name.endsWith(".html")) out.push(p);
  }
  return out;
}

const sizeCache = new Map();
/** Chunks referenced by the HTML that could not be read. Any entry is fatal. */
const missing = [];
function sizes(chunkPath) {
  if (sizeCache.has(chunkPath)) return sizeCache.get(chunkPath);
  const abs = join(root, ".next", chunkPath.replace(/^\/_next\//, ""));
  let v;
  try {
    const buf = readFileSync(abs);
    v = { raw: statSync(abs).size, gzip: gzipSync(buf, { level: 9 }).length };
  } catch (err) {
    // Never count an unreadable chunk as zero bytes. Doing so *shrinks* a
    // route's total, which flatters the branch against a budget — a silently
    // passing measurement is worse than a failing one. Recorded and fatal.
    v = { raw: 0, gzip: 0, missing: true, error: String(err && err.message) };
    missing.push({ chunk: chunkPath, resolved: abs, error: v.error });
  }
  sizeCache.set(chunkPath, v);
  return v;
}

const routes = [];
for (const file of walk(appDir).sort()) {
  const html = readFileSync(file, "utf8");
  const scripts = new Set();
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    if (m[1].startsWith("/_next/static/")) scripts.add(m[1]);
  }
  const name =
    "/" +
    relative(appDir, file)
      .replace(/\.html$/, "")
      .replace(/^index$/, "");
  routes.push({ route: name, chunks: [...scripts].sort() });
}

// shared = chunks present in every route
const shared = routes.length
  ? routes[0].chunks.filter((c) => routes.every((r) => r.chunks.includes(c)))
  : [];

const sum = (list) =>
  list.reduce(
    (acc, c) => {
      const s = sizes(c);
      return { raw: acc.raw + s.raw, gzip: acc.gzip + s.gzip };
    },
    { raw: 0, gzip: 0 },
  );

const report = {
  buildId: readFileSync(join(root, ".next", "BUILD_ID"), "utf8").trim(),
  unit: "bytes",
  shared: { chunkCount: shared.length, ...sum(shared) },
  routes: routes.map((r) => ({
    route: r.route,
    chunkCount: r.chunks.length,
    ...sum(r.chunks),
  })),
};

if (missing.length) {
  console.error(
    `FATAL: ${missing.length} referenced chunk(s) could not be read. Counting a\n` +
      "chunk as 0 bytes would understate a route's First Load JS and could let a\n" +
      "budget pass that should have failed, so this exits non-zero instead.",
  );
  for (const m of missing)
    console.error(`  ${m.chunk}\n    -> ${m.resolved}\n    ${m.error}`);
  process.exit(1);
}

const kb = (n) => (n / 1024).toFixed(2).padStart(8) + " kB";
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`buildId ${report.buildId}`);
  console.log(
    `${"route".padEnd(34)}${"raw".padStart(11)}${"gzip".padStart(11)}`,
  );
  for (const r of report.routes) {
    console.log(`${r.route.padEnd(34)}${kb(r.raw)}${kb(r.gzip)}`);
  }
  console.log(
    `${"+ shared by all".padEnd(34)}${kb(report.shared.raw)}${kb(report.shared.gzip)}`,
  );
}
