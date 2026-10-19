// Known-answer test for scripts/contrast-audit.mjs, against
// scripts/fixtures/contrast-audit.html. Needs Chrome (as the audit does), so it
// runs on its own rather than under vitest:
//   node --test scripts/contrast-audit.selftest.mjs
// Node stdlib only.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const fixture = readFileSync(join(here, "fixtures/contrast-audit.html"));
const exclusions = join(here, "fixtures/contrast-audit.exclusions.md");

// Pages the audit must refuse to pass: each makes the run fail, with a
// message matching its pattern, instead of auditing what it was given.
const page = (body, head = "") =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8" />` +
  `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
  `<title>refuse</title><style>body{background:#0d0d0f;color:#e8e8ea}</style>` +
  `${head}</head><body><main>${body}</main></body></html>`;
const REFUSED = {
  // A gradient fill behind text cannot be read off one colour.
  "/refuse-gradient": {
    status: 200,
    html: page(
      `<p style="background-image: linear-gradient(rgba(255,255,255,.6), rgba(255,255,255,.6))">CASE-refuse-gradient</p>`,
    ),
    error: /background-image/,
  },
  // elementsFromPoint never returns pseudo-elements.
  "/refuse-pseudo": {
    status: 200,
    html: page(
      `<p class="tint">CASE-refuse-pseudo</p>`,
      `<style>.tint{position:relative}.tint::before{content:"";position:absolute;inset:0;z-index:-1;background:rgba(255,255,255,.6)}</style>`,
    ),
    error: /::before paints a background/,
  },
  // The same checks reach every element beneath the text, not only its own:
  // a gradient on an ancestor, a gradient on a sibling painted underneath, and
  // a painting ::before on an ancestor.
  "/refuse-ancestor-gradient": {
    status: 200,
    html: page(
      `<div style="background-image: linear-gradient(rgba(255,255,255,.6), rgba(255,255,255,.6))"><p>CASE-refuse-ancestor-gradient</p></div>`,
    ),
    error: /div background-image/,
  },
  "/refuse-sibling-gradient": {
    status: 200,
    html: page(
      `<div style="position:relative"><div class="under" style="position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.6), rgba(255,255,255,.6))"></div><p style="position:relative">CASE-refuse-sibling-gradient</p></div>`,
    ),
    error: /div\.under background-image/,
  },
  "/refuse-ancestor-pseudo": {
    status: 200,
    html: page(
      `<div class="tint"><p>CASE-refuse-ancestor-pseudo</p></div>`,
      `<style>.tint{position:relative;z-index:0}.tint::before{content:"";position:absolute;inset:0;z-index:-1;background:rgba(255,255,255,.6)}</style>`,
    ),
    error: /div\.tint::before paints a background/,
  },
  // A server error page is not the route.
  "/refuse-500": {
    status: 500,
    html: page(`<p>CASE-refuse-500</p>`),
    error: /HTTP 500, expected 200/,
  },
  // A crashed render: the error screen is not the page.
  "/refuse-throws": {
    status: 200,
    html: page(
      `<p>CASE-refuse-throws</p><script>throw new Error("render crashed")</script>`,
    ),
    error: /uncaught exception in the page: Error: render crashed/,
  },
  // An exclusion that matches nothing in a view the run audited: the list
  // must not outlive what it excuses.
  "/refuse-stale-exclusion": {
    status: 200,
    html: page(`<p>CASE-refuse-stale-exclusion</p>`),
    error: /paint-above exclusion matched nothing: \/refuse-stale-exclusion @1440/,
  },
  // The 404 route must really be a 404.
  "/this-page-does-not-exist": {
    status: 200,
    html: page(`<p>CASE-refuse-soft-404</p>`),
    error: /HTTP 200, expected 404/,
  },
};

// Pages under paint above text, each with no contrast failure, so the run's
// exit code is decided by paint above alone. fg on bg throughout (9.61:1).
const under = (text, tag = "p", covers = ["cover-listed"]) =>
  `<div style="position:relative"><${tag} style="display:block;margin:0;color:#e8e8ea">${text}</${tag}>` +
  covers
    .map(
      (c) =>
        `<div class="${c}" style="position:absolute;inset:0;background:${c === "cover-listed" ? "linear-gradient(to top,#0d0d0f,transparent)" : "rgba(13,13,15,.6)"}"></div>`,
    )
    .join("") +
  `</div>`;
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const FILL = "position:absolute;inset:0;width:100%;height:100%";
const svg = (inner) => `<svg style="${FILL}">${inner}</svg>`;
const over = (text, overlay) =>
  `<div style="position:relative"><p style="margin:0;color:#e8e8ea">${text}</p>${overlay}</div>`;
// [case text, overlay, expected element, expected paints (prefix)]
const KINDS = [
  [
    "CASE-kind-svg-text",
    svg(
      // Its own glyphs are text too, so they are fg: the page has no
      // contrast failure.
      `<text x="0" y="18" font-size="24" fill="#e8e8ea">${"█".repeat(60)}</text>`,
    ),
    "text",
    "fill",
  ],
  [
    "CASE-kind-use",
    svg(
      `<defs><rect id="u" width="100%" height="100%" fill="rgba(13,13,15,.6)"/></defs><use href="#u"/>`,
    ),
    "use",
    "use",
  ],
  [
    "CASE-kind-image",
    svg(`<image href="${PNG}" width="100%" height="100%" preserveAspectRatio="none"/>`),
    "image",
    "image",
  ],
  [
    "CASE-kind-foreign-object",
    svg(
      `<foreignObject width="100%" height="100%" style="background:rgba(13,13,15,.6)"></foreignObject>`,
    ),
    "foreignobject",
    "background-color",
  ],
  [
    "CASE-kind-url-fill",
    svg(
      `<defs><linearGradient id="g"><stop offset="0" stop-color="#0d0d0f"/><stop offset="1" stop-color="#0d0d0f" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>`,
    ),
    "rect",
    "fill url(",
  ],
  ["CASE-kind-img", `<img alt="" src="${PNG}" style="${FILL}">`, "img", "img"],
  ["CASE-kind-canvas", `<canvas style="${FILL}"></canvas>`, "canvas", "canvas"],
  [
    "CASE-kind-pseudo",
    `<div class="pseudo-cover" style="${FILL}"></div>`,
    "div.pseudo-cover",
    "::before background",
  ],
];
const ABOVE = {
  // One entry, at 768: p "CASE-above-m" under div.cover-listed. Every other
  // node differs from it in exactly one matched field, so each stays covered.
  "/fixture-above-mismatch": page(
    under("CASE-above-m") +
      under("CASE-above-m", "span") +
      under("CASE-above-n") +
      under("CASE-above-m", "p", ["cover-listed", "cover"]) +
      // An entry's text and element, but that entry is for /fixture.
      under("CASE-above-excluded"),
  ),
  // Listed at every width: nothing is left covered, so the run passes.
  "/fixture-above-listed": page(under("CASE-above-ok")),
  // One node per kind of paint `paintsAbove` reads, each under an overlay of
  // that kind alone; and one under an overlay at opacity 0, which paints
  // nothing and must not cover.
  "/fixture-above-kinds": page(
    KINDS.map(([text, overlay]) => over(text, overlay)).join("") +
      over(
        "CASE-kind-opacity-0",
        `<div style="${FILL};background:rgba(13,13,15,.6);opacity:0"></div>`,
      ),
    `<style>.pseudo-cover::before{content:"";position:absolute;inset:0;background:rgba(13,13,15,.6)}</style>`,
  ),
};

async function runAudit(route) {
  const server = createServer((req, res) => {
    const path = new URL(req.url, "http://x").pathname;
    const refused = REFUSED[path];
    res.writeHead(refused?.status ?? 200, {
      "content-type": "text/html; charset=utf-8",
    });
    res.end(refused?.html ?? ABOVE[path] ?? fixture);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const out = join(mkdtempSync(join(tmpdir(), "contrast-selftest-")), "a.json");
  try {
    const { code, stderr } = await new Promise((resolve) =>
      execFile(
        process.execPath,
        [
          join(here, "contrast-audit.mjs"),
          base,
          "--routes",
          route,
          "--json",
          out,
          "--exclusions",
          exclusions,
        ],
        (err, stdout, stderr) => resolve({ code: err ? err.code : 0, stderr }),
      ),
    );
    const report = existsSync(out)
      ? JSON.parse(readFileSync(out, "utf8"))
      : null;
    return { code, stderr, report };
  } finally {
    server.close();
  }
}

// Every case the audit must see, in every view. Excluded: CASE-excluded-*.
const AUDITED = [
  "CASE-above-covered",
  "CASE-above-excluded",
  "CASE-above-polyline",
  "CASE-above-svg-background",
  "CASE-fail-4.39",
  "CASE-fail-4.498",
  "CASE-fail-html-sibling-fill",
  "CASE-fail-line5",
  "CASE-fail-opacity",
  "CASE-fail-pressed-panel-b",
  "CASE-fail-role-panel-b",
  "CASE-fail-svg-sibling-rect",
  "CASE-fail-switch-on",
  "CASE-gutter",
  "CASE-pass-4.55",
  "CASE-pass-anim-panel",
  "CASE-pass-color-mix-fill",
  "CASE-pass-disclosure-button",
  "CASE-pass-disclosure-panel",
  "CASE-pass-edge-anchor",
  "CASE-pass-edge-last-row",
  "CASE-pass-large-3.10",
  "CASE-pass-pressed-panel-a",
  "CASE-pass-pressed-tab-a",
  "CASE-pass-pressed-tab-b",
  "CASE-pass-reveal",
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

const { code, stderr, report } = await runAudit("/fixture");
// No report means the audit itself failed: say how, in the failure.
if (!report)
  throw new Error(`audit wrote no report (exit ${code}):\n${stderr}`);
if (stderr) process.stderr.write(stderr);
// A case is named by its first word; the rest of its text is only filler.
const name = (n) => n.text.split(/\s/)[0];

for (const view of report.views) {
  const cases = view.nodes.filter((n) => n.text.startsWith("CASE-"));
  const r = Object.fromEntries(cases.map((n) => [name(n), n]));

  test(`@${view.width}: exactly the expected cases are audited`, () => {
    assert.deepEqual(cases.map(name).sort(), AUDITED);
  });

  test(`@${view.width}: base + one state per inactive tab and switch`, () => {
    assert.equal(view.states, 4);
  });

  test(`@${view.width}: exactly the seeded failures fail`, () => {
    const failing = cases.filter((n) => n.ratio < n.min).map(name);
    assert.deepEqual(failing.sort(), expectedFailing(view.width));
  });

  test(`@${view.width}: every case was hit-tested, none fell back`, () => {
    for (const n of cases) {
      assert.equal(n.unmeasured, false, n.text);
      assert.equal(n.unsampled, 0, n.text);
    }
  });

  // Paint above text is detected, not composited: the covered case fails in
  // every view, the listed case only where its entry does not apply.
  test(`@${view.width}: paint above text covers, unless excluded`, () => {
    const covered = cases
      .filter((n) => n.above.length > 0)
      .map(name)
      .sort();
    assert.deepEqual(covered, [
      "CASE-above-covered",
      "CASE-above-excluded",
      "CASE-above-polyline",
      "CASE-above-svg-background",
    ]);
    assert.deepEqual(r["CASE-above-svg-background"].above.map((a) => a.element), [
      "svg",
    ]);
    assert.deepEqual(r["CASE-above-polyline"].above.map((a) => a.element), [
      "polyline",
    ]);
    assert.deepEqual(r["CASE-above-covered"].above.map((a) => a.element), [
      "div.cover",
    ]);
    assert.deepEqual(r["CASE-above-excluded"].above.map((a) => a.paints), [
      "background-image",
    ]);
    for (const n of cases) {
      if (!n.text.startsWith("CASE-above-")) assert.deepEqual(n.above, [], n.text);
    }
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
    // Swapped in mid-animation, measured at rest: the same 4.55:1, not the
    // faded value, and at the panel's resting position.
    near("CASE-pass-anim-panel", 4.55);
    // Moved by a scroll-driven animation while the audit scrolls to it.
    near("CASE-pass-reveal", 4.55);
    // Sample points on the viewport's last pixel row hit-test as empty; the
    // audit scrolls again rather than count the node as unmeasured.
    near("CASE-pass-edge-last-row", 4.55);
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
    // line5: the fill is under the paragraph's fifth line box only.
    for (const t of ["svg-sibling-rect", "html-sibling-fill", "line5"]) {
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
  assert.equal(report.unmeasured, 0);
  const total = report.views.reduce(
    (n, v) => n + expectedFailing(v.width).length,
    0,
  );
  assert.equal(report.failing, total);
  // CASE-above-covered, -polyline and -svg-background in all three views,
  // CASE-above-excluded at 1440 and 390; excluded at 768 only.
  assert.equal(report.covered, 11);
  assert.equal(report.excluded, 1);
});

test("paint above alone fails the run; an exclusion matches on every field", async () => {
  const run = await runAudit("/fixture-above-mismatch");
  assert.ok(run.report, run.stderr);
  assert.equal(run.code, 1);
  assert.equal(run.report.failing, 0);
  assert.equal(run.report.unmeasured, 0);
  const at = (list, w) =>
    list
      .filter((n) => n.width === w)
      .map((n) => `${n.selector} ${n.text}`)
      .sort();
  assert.deepEqual(at(run.report.excludedNodes, 768), ["p CASE-above-m"]);
  assert.equal(run.report.excludedNodes.length, 1);
  // Selector, text, a second element, and route each break the match.
  assert.deepEqual(at(run.report.coveredNodes, 768), [
    "p CASE-above-excluded",
    "p CASE-above-m",
    "p CASE-above-n",
    "span CASE-above-m",
  ]);
  for (const w of [1440, 390]) {
    assert.equal(at(run.report.coveredNodes, w).length, 5, `@${w}`);
  }
});

test("every kind of paint above is read; an opacity-0 overlay is not", async () => {
  const run = await runAudit("/fixture-above-kinds");
  assert.ok(run.report, run.stderr);
  assert.equal(run.code, 1);
  assert.equal(run.report.failing, 0);
  assert.equal(run.report.unmeasured, 0);
  for (const view of run.report.views) {
    const byText = Object.fromEntries(view.nodes.map((n) => [n.text, n]));
    for (const [text, , element, paints] of KINDS) {
      const above = byText[text]?.above ?? [];
      assert.equal(above.length, 1, `@${view.width} ${text}: ${JSON.stringify(above)}`);
      assert.equal(above[0].element, element, `@${view.width} ${text}`);
      assert.ok(
        above[0].paints.startsWith(paints),
        `@${view.width} ${text}: ${above[0].paints}`,
      );
    }
    assert.deepEqual(byText["CASE-kind-opacity-0"].above, [], `@${view.width}`);
  }
  assert.equal(run.report.covered, KINDS.length * 3);
});

test("excluded paint above passes the run", async () => {
  const run = await runAudit("/fixture-above-listed");
  assert.ok(run.report, run.stderr);
  assert.equal(run.code, 0, run.stderr);
  assert.equal(run.report.failing, 0);
  assert.equal(run.report.covered, 0);
  assert.equal(run.report.excluded, 3);
});

for (const [route, { error }] of Object.entries(REFUSED)) {
  test(`${route}: the run fails, and says why`, async () => {
    const run = await runAudit(route);
    assert.notEqual(run.code, 0);
    assert.equal(run.report, null);
    assert.match(run.stderr, error);
  });
}
