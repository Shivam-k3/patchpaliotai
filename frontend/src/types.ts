export type TestStatus = "PASSED" | "FAILED" | "ERROR" | "TIMEOUT" | "SKIPPED";

export interface TestOutcome {
  test_id: string;
  status: TestStatus;
}

export interface TestRun {
  tests?: TestOutcome[];
  exit_code?: number | null;
  timed_out?: boolean;
  runner_error?: boolean;
  logs?: TextBlock;
}

export type Classification =
  | "IMPROVED"
  | "REGRESSION_DETECTED"
  | "PARTIAL_FIX"
  | "NO_IMPROVEMENT"
  | "INCONCLUSIVE";

export interface VerificationResult {
  classification: Classification;
  baseline: TestRun;
  patched: TestRun;
  error?: string | null;
  logs?: TextBlock;
}

export type TextBlock = string | string[] | null | undefined;

export interface AnalyzeResponse {
  proposed_unified_diff?: string | null;
  bug_summary?: TextBlock;
  likely_root_cause?: TextBlock;
  evidence?: TextBlock;
  suggested_tests?: TextBlock;
  limitations?: TextBlock;
}
