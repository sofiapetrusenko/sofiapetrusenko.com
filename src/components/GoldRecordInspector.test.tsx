import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { lifespanMetrics } from "@/content";
import { GoldRecordInspector } from "./GoldRecordInspector";

const firstRecord = lifespanMetrics.sample_records[0];
if (!firstRecord) throw new Error("no sample records in lifespan-metrics.json");

describe("GoldRecordInspector", () => {
  it("opens on a real gold record and names the file it came from", () => {
    render(<GoldRecordInspector />);

    expect(screen.getByText(firstRecord.id)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(firstRecord.file))).toBeInTheDocument();
  });

  it("offers one record per direction", () => {
    render(<GoldRecordInspector />);

    const selector = screen.getByRole("group", { name: /gold records/i });
    expect(within(selector).getAllByRole("button")).toHaveLength(
      lifespanMetrics.sample_records.length,
    );
  });

  it("renders a stated absence differently from a value", () => {
    render(<GoldRecordInspector />);

    const withAbsence = lifespanMetrics.sample_records.find(
      (record) => record.counts.not_reported > 0,
    );
    if (!withAbsence)
      throw new Error("expected a record carrying not_reported");

    fireEvent.click(
      screen.getByRole("button", {
        name: withAbsence.direction ?? withAbsence.id,
      }),
    );

    // `not_reported` is the paper declining to say; it is shown as itself
    // rather than folded into the empty dash used for a null.
    expect(screen.getAllByText("not_reported").length).toBeGreaterThan(0);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("links a record out to its source by PMID", () => {
    render(<GoldRecordInspector />);

    const record = lifespanMetrics.sample_records.find(
      (entry) => entry.paper.pmid,
    );
    if (!record?.paper.pmid) throw new Error("expected a record with a PMID");

    fireEvent.click(
      screen.getByRole("button", { name: record.direction ?? record.id }),
    );
    expect(
      screen.getByRole("link", { name: `PMID ${record.paper.pmid}` }),
    ).toHaveAttribute(
      "href",
      `https://pubmed.ncbi.nlm.nih.gov/${record.paper.pmid}/`,
    );
  });

  it("says why no surrounding source text is shown", () => {
    render(<GoldRecordInspector />);
    expect(
      screen.getByText(/not committed to that repository/i),
    ).toBeInTheDocument();
  });

  describe("the quote checker tab", () => {
    const openChecker = () => {
      render(<GoldRecordInspector />);
      fireEvent.click(screen.getByRole("button", { name: /quote checker/i }));
    };

    it("marks a quote that is present as a verbatim match", () => {
      openChecker();
      expect(screen.getAllByText(/verbatim match/i).length).toBe(2);
    });

    it("matches across the source's own line wrapping", () => {
      openChecker();
      // The full-text fixture wraps mid-sentence. A match here is the
      // whitespace-collapsing rule working, not a coincidence.
      expect(
        screen.getByText(
          /full-text quote, across the source's own line wrapping/i,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Median survival increased by 14% in males"),
      ).toBeInTheDocument();
    });

    it("fails a quote the source never contained, rather than warning", () => {
      openChecker();
      expect(screen.getByText(/no match/i)).toBeInTheDocument();
      expect(
        screen.getByText(/not present in the source/i),
      ).toBeInTheDocument();
    });

    it("credits the fixtures rather than passing them off as a paper", () => {
      openChecker();
      expect(
        screen.getByText(new RegExp(lifespanMetrics.checker_fixtures.source)),
      ).toBeInTheDocument();
    });
  });
});
