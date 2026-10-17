// Known-answer test for scripts/contrast-audit.mjs, against
// scripts/fixtures/contrast-audit.html. Needs Chrome (as the audit does), so it
// runs on its own rather than under vitest:
//   node --test scripts/contrast-audit.selftest.mjs
// Node stdlib only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const fixture = readFileSync(join(here, "fixtures/contrast-audit.html"));

async function runAudit() {
  const server = createServer((_, res) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(fixture);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const out = join(mkdtempSync(join(tmpdir(), "contrast-selftest-")), "a.json");
  try {
    const code = await new Promise((resolve) =>
      execFile(
        process.execPath,
        [
          join(here, "contrast-audit.mjs"),
          base,
          "--routes",
          "/fixture",
          "--json",
          out,
        ],
        (err, stdout, stderr) => {
          if (stderr) process.stderr.write(stderr);
          resolve(err ? err.code : 0);
        },
      ),
    );
    return { code, report: JSON.parse(readFileSync(out, "utf8")) };
  } finally {
    server.close();
  }
}

// Every case the audit must see, in every view. Excluded: CASE-excluded-*.
const AUDITED = [
  "CASE-fail-4.39",
  "CASE-fail-4.498",
  "CASE-fail-html-sibling-fill",
  "CASE-fail-opacity",
  "CASE-fail-pressed-panel-b",
  "CASE-fail-role-panel-b",
  "CASE-fail-svg-sibling-rect",
  "CASE-fail-switch-on",
  "CASE-gutter",
  "CASE-pass-4.55",
  "CASE-pass-color-mix-fill",
  "CASE-pass-disclosure-button",
  "CASE-pass-disclosure-panel",
  "CASE-pass-large-3.10",
  "CASE-pass-pressed-panel-a",
  "CASE-pass-pressed-tab-a",
  "CASE-pass-pressed-tab-b",
  "CASE-pass-role-panel-a",
  "CASE-pass-role-tab-a",
  "CASE-pass-role-tab-b",
  "CASE-pass-svg-fill",
  "CASE-pass-switch",
];
const FAILING = AUDITED.filter((t) => t.startsWith("CASE-fail-"));
// The gutter case fails only where its column cap rises: at 1440 the cap is
// GUTTER_CAP 0.6 (4.47:1); at 768 it is ~0.097 (10.67:1); below 640 px the cap
// is COLUMN_CAP everywhere (11.76:1).
const expectedFailing = (width) =>
  (width === 1440 ? [...FAILING, "CASE-gutter"] : FAILING).sort();

const { code, report } = await runAudit();

for (const view of report.views) {
  const cases = view.nodes.filter((n) => n.text.startsWith("CASE-"));
  const r = Object.fromEntries(cases.map((n) => [n.text, n]));

  test(`@${view.width}: exactly the expected cases are audited`, () => {
    assert.deepEqual(cases.map((n) => n.text).sort(), AUDITED);
  });

  test(`@${view.width}: base + one state per inactive tab and switch`, () => {
    assert.equal(view.states, 4);
  });

  test(`@${view.width}: exactly the seeded failures fail`, () => {
    const failing = cases.filter((n) => n.ratio < n.min).map((n) => n.text);
    assert.deepEqual(failing.sort(), expectedFailing(view.width));
  });

  test(`@${view.width}: every case was hit-tested, none fell back`, () => {
    for (const n of cases) assert.equal(n.unsampled, 0, n.text);
  });

  test(`@${view.width}: ratios match the seeded values`, () => {
    const near = (text, value) =>
      assert.ok(
        Math.abs(r[text].ratio - value) < 0.01,
        `${text}: ${r[text].ratio} vs ${value}`,
      );
    near("CASE-fail-4.39", 4.39);
    assert.ok(r["CASE-fail-4.498"].ratio < 4.5);
    assert.ok(r["CASE-fail-4.498"].ratio > 4.49);
    near("CASE-pass-4.55", 4.55);
    assert.equal(r["CASE-pass-large-3.10"].min, 3);
    near("CASE-pass-large-3.10", 3.1);
    // Black on an 80% white color-mix() fill: 14.6:1 with the fill, 1.8:1 if
    // the fill were dropped.
    assert.ok(r["CASE-pass-color-mix-fill"].ratio > 14);
    // fg under a 50% opacity ancestor: 3.66:1 (9.61:1 if opacity were lost).
    near("CASE-fail-opacity", 3.66);
    // SVG text is read from `fill` (fg, 9.61:1), not `color` (near-black).
    near("CASE-pass-svg-fill", 9.61);
    for (const t of ["pressed-panel-b", "role-panel-b", "switch-on"]) {
      near(`CASE-fail-${t}`, 4.39);
    }
    // fg over a non-ancestor 60% white fill: 9.61:1 if the fill were missed.
    for (const t of ["svg-sibling-rect", "html-sibling-fill"]) {
      assert.ok(
        r[`CASE-fail-${t}`].ratio < 2.5,
        `${t}: ${r[`CASE-fail-${t}`].ratio}`,
      );
    }
    near("CASE-gutter", { 1440: 4.47, 768: 10.67, 390: 11.76 }[view.width]);
  });
}

test("the audit exits 1 because of the seeded failures", () => {
  assert.equal(code, 1);
  const total = report.views.reduce(
    (n, v) => n + expectedFailing(v.width).length,
    0,
  );
  assert.equal(report.failing, total);
});
