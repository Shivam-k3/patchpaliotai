import type { TestRun, TestStatus, VerificationResult } from "../types";
import { getClassificationMeta, getTestStatusMeta } from "../lib/status";
import { normalizeVerificationResult, normalizeTestRun, collectExecutionLogs } from "../lib/result";
import { toText } from "../lib/text";

const TONE_CLASSES: Record<string, string> = {
  green: "bg-green-50 text-green-700 border-green-200",
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  gray: "bg-gray-100 text-gray-600 border-gray-300",
};

function StatusBadge({ status }: { status: TestStatus }) {
  const meta = getTestStatusMeta(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${TONE_CLASSES[meta.tone]}`}>
      {meta.label}
    </span>
  );
}

function ClassificationBadge({ classification }: { classification: VerificationResult["classification"] }) {
  const meta = getClassificationMeta(classification);
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${TONE_CLASSES[meta.tone]}`}>
      {meta.shortLabel}
    </span>
  );
}

function RunSummary({ run, title }: { run: TestRun; title: string }) {
  const normalizedRun = normalizeTestRun(run);
  const hasExecutionProblem = Boolean(normalizedRun.timed_out || normalizedRun.runner_error);
  const counts = {
    PASSED: normalizedRun.passed_count ?? 0,
    FAILED: normalizedRun.failed_count ?? 0,
    ERROR: normalizedRun.error_count ?? 0,
    SKIPPED: normalizedRun.skipped_count ?? 0,
  };
  const hasEvidence = (normalizedRun.total_count ?? normalizedRun.tests?.length ?? 0) > 0;

  return (
    <div className="rounded border border-gray-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{title}</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">exit code: {normalizedRun.exit_code ?? "n/a"}</span>
          <span className={`rounded px-2 py-0.5 border ${TONE_CLASSES[hasExecutionProblem || !hasEvidence ? "amber" : "gray"]}`}>
            {hasExecutionProblem ? "execution problem" : !hasEvidence ? "no test evidence" : "completed"}
          </span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <span className="text-green-700">{counts.PASSED} passed</span>
        <span className="text-red-700">{counts.FAILED} failed</span>
        <span className="text-amber-700">{counts.ERROR} errored</span>
        <span className="text-red-700">{counts.TIMEOUT} timed out</span>
        <span className="text-gray-600">{counts.SKIPPED} skipped</span>
      </div>
      {!hasEvidence ? (
        <p className="mt-2 text-sm text-gray-500">No test results were captured for this run.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {(normalizedRun.tests ?? []).map((t) => (
            <li key={t.test_id} className="flex items-center gap-2 text-sm">
              <StatusBadge status={t.status} />
              <code className="font-mono text-xs">{t.test_id}</code>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BuildSummary({ build, title }: { build?: TestRun["build"]; title: string }) {
  if (!build) return null;
  const problem = Boolean(build.timed_out || build.runner_error || build.exit_code !== 0);
  return (
    <div className="rounded border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{title} build</h3>
        <span className={`rounded px-2 py-0.5 border ${TONE_CLASSES[problem ? "amber" : "gray"]}`}>
          {problem ? "failed" : "passed"}
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-700">exit code: {build.exit_code ?? "n/a"}</p>
      {build.logs ? <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-xs">{toText(build.logs)}</pre> : null}
    </div>
  );
}

export default function ResultPanel({ result }: { result: VerificationResult }) {
  const normalized = normalizeVerificationResult(result);
  const classification = getClassificationMeta(normalized.classification);
  const executionLogs = collectExecutionLogs(normalized);
  const executionProblem =
    normalized.baseline.timed_out || normalized.baseline.runner_error || normalized.patched.timed_out || normalized.patched.runner_error ||
    !normalized.baseline.tests?.length || !normalized.patched.tests?.length;
  const inconclusive =
    normalized.classification === "INCONCLUSIVE" || executionProblem || Boolean(normalized.error);

  const resolved: string[] = [];
  const newlyFailing: string[] = [];
  if ((normalized.baseline.tests?.length ?? 0) > 0 && (normalized.patched.tests?.length ?? 0) > 0) {
    const patchedById = new Map((normalized.patched.tests ?? []).map((t) => [t.test_id, t] as const));
    const baselineById = new Map((normalized.baseline.tests ?? []).map((t) => [t.test_id, t] as const));
    for (const [testId, baselineOutcome] of baselineById) {
      const patchedOutcome = patchedById.get(testId);
      if (baselineOutcome.status !== "PASSED" && patchedOutcome?.status === "PASSED") {
        resolved.push(testId);
      }
      if (baselineOutcome.status === "PASSED" && patchedOutcome && ["FAILED", "ERROR", "TIMEOUT"].includes(patchedOutcome.status)) {
        newlyFailing.push(testId);
      }
    }
  }

  return (
    <section className="mt-8 rounded border border-gray-200 bg-white p-4" aria-live="polite">
      <h2 className="text-lg font-bold">Verification result</h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <ClassificationBadge classification={normalized.classification} />
        <p className="text-sm text-gray-700">{classification.description}</p>
      </div>

      {normalized.error ? (
        <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
          <strong>Verification did not complete cleanly.</strong> {normalized.error}
        </div>
      ) : null}

      {inconclusive ? (
        <div className="mt-3 rounded border border-gray-300 bg-gray-50 p-3 text-sm text-gray-700">
          The final classification is <strong>{classification.shortLabel}</strong>. Incomplete or failed
          executions are never treated as passing tests, and no success claim is made without comparable evidence.
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <RunSummary run={normalized.baseline} title="Baseline run" />
        <RunSummary run={normalized.patched} title="Patched run" />
        <BuildSummary build={normalized.baseline.build} title="Baseline" />
        <BuildSummary build={normalized.patched.build} title="Patched" />
      </div>

      {resolved.length > 0 || newlyFailing.length > 0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-semibold text-green-700">Resolved failures</h3>
            {resolved.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-sm">
                {resolved.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-gray-500">No resolved failures were reported.</p>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-red-700">Newly failing tests</h3>
            {newlyFailing.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-sm">
                {newlyFailing.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-gray-500">No new failures were reported.</p>
            )}
          </div>
        </div>
      ) : null}

      {executionLogs.trim() ? (
        <div className="mt-4">
          <h3 className="font-semibold">Execution logs</h3>
          <pre className="mt-1 max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs whitespace-pre-wrap">
            {executionLogs}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
