import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DiffView from "./DiffView";

const SAMPLE_DIFF = [
  "--- a/mathlib.py",
  "+++ b/mathlib.py",
  "@@ -1,4 +1,4 @@",
  " def divide(a, b):",
  "-    return a / b",
  "+    return a / b if b else 0",
  "",
].join("\n");

describe("DiffView", () => {
  it("renders context, added and removed lines distinctly", () => {
    render(<DiffView diff={SAMPLE_DIFF} />);
    expect(screen.getByText("def divide(a, b):")).toBeTruthy();
    expect(screen.getByText("return a / b if b else 0")).toBeTruthy();
    expect(screen.getByText("return a / b")).toBeTruthy();
  });

  it("renders headers", () => {
    render(<DiffView diff={SAMPLE_DIFF} />);
    expect(screen.getAllByText("--- a/mathlib.py").length).toBeGreaterThan(0);
  });

  it("renders an empty state for empty diffs", () => {
    render(<DiffView diff="" />);
    expect(screen.getByText("No diff content to display.")).toBeTruthy();
  });
});
