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

const { code, report } = await runAudit();

for (const view of report.views) {
  const cases = view.nodes.filter((n) => n.text.startsWith("CASE-"));
  const texts = cases.map((n) => n.text).sort();

  test(`@${view.width}: exactly the expected cases are audited`, () => {
    assert.deepEqual(texts, [
      "CASE-fail-4.39",
      "CASE-fail-4.498",
      "CASE-pass-4.55",
      "CASE-pass-color-mix-fill",
      "CASE-pass-disclosure-button",
      "CASE-pass-disclosure-panel",
      "CASE-pass-large-3.10",
    ]);
  });

  test(`@${view.width}: exactly the seeded failures fail`, () => {
    const failing = cases.filter((n) => n.ratio < n.min).map((n) => n.text);
    assert.deepEqual(failing.sort(), ["CASE-fail-4.39", "CASE-fail-4.498"]);
  });

  test(`@${view.width}: ratios match the seeded values`, () => {
    const r = Object.fromEntries(cases.map((n) => [n.text, n]));
    assert.ok(Math.abs(r["CASE-fail-4.39"].ratio - 4.39) < 0.01);
    assert.ok(
      r["CASE-fail-4.498"].ratio < 4.5 && r["CASE-fail-4.498"].ratio > 4.49,
    );
    assert.ok(Math.abs(r["CASE-pass-4.55"].ratio - 4.55) < 0.01);
    assert.equal(r["CASE-pass-large-3.10"].min, 3);
    assert.ok(Math.abs(r["CASE-pass-large-3.10"].ratio - 3.1) < 0.01);
    // Black on an 80% white color-mix() fill: 14.6:1 with the fill, 1.8:1 if
    // the fill were dropped.
    assert.ok(r["CASE-pass-color-mix-fill"].ratio > 14);
  });
}

test("the audit exits 1 because of the seeded failures", () => {
  assert.equal(code, 1);
  assert.equal(report.failing, 2 * report.views.length);
});
