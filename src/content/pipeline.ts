import type { PipelineStage } from "./types";

/**
 * The Content Automation Platform pipeline, in run order.
 *
 * Stage ids, artifact filenames and failure behaviour are taken from the
 * platform's own README and `steps/` modules — `STAGE_ORDER` and the artifact
 * map in `steps/pipeline.py`. Nothing here describes a capability the platform
 * does not have.
 *
 * Eight automated stages plus the human review gate, which is the only stage
 * with no automatic path.
 */
export const pipelineStages = [
  {
    id: "script",
    name: "Script",
    short: "Script",
    kind: "automated",
    does: "Generates the narration script for the topic, following the channel's configured narrative framework.",
    artifact: "script.json",
    failure:
      "Model output is treated as untrusted input: a repair heuristic escapes unescaped quotes inside string values and retries once, then raises with an excerpt around the failure position rather than returning a malformed object.",
  },
  {
    id: "voiceover",
    name: "Voiceover",
    short: "Voiceover",
    kind: "automated",
    does: "Synthesises narration audio for every scene in the script.",
    artifact: "voiceover.json",
    failure:
      "If the primary speech provider fails persistently, the entire video is re-synthesised on the fallback voice — never a mix of two voices across scenes.",
  },
  {
    id: "stock",
    name: "Stock footage",
    short: "Stock",
    kind: "automated",
    does: "Chooses footage for each scene. Clips are cached by provider ID and every use is recorded, so the same clip does not resurface across recent videos.",
    artifact: "stock.json",
    failure:
      "When exact, simplified and theme queries all come back empty it fails loudly, rather than passing an empty clip down to assembly and leaving a hole in the video.",
  },
  {
    id: "assemble",
    name: "Assembly",
    short: "Assembly",
    kind: "automated",
    does: "Renders the scenes and narration into a single video with ffmpeg.",
    artifact: "video.mp4",
    failure:
      "Inputs are validated before the render starts, so a missing scene raises one clear error naming the scene number instead of crashing mid-render or silently dropping it.",
  },
  {
    id: "subtitles",
    name: "Subtitles",
    short: "Subtitles",
    kind: "automated",
    does: "Burns subtitles onto the rendered video.",
    artifact: "video_subtitled.mp4",
    failure:
      "A missing render or voiceover raises immediately and names the earlier stage to run, rather than producing an untitled video.",
  },
  {
    id: "metadata",
    name: "Metadata & SEO",
    short: "Metadata",
    kind: "automated",
    does: "Derives the title, description and tags. Deliberately independent of the render, so it can be regenerated without touching the video.",
    artifact: "metadata.json",
    failure:
      "A model response containing no JSON object raises with the raw output attached, rather than writing a malformed record the upload stage would later read.",
  },
  {
    id: "thumbnail",
    name: "Thumbnail",
    short: "Thumbnail",
    kind: "automated",
    does: "Produces the thumbnail image. Like metadata, it derives from the script and voiceover rather than the render.",
    artifact: "thumbnails/thumbnail.jpg",
    failure:
      "A missing image API key exits rather than falling back to a placeholder; provider errors send a best-effort alert and re-raise so the job fails visibly.",
  },
  {
    id: "review",
    name: "Human review",
    short: "Review",
    kind: "gate",
    does: "The publication gate. An operator previews the finished video and approves it before anything is uploaded.",
    artifact:
      "An approval recorded against the video, with the approver and the source of the approval.",
    failure:
      "There is no automatic path through this stage. Nothing publishes without a human approving it.",
  },
  {
    id: "upload",
    name: "Upload",
    short: "Upload",
    kind: "automated",
    does: "Publishes the approved video to the channel through the YouTube Data API.",
    artifact: "The published video, plus the run's job.json.",
    failure:
      "An unreadable credentials file, or an account with no channel, exits before any upload is attempted.",
  },
] satisfies readonly PipelineStage[];

/** Index of the stage the failure demo marks as failed (Metadata & SEO). */
export const DEMO_FAILURE_INDEX = 5;
