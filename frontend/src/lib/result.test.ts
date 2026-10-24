import { describe, expect, it } from "vitest";
import { normalizeTestRun, normalizeVerificationResult, collectExecutionLogs } from "./result";

describe("normalizeTestRun", () => {
  it("fills defaults for missing fields", () => {
    expect(normalizeTestRun(undefined)).toEqual({
      tests: [],
      exit_code: null,
      timed_out: false,
      runner_error: false,
      logs: undefined,
    });
  });

  it("filters malformed outcomes and normalizes status", () => {
    const run = normalizeTestRun({
      tests: [{ test_id: "a", status: "PASSED" }, { test_id: "", status: "FAILED" }, { status: "PASSED" }, { test_id: "b", status: "UNKNOWN" }],
      exit_code: 1,
      timed_out: true,
    });
    expect(run.tests).toEqual([
      { test_id: "a", status: "PASSED" },
      { test_id: "b", status: "ERROR" },
    ]);
    expect(run.exit_code).toBe(1);
    expect(run.timed_out).toBe(true);
    expect(run.runner_error).toBe(false);
  });
});

describe("normalizeVerificationResult", () => {
  it("defaults to inconclusive for missing or invalid classification", () => {
    const result = normalizeVerificationResult({ baseline: {}, patched: {} });
    expect(result.classification).toBe("INCONCLUSIVE");
    expect(result.baseline.tests).toEqual([]);
    expect(result.patched.tests).toEqual([]);
  });

  it("preserves a valid classification and error", () => {
    const result = normalizeVerificationResult({
      classification: "REGRESSION_DETECTED",
      baseline: { tests: [{ test_id: "t", status: "PASSED" }], exit_code: 0 },
      patched: { tests: [{ test_id: "t", status: "FAILED" }], exit_code: 1 },
      error: "execution_failed_or_unavailable",
    });
    expect(result.classification).toBe("REGRESSION_DETECTED");
    expect(result.error).toBe("execution_failed_or_unavailable");
  });
});

describe("collectExecutionLogs", () => {
  it("returns an empty string when no logs exist", () => {
    const result = normalizeVerificationResult({ baseline: {}, patched: {} });
    expect(collectExecutionLogs(result)).toBe("");
  });

  it("collects available logs", () => {
    const result = normalizeVerificationResult({
      baseline: { logs: "baseline log" },
      patched: { logs: ["patched log"] },
      logs: "top-level log",
    });
    expect(collectExecutionLogs(result)).toContain("top-level log");
    expect(collectExecutionLogs(result)).toContain("baseline log");
    expect(collectExecutionLogs(result)).toContain("patched log");
  });
});