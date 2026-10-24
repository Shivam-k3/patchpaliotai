import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ResultPanel from "./ResultPanel";
import type { VerificationResult } from "../types";

function makeResult(overrides: Partial<VerificationResult> = {}): VerificationResult {
  return {
    classification: "IMPROVED",
    baseline: { tests: [], exit_code: 1, timed_out: false, runner_error: false },
    patched: { tests: [], exit_code: 0, timed_out: false, runner_error: false },
    ...overrides,
  };
}

describe("ResultPanel", () => {
  it("shows the regression classification distinctly", () => {
    render(<ResultPanel result={makeResult({ classification: "REGRESSION_DETECTED" })} />);
    expect(screen.getAllByText("REGRESSION_DETECTED").length).toBeGreaterThan(0);
  });

  it("shows the inconclusive classification distinctly", () => {
    render(<ResultPanel result={makeResult({ classification: "INCONCLUSIVE" })} />);
    expect(screen.getAllByText("INCONCLUSIVE").length).toBeGreaterThan(0);
  });

  it("explains when verification did not complete cleanly", () => {
    render(
      <ResultPanel
        result={makeResult({
          classification: "INCONCLUSIVE",
          error: "execution_failed_or_unavailable",
        })}
      />,
    );
    expect(screen.getByText(/did not complete cleanly/i)).toBeTruthy();
    expect(screen.getAllByText(/inconclusive/i).length).toBeGreaterThan(0);
  });

  it("lists resolved and newly failing tests when runs contain outcomes", () => {
    render(
      <ResultPanel
        result={makeResult({
          classification: "IMPROVED",
          baseline: {
            tests: [
              { test_id: "test_mathlib.py::test_divide_by_zero", status: "FAILED" },
              { test_id: "test_mathlib.py::test_divide_ok", status: "PASSED" },
            ],
            exit_code: 1,
            timed_out: false,
            runner_error: false,
          },
          patched: {
            tests: [
              { test_id: "test_mathlib.py::test_divide_by_zero", status: "PASSED" },
              { test_id: "test_mathlib.py::test_divide_ok", status: "PASSED" },
            ],
            exit_code: 0,
            timed_out: false,
            runner_error: false,
          },
        })}
      />,
    );
    expect(screen.getByText("Resolved failures")).toBeTruthy();
    expect(screen.getAllByText("test_mathlib.py::test_divide_by_zero").length).toBeGreaterThan(0);
  });
});
