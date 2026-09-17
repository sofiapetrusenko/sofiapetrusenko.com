import type { Project } from "./types";

/**
 * Ordered most recent first. To add a project: copy an entry below and give it
 * a unique slug — `content.test.ts` fails on duplicates, empty text and any
 * href that is not absolute http(s) or mailto:.
 *
 * Every figure in these entries is quoted from a repository artifact, not from
 * memory. Where a repo records something as designed but not yet run, this copy
 * says so in those words.
 */
export const projects = [
  {
    slug: "lifespan-extract",
    name: "lifespan-extract",
    tagline:
      "Structured longevity-intervention data from papers, measured against a hand-labeled gold set built before the pipeline.",
    problem:
      "Quantitative lifespan-intervention results are locked inside thousands of papers in inconsistent formats, and the curated databases that collect them lag the literature by years. Extracting them with an LLM is easy; extracting them so that every record is auditable — and the system knows when to refuse — is the actual problem.",
    approach:
      "The measurement comes before the pipeline. A hand-labeled gold set of 10 papers and 26 intervention records defines what correct extraction means, and every field in it carries a verbatim source quote, a confidence and whether it was read from the abstract or the full text. Ingestion is built: PubMed and bioRxiv clients, DOI dedup across preprint and publication, raw abstracts stored in Postgres. Classification and extraction are next, behind that standard rather than ahead of it.",
    sections: [
      {
        id: "verification",
        label: "Verification",
        body: "The gold set is labeled by me, never by the model, because a model grading its own extractions measures nothing. A deterministic checker verifies that every source quote appears character-for-character in the text it claims to come from — PubMed abstracts, or PMC open-access full text resolved PMID to PMCID — collapsing whitespace and nothing else, so a changed word or a changed case is a failure. A quote in a paper outside PMC open access is reported as unverifiable rather than as passing: a quote nobody can check is not a quote known to be wrong, and it is not one known to be right. Absent data is `not_reported` or null, never inferred, including where the likely answer is obvious. A 15-paper set of hard negatives across five categories — aging-without-lifespan, lifespan-without-intervention, reviews, wrong organism, lifespan-adjacent outcomes — is the other half of the classifier eval.",
      },
      {
        id: "integrity",
        label: "Keeping the standard fixed",
        body: "If an agent can edit the gold set, then a disagreement between the pipeline and the gold set can be resolved by changing the gold set, and the eval stops measuring extraction accuracy and starts measuring how readily the standard bends. So a PreToolUse hook blocks agent writes to `data/gold/` at the filesystem level while still allowing reads, and blocks agent invocation of the two flags that write there. Protection is layered because each layer fails differently: the hook catches the write itself, a reviewer subagent catches code paths that would write there, and CI catches schema and structure on every push. The hook is the only one of the three that cannot be talked out of its position.",
      },
      {
        id: "process",
        label: "How it's built",
        body: "Autonomous implementation is only worth trusting if the review of it is independent of it, so the loop separates the two roles. An implementer subagent writes; the orchestrator runs ruff and pytest itself; a reviewer subagent then runs in a fresh context and sees the complete diff, never a summary and never the implementer's reasoning — a review that inherits the argument for a change tends to inherit its blind spots. The loop repeats until the reviewer returns zero required findings, capped at five iterations, and on hitting the cap it stops and reports rather than continuing. Each iteration appends one line to a loop log: the ingestion phase ran four, going 4 → 2 → 0 required findings before a human-requested follow-up pass. Gold-set labeling, eval design and PR review between phases are reserved to the human and cannot be reached from inside the loop.",
      },
      {
        id: "status",
        label: "Status",
        body: "Phase 0 (foundation and gold set) and Phase 1 (ingestion) are complete; 485 tests pass in CI. Phase 2 is classification and extraction, and Phase 3 is the eval harness the gold set was built for. Nothing has been extracted by the model yet — the standard exists first, on purpose.",
      },
    ],
    summaries: {
      problem:
        "Lifespan results are locked in prose across thousands of papers. Getting them out with an LLM is easy; getting them out auditably, and knowing when to refuse, is the problem.",
      approach:
        "The measurement comes before the pipeline: a hand-labeled gold set defines correct extraction, and ingestion is built behind it. Classification and extraction are next.",
      verification:
        "Quotes are checked character-for-character against the source, and a quote nobody can check is reported unverifiable rather than passing.",
      integrity:
        "A PreToolUse hook stops an agent editing the gold set, so a disagreement between the pipeline and the standard cannot be settled by moving the standard.",
      process:
        "An implementer subagent writes, a reviewer subagent audits the full diff in a fresh context, and the loop runs until the reviewer returns nothing required.",
      status:
        "Phases 0 and 1 are complete and 485 tests pass. Nothing has been extracted by the model yet — the standard exists first, on purpose.",
    },
    stack: ["Python", "PubMed / bioRxiv APIs", "PostgreSQL"],
    links: [
      {
        label: "Repository",
        href: "https://github.com/sofiapetrusenko/lifespan-extract",
      },
    ],
    year: "2026 — in development",
  },
  {
    slug: "blotquant",
    name: "blotquant",
    tagline:
      "QC-first western blot densitometry — a bad number is a refusal, not a warning.",
    problem:
      "Western blot quantification is one of the most common measurements in molecular biology and one of the least reproducible: hand-drawn regions, silent saturation, undocumented normalization. Most tools give you a number; almost none tell you whether you should trust it.",
    approach:
      "A Python CLI, with an HTTP API alongside it, that detects lanes and bands, subtracts background, normalizes against loading controls — and treats quality control as a first-class output. Saturated or unverifiable bands are flagged and still reported, annotated rather than quietly dropped, and their exclusion from a normalization ratio is explicit and recorded with its reason. Every result document carries provenance: image hash, config digest, software version, and whether each lane was found by the pipeline or supplied by the caller.",
    sections: [
      {
        id: "verification",
        label: "Verification",
        body: "Development is gated on a seeded synthetic gold set of 40 images with per-band ground truth, split 30 dev and 10 held-out test. On the dev split, band detection measures F1 0.851 at IoU ≥ 0.5, and intensity recovery is 7.05% mean / 4.60% median absolute error on bands carrying no ground-truth QC flag. The headline error over all matched bands is higher, 17.39%, because saturated bands and unresolved doublets are included rather than dropped — both are reported separately and neither is hidden. The test split has never been scored or tuned on, and nothing has been measured on a real blot. 690 tests run in CI, which also re-measures every recorded figure and re-verifies the digest of every frozen document, so a number that goes stale fails the build.",
      },
      {
        id: "external-validation",
        label: "External validation, designed and not yet run",
        body: "The cross-check against Fiji/ImageJ is pre-registered and its inputs are assembled: 19 CC-BY blot crops from 13 published figures, each committed with its sha256, DOI and licence so the comparison runs on byte-identical files. Agreement thresholds were fixed before any measurement, so interpretation cannot be fitted to the outcome — Spearman r_s ≥ 0.9 is agreement, 0.7 to 0.9 is partial agreement with every discrepant blot individually explained, and below 0.7 the method is not corroborated and that result is published as stated. The comparison runs on normalized ratios rather than absolute intensities, because ImageJ's aperture convention differs and an absolute comparison would measure the conventions instead of the methods. The first real-data run then measured nothing: all 19 crops are three-channel PNGs and the loader quantifies single-channel images only, so it refused all 19 rather than picking a channel the pre-registration forbids choosing. That refusal is the correct behaviour and the honest result — no lane, band or QC flag has ever been produced from a real blot.",
      },
      {
        id: "process",
        label: "How it's built",
        body: "The engineering process is part of the point. Each phase runs as an agentic loop in Claude Code: an implementer subagent writes, a reviewer subagent audits the full diff in a fresh context, and a phase is not done until that reviewer returns zero required changes. Standing rules were not enough on their own — one phase ran eight review cycles in which the code converged after three and the written record did not converge at all, because a claim gets fixed where a reviewer happens to read it while its duplicates elsewhere survive. So the claims surface became mechanical: a stdlib-only checker extracts each asserted quantity everywhere it appears and fails CI when two sites disagree, without ever hardcoding the right answer. Decisions live in NOTES.md, known weaknesses in a debt register, and the pipeline may never import from the generator that makes its test data.",
      },
      {
        id: "status",
        label: "Status",
        body: "In active development. The CLI pipeline, QC, normalization and provenance are merged, as is the HTTP API with caller-supplied lane ROIs. Next: getting a real blot through the loader, then the ImageJ agreement run, and a three-state result status (pass, flagged, blocked) so an image the tool cannot honestly measure is refused with an explanation rather than quantified anyway.",
      },
    ],
    summaries: {
      problem:
        "Western blot quantification is among the most common measurements in biology and among the least reproducible. Most tools give you a number; almost none tell you whether to trust it.",
      approach:
        "Lanes and bands are detected, background subtracted, signal normalized — and quality control is a first-class output rather than a footnote. Every result carries its provenance.",
      verification:
        "Development is gated on a synthetic gold set with per-band ground truth. The held-out split has never been scored, and nothing has been measured on a real blot.",
      "external-validation":
        "The Fiji/ImageJ comparison is pre-registered with its thresholds fixed in advance. Its first run measured nothing, and that refusal is the recorded result.",
      process:
        "Each phase runs as an implementer/reviewer agent loop to zero required findings, with a mechanical checker that fails CI when two documents state the same figure differently.",
      status:
        "CLI, QC, normalization, provenance and the HTTP API are merged. Next is getting a real blot through the loader, then the agreement run.",
    },
    stack: [
      "Python",
      "OpenCV / scikit-image",
      "FastAPI",
      "NumPy / SciPy",
      "pytest",
    ],
    links: [
      {
        label: "Repository",
        href: "https://github.com/sofiapetrusenko/blotquant",
      },
    ],
    year: "2026 — v1.0 in progress",
  },
  {
    slug: "media-automation-platform",
    name: "media-automation-platform",
    tagline:
      "A topic goes in; a scripted, narrated, edited and published video comes out.",
    problem:
      "Producing video consistently is a pipeline problem, not a creative one. The same stages repeat for every video, each fails differently, and the expensive parts — inference, image generation, speech synthesis — must never re-run without reason.",
    approach:
      "Eight-stage pipeline where each stage writes a typed artifact the next one reads, so a failure at stage six costs one stage rather than the whole run. Stages are idempotent and resumable; model output is treated as untrusted input, with a JSON repair heuristic added after a real failure in Spanish narration. Nothing publishes without a human approving it.",
    sections: [],
    summaries: {},
    stack: [
      "Python",
      "FastAPI",
      "PostgreSQL",
      "Redis + RQ",
      "Next.js",
      "TypeScript",
      "ffmpeg",
      "Docker",
    ],
    links: [
      {
        label: "Repository",
        href: "https://github.com/sofiapetrusenko/media-automation-platform",
      },
    ],
    year: "2025 — 2026",
  },
  {
    slug: "mira",
    name: "Mira — conversational agent with long-term memory",
    tagline: "Durable memory across sessions, not single-conversation context.",
    problem:
      "Conversational agents forget everything between sessions. Anything worth remembering has to be re-supplied by the user, which caps how useful the agent can be over time.",
    approach:
      "Memory layer built end-to-end on a structured Markdown knowledge base: a defined note schema, automated extraction and writing of salient information, and retrieval of relevant prior context at inference time. Conversation-state handling keeps continuity and tone coherent across extended multi-session use.",
    sections: [],
    summaries: {},
    stack: ["Python", "LLM APIs", "retrieval / RAG", "Markdown knowledge base"],
    links: [],
    year: "2025",
  },
] satisfies readonly Project[];
