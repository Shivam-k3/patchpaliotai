export interface TestOutcome {
  test_id: string;
  status: "PASSED" | "FAILED" | "ERROR" | "TIMEOUT" | "SKIPPED";
}

export interface TestRun {
  tests: TestOutcome[];
  exit_code: number | null;
  timed_out: boolean;
  runner_error: boolean;
}

export interface VerifyRequest {
  sample_name?: string | null;
  patch_text?: string | null;
  test_command?: string;
}

export interface VerifyResponse {
  classification: "IMPROVED" | "REGRESSION_DETECTED" | "PARTIAL_FIX" | "NO_IMPROVEMENT" | "INCONCLUSIVE";
  baseline: TestRun;
  patched: TestRun;
  error?: string;
}

export interface AnalyzeRequest {
  bug_report: string;
  files?: Record<string, string> | null;
  sample_name?: string | null;
}

export interface AnalyzeResponse {
  bug_summary: string;
  likely_root_cause: string;
  evidence: string[];
  proposed_unified_diff: string;
  suggested_tests: string[];
  limitations: string[];
}

export interface SamplesResponse {
  samples: string[];
}

export interface HealthResponse {
  status: string;
  service: string;
}

export interface ReadyResponse {
  ready: boolean;
  checks: {
    docker: boolean;
    samples_dir: boolean;
  };
}
