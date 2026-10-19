// Extracts the D1 acceptance figures from Lighthouse report JSON (plain or
// .json.gz). Every number printed is read straight out of the report — nothing
// is derived by hand. Usage:
//   node scripts/lh-summary.mjs design/reports/<dir>/lh-desktop-*.json.gz
// Prints one row per report plus a median row per form factor.
//
// Failed-request rule (BASELINE.md): a run with any failed request — status
// >= 400, or no status at all — is rejected. No URL is exempt by default.
// Rejected runs are listed and the script exits 1.
//
//   --tolerate-404 <path>   (repeatable) tolerate a 404 at exactly this URL
//                           path (on any origin), for one side of one PR only,
//                           when BASELINE.md records a ruling for it. A bare
//                           flag with no path is an error (exit 2). Nothing is
//                           tolerated
//                           unless it is passed here; the script holds no list.
//                           Tolerated requests are still counted and printed.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { gunzipSync } from "node:zlib";

const read = (f) => {
  const buf = readFileSync(f);
  return JSON.parse(
    (f.endsWith(".gz") ? gunzipSync(buf) : buf).toString("utf8"),
  );
};

// A report whose network-requests audit is missing or errored cannot show
// that no request failed, so it is rejected like a run with a failure.
const failedRequests = (r) => {
  const items = r.audits["network-requests"]?.details?.items;
  if (!Array.isArray(items)) {
    return [{ statusCode: undefined, url: "network-requests audit missing" }];
  }
  return items.filter((i) => !(i.statusCode > 0) || i.statusCode >= 400);
};

const args = process.argv.slice(2);
const tolerated = new Set();
for (let i; (i = args.indexOf("--tolerate-404")) >= 0;) {
  const path = args.splice(i, 2)[1];
  // A report file in place of the path means the path was forgotten.
  if (!path?.startsWith("/") || /\.json(\.gz)?$/.test(path)) {
    console.error("--tolerate-404 needs a URL path starting with /");
    process.exit(2);
  }
  tolerated.add(path);
}
const isTolerated = (i) =>
  i.statusCode === 404 &&
  URL.canParse(i.url) &&
  tolerated.has(new URL(i.url).pathname);
const files = args;
const rows = files.map((f) => {
  const r = read(f);
  const cat = (id) => r.categories[id]?.score;
  return {
    file: f,
    failed: failedRequests(r).filter((i) => !isTolerated(i)),
    tolerated: failedRequests(r).filter(isTolerated),
    form: r.configSettings.formFactor,
    performance: cat("performance"),
    accessibility: cat("accessibility"),
    bestPractices: cat("best-practices"),
    lcp: r.audits["largest-contentful-paint"].numericValue,
    cls: r.audits["cumulative-layout-shift"].numericValue,
    tbt: r.audits["total-blocking-time"].numericValue,
    fcp: r.audits["first-contentful-paint"].numericValue,
  };
});

const median = (nums) => {
  const s = [...nums].sort((a, b) => a - b);
  return s[(s.length - 1) >> 1];
};

const pct = (n) => (n == null ? "n/a" : String(Math.round(n * 100)));
const ms = (n) => n.toFixed(0) + " ms";

const header = [
  "report",
  "form",
  "perf",
  "a11y",
  "bp",
  "LCP",
  "CLS",
  "TBT",
  "failed",
  "tolerated",
];
const line = (c) => `| ${c.join(" | ")} |`;
console.log(line(header));
console.log(line(header.map(() => "---")));
for (const r of rows) {
  console.log(
    line([
      basename(r.file),
      r.form,
      pct(r.performance),
      pct(r.accessibility),
      pct(r.bestPractices),
      ms(r.lcp),
      r.cls.toFixed(4),
      ms(r.tbt),
      String(r.failed.length),
      String(r.tolerated.length),
    ]),
  );
}
// A median over a set that contains a rejected run is not a valid figure, so
// it is printed as n/a. The failed / tolerated columns are sums, not medians.
for (const form of [...new Set(rows.map((r) => r.form))]) {
  const g = rows.filter((r) => r.form === form);
  const valid = g.every((r) => r.failed.length === 0);
  const med = (pick, fmt) => (valid ? fmt(median(g.map(pick))) : "n/a");
  console.log(
    line([
      `**median (n=${g.length})**`,
      form,
      med((r) => r.performance, pct),
      med((r) => r.accessibility, pct),
      med((r) => r.bestPractices, pct),
      med((r) => r.lcp, ms),
      med(
        (r) => r.cls,
        (n) => n.toFixed(4),
      ),
      med((r) => r.tbt, ms),
      `sum ${g.reduce((n, r) => n + r.failed.length, 0)}`,
      `sum ${g.reduce((n, r) => n + r.tolerated.length, 0)}`,
    ]),
  );
}

if (tolerated.size > 0) {
  console.log(
    `\ntolerated 404 (BASELINE ruling): ${[...tolerated].join(", ")}`,
  );
}

const rejected = rows.filter((r) => r.failed.length > 0);
if (rejected.length > 0) {
  console.error(`\nREJECTED: ${rejected.length} run(s) with failed requests`);
  for (const r of rejected) {
    for (const i of r.failed) {
      console.error(
        `  ${basename(r.file)}: ${i.statusCode ?? "no status"} ${i.url}`,
      );
    }
  }
  process.exitCode = 1;
}
