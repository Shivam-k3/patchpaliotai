import type { Classification, TestOutcome, TestRun, TestStatus, VerificationResult } from "../types";
import { toText } from "./text";

const VALID_CLASSIFICATIONS = new Set<Classification>([
  "IMPROVED",
  "REGRESSION_DETECTED",
  "PARTIAL_FIX",
  "NO_IMPROVEMENT",
  "INCONCLUSIVE",
]);

const VALID_TEST_STATUSES = new Set<TestStatus>(["PASSED", "FAILED", "ERROR", "TIMEOUT", "SKIPPED"]);

export function normalizeTestOutcome(value: unknown): TestOutcome | null {
  if (!value || typeof value !== "object") return null;
  const record = value as { test_id?: unknown; status?: unknown };
  if (typeof record.test_id !== "string" || !record.test_id.trim()) return null;
  const status = VALID_TEST_STATUSES.has(record.status as TestStatus)
    ? (record.status as TestStatus)
    : "ERROR";
  return { test_id: record.test_id, status };
}

export function normalizeTestRun(value: unknown): TestRun {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawTests = Array.isArray(record.tests) ? record.tests : [];
  const tests = rawTests
    .map(normalizeTestOutcome)
    .filter((outcome): outcome is TestOutcome => outcome !== null);

  const logs = record.logs;
  return {
    tests,
    exit_code: typeof record.exit_code === "number" ? record.exit_code : null,
    timed_out: Boolean(record.timed_out),
    runner_error: Boolean(record.runner_error),
    logs: (typeof logs === "string" || Array.isArray(logs)) ? (logs as TestRun["logs"]) : undefined,
  };
}

export function normalizeVerificationResult(value: unknown): VerificationResult {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const classification = VALID_CLASSIFICATIONS.has(record.classification as Classification)
    ? (record.classification as Classification)
    : "INCONCLUSIVE";

  const baseline = normalizeTestRun(record.baseline);
  const patched = normalizeTestRun(record.patched);

  const error = typeof record.error === "string" && record.error.trim().length > 0 ? record.error : null;
  const topLevelLogs = record.logs;
  const logs = topLevelLogs ?? (baseline.logs || patched.logs ? [baseline.logs, patched.logs].filter(Boolean).join("\n") : undefined);

  return {
    classification,
    baseline,
    patched,
    error,
    logs: (typeof logs === "string" || Array.isArray(logs)) ? (logs as VerificationResult["logs"]) : undefined,
  };
}

export function collectExecutionLogs(result: VerificationResult): string {
  const pieces: string[] = [];
  if (result.logs) pieces.push(toText(result.logs));
  if (result.baseline.logs) pieces.push(toText(result.baseline.logs));
  if (result.patched.logs) pieces.push(toText(result.patched.logs));
  return pieces.filter((piece) => piece.trim().length > 0).join("\n");
}