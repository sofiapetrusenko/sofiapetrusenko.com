import type { Project } from "./types";

/**
 * Ordered most recent first. To add a project: copy an entry below and give it
 * a unique slug — `content.test.ts` fails on duplicates, empty text and any
 * href that is not absolute http(s) or mailto:.
 */
export const projects = [
  {
    slug: "media-automation-platform",
    name: "Content Automation Platform",
    tagline:
      "A topic goes in; a scripted, narrated, edited and published video comes out.",
    problem:
      "Producing video consistently is a pipeline problem, not a creative one. The same stages repeat for every video, each fails differently, and the expensive parts — inference, image generation, speech synthesis — must never re-run without reason.",
    approach:
      "Eight-stage pipeline where each stage writes a typed artifact the next one reads, so a failure at stage six costs one stage rather than the whole run. Stages are idempotent and resumable; model output is treated as untrusted input, with a JSON repair heuristic added after a real failure in Spanish narration. Nothing publishes without a human approving it.",
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
    stack: ["Python", "LLM APIs", "retrieval / RAG", "Markdown knowledge base"],
    links: [],
    year: "2025",
  },
] satisfies readonly Project[];
