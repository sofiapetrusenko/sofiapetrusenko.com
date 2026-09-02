// Extracts the D1 acceptance figures from Lighthouse report JSON.
// Every number printed is read straight out of the report — nothing is
// derived by hand. Usage:
//   node scripts/lh-summary.mjs design/reports/<dir>/lh-desktop-*.json
// Prints one row per report plus a median row per form factor.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

const files = process.argv.slice(2);
const rows = files.map((f) => {
  const r = JSON.parse(readFileSync(f, "utf8"));
  const cat = (id) => r.categories[id]?.score;
  return {
    file: f,
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

const header = ["report", "form", "perf", "a11y", "bp", "LCP", "CLS", "TBT"];
const line = (c) =>
  `| ${c[0]} | ${c[1]} | ${c[2]} | ${c[3]} | ${c[4]} | ${c[5]} | ${c[6]} | ${c[7]} |`;
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
    ]),
  );
}
for (const form of [...new Set(rows.map((r) => r.form))]) {
  const g = rows.filter((r) => r.form === form);
  console.log(
    line([
      `**median (n=${g.length})**`,
      form,
      pct(median(g.map((r) => r.performance))),
      pct(median(g.map((r) => r.accessibility))),
      pct(median(g.map((r) => r.bestPractices))),
      ms(median(g.map((r) => r.lcp))),
      median(g.map((r) => r.cls)).toFixed(4),
      ms(median(g.map((r) => r.tbt))),
    ]),
  );
}
