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
    slug: "blotquant",
    name: "blotquant — QC-first western blot densitometry",
    tagline:
      "A raw blot image goes in; QC-gated, provenance-stamped band quantification comes out.",
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
    stack: [
      "Python",
      "OpenCV / scikit-image",
      "FastAPI",
      "NumPy / SciPy",
      "pytest",
      "Claude Code subagents",
    ],
    links: [
      {
        label: "Repository",
        href: "https://github.com/sofiapetrusenko/blotquant",
      },
    ],
    year: "2026–present",
  },
  {
    slug: "media-automation-platform",
    name: "Content Automation Platform",
    tagline:
      "A topic goes in; a scripted, narrated, edited and published video comes out.",
    problem:
      "Producing video consistently is a pipeline problem, not a creative one. The same stages repeat for every video, each fails differently, and the expensive parts — inference, image generation, speech synthesis — must never re-run without reason.",
    approach:
      "Eight-stage pipeline where each stage writes a typed artifact the next one reads, so a failure at stage six costs one stage rather than the whole run. Stages are idempotent and resumable; model output is treated as untrusted input, with a JSON repair heuristic added after a real failure in Spanish narration. Nothing publishes without a human approving it.",
    sections: [],
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
    year: "2025–present",
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
    stack: ["Python", "LLM APIs", "retrieval / RAG", "Markdown knowledge base"],
    links: [],
    year: "2025",
  },
] satisfies readonly Project[];
