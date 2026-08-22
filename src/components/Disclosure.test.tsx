import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Disclosure } from "./Disclosure";

describe("Disclosure", () => {
  it("shows the summary and keeps the body in the DOM while collapsed", () => {
    render(
      <Disclosure summary="the short version">
        <p>the long version</p>
      </Disclosure>,
    );

    expect(screen.getByText("the short version")).toBeInTheDocument();
    // Hidden, not unmounted: the prose has to be there for search engines and
    // for in-page find, which is the whole reason this is not conditional.
    expect(screen.getByText("the long version")).toBeInTheDocument();
    expect(
      screen.getByText("the long version").closest("[hidden]"),
    ).not.toBeNull();
  });

  it("reports and toggles its state through aria-expanded", () => {
    render(
      <Disclosure summary="summary">
        <p>body</p>
      </Disclosure>,
    );

    const toggle = screen.getByRole("button");
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body").closest("[hidden]")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("can start open", () => {
    render(
      <Disclosure summary="summary" defaultOpen>
        <p>body</p>
      </Disclosure>,
    );

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("body").closest("[hidden]")).toBeNull();
  });

  it("points the toggle at the region it controls", () => {
    render(
      <Disclosure summary="summary">
        <p>body</p>
      </Disclosure>,
    );

    const controls = screen.getByRole("button").getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls as string)).toContainElement(
      screen.getByText("body"),
    );
  });
});
