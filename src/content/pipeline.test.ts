import { describe, expect, it } from "vitest";
import { DEMO_FAILURE_INDEX, pipelineStages } from "./pipeline";

describe("pipelineStages", () => {
  it("has nine stages", () => {
    expect(pipelineStages).toHaveLength(9);
  });

  it("gives every stage a unique id", () => {
    const ids = pipelineStages.map((stage) => stage.id);
    expect(ids).toStrictEqual([...new Set(ids)]);
  });

  it("has exactly one human gate, and it precedes upload", () => {
    const gates = pipelineStages.filter((stage) => stage.kind === "gate");
    expect(gates).toHaveLength(1);
    expect(gates[0]?.id).toBe("review");

    const gateIndex = pipelineStages.findIndex((s) => s.kind === "gate");
    const uploadIndex = pipelineStages.findIndex((s) => s.id === "upload");
    expect(gateIndex).toBeLessThan(uploadIndex);
  });

  it("fills every text field on every stage", () => {
    for (const stage of pipelineStages) {
      for (const key of [
        "name",
        "short",
        "does",
        "artifact",
        "failure",
      ] as const) {
        expect(stage[key].trim(), `${stage.id}.${key}`).not.toBe("");
      }
    }
  });

  it("points the failure demo at a real stage", () => {
    expect(pipelineStages[DEMO_FAILURE_INDEX]).toBeDefined();
    expect(pipelineStages[DEMO_FAILURE_INDEX]?.id).toBe("metadata");
  });
});
