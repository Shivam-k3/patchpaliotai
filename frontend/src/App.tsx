import { useEffect, useState } from "react";
// API integration (see ./api.ts):
//   GET  /api/samples
//   POST /api/analyze  { bug_report, sample_name } -> { proposed_unified_diff, ... }
//   POST /api/verify   { sample_name, patch_text } -> verification result
import DiffView from "./components/DiffView";
import ResultPanel from "./components/ResultPanel";
import { analyzeBug, DEFAULT_TEST_COMMAND, fetchHealth, fetchReady, fetchSamples, verifyPatch } from "./api";
import { toText } from "./lib/text";
import type { AnalyzeResponse, VerificationResult } from "./types";

const MAX_BUG_LENGTH = 10000;

export default function App() {
  const [samples, setSamples] = useState<string[]>([]);
  const [sample, setSample] = useState("");
  const [bug, setBug] = useState("");
  const [patch, setPatch] = useState("");
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loadingSamples, setLoadingSamples] = useState(true);
  const [backendLoading, setBackendLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPatch, setEditingPatch] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"checking" | "online" | "offline">("checking");
  const [backendDetail, setBackendDetail] = useState<string>("");
  const [readyChecks, setReadyChecks] = useState<{ docker?: boolean; samples_dir?: boolean } | null>(null);
  const [history, setHistory] = useState<Array<{ kind: string; sample: string; summary: string; at: string }>>([]);

  const activeSample = sample || samples[0] || "";
  const trimmedBug = bug.trim();
  const canAnalyze = trimmedBug.length > 0 && trimmedBug.length <= MAX_BUG_LENGTH;
  const canVerify = patch.trim().length > 0;

  const loadBackendData = async () => {
    setBackendLoading(true);
    setLoadingSamples(true);
    setBackendStatus("checking");
    setBackendDetail("");
    try {
      const health = await fetchHealth();
      setBackendStatus("online");
      setBackendDetail(typeof health.status === "string" ? health.status : "ok");
    } catch (e) {
      setBackendStatus("offline");
      setBackendDetail(e instanceof Error ? e.message : "Backend unreachable");
    }
    try {
      const ready = await fetchReady();
      setReadyChecks(ready.checks || null);
    } catch {
      setReadyChecks(null);
    }
    try {
      const list = await fetchSamples();
      setSamples(list);
      setSample((prev) => prev || list[0] || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the sample list.");
    } finally {
      setLoadingSamples(false);
      setBackendLoading(false);
    }
  };

  useEffect(() => {
    void loadBackendData();
  }, []);

  const handleBugChange = (value: string) => {
    setBug(value);
    if (analysis) {
      // The generated patch corresponds to the previous bug report.
      setAnalysis(null);
      setPatch("");
      setResult(null);
    }
  };

  const handleAnalyze = async () => {
    if (analyzing || !canAnalyze || !activeSample) return;
    setAnalyzing(true);
    setError(null);
    try {
      const data = await analyzeBug(trimmedBug, activeSample);
      setAnalysis(data);
      setPatch(data.proposed_unified_diff ?? "");
      setResult(null);
      setHistory((prev) => [
        { kind: "Analyze", sample: activeSample, summary: toText(data.bug_summary) || "Patch proposed", at: new Date().toLocaleTimeString() },
        ...prev,
      ].slice(0, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The analysis failed unexpectedly.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleVerify = async () => {
    if (verifying || !canVerify || !activeSample) return;
    setVerifying(true);
    setError(null);
    try {
      const data = await verifyPatch(activeSample, patch);
      setResult(data);
      setHistory((prev) => [
        { kind: "Verify", sample: activeSample, summary: data.classification, at: new Date().toLocaleTimeString() },
        ...prev,
      ].slice(0, 10));
    } catch (e) {
      setResult(null);
      const message = e instanceof Error ? e.message : "The verification failed unexpectedly.";
      setError(message);
      setHistory((prev) => [
        { kind: "Verify", sample: activeSample, summary: `Failed: ${message}`, at: new Date().toLocaleTimeString() },
        ...prev,
      ].slice(0, 10));
    } finally {
      setVerifying(false);
    }
  };

  const handleSampleChange = (value: string) => {
    setSample(value);
    setAnalysis(null);
    setPatch("");
    setResult(null);
    setEditingPatch(false);
    setError(null);
  };

  const bugTooLong = trimmedBug.length > MAX_BUG_LENGTH;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-2xl font-bold">PatchPilot AI</h1>
          <p className="mt-1 text-sm text-gray-600">
            AI proposes a fix; evidence determines its verification status.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-16">
        {/* Overview / backend status */}
        <section aria-labelledby="overview" className="mb-8 rounded border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="overview" className="text-lg font-semibold">PatchPilot AI</h2>
              <p className="text-sm text-gray-600">
                AI proposes a fix; evidence determines its verification status.
              </p>
            </div>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${
                backendStatus === "online"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : backendStatus === "offline"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-gray-200 bg-gray-50 text-gray-600"
              }`}
              role="status"
            >
              Backend: {backendStatus === "checking" ? "checking." : backendStatus}
              {backendDetail ? ` (${backendDetail})` : ""}
            </span>
          </div>
          {readyChecks ? (
            <p className="mt-2 text-xs text-gray-600">
              Readiness: docker={String(readyChecks.docker)}; samples_dir={String(readyChecks.samples_dir)}.
              Execution mode is configured on the backend (default local).
            </p>
          ) : null}
          {backendStatus === "offline" ? (
            <button
              type="button"
              onClick={() => void loadBackendData()}
              disabled={backendLoading}
              className="mt-3 rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {backendLoading ? "Retrying." : "Retry connection"}
            </button>
          ) : null}
          <p className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Warning:</strong> local test execution is not a secure sandbox for hostile code. Only run trusted samples.
          </p>
        </section>

        {/* Step 1: sample selection */}
        <section aria-labelledby="step-sample" className="mb-8">
          <h2 id="step-sample" className="text-lg font-semibold">1. Select a sample project</h2>
          <div className="mt-2">
            <label htmlFor="sample" className="block text-sm font-medium">
              Sample
            </label>
            <select
              id="sample"
              value={activeSample}
              onChange={(e) => handleSampleChange(e.target.value)}
              disabled={loadingSamples}
              className="mt-1 w-full rounded border border-gray-300 bg-white p-2"
            >
              {loadingSamples ? <option value="">Loading samples…</option> : null}
              {samples.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {samples.length === 0 && !loadingSamples ? (
              <p className="mt-2 text-sm text-gray-600">No sample projects are available from the backend.</p>
            ) : null}
          </div>
        </section>

        {/* Step 2: bug description */}
        <section aria-labelledby="step-bug" className="mb-8">
          <h2 id="step-bug" className="text-lg font-semibold">2. Describe the bug</h2>
          <div className="mt-2">
            <label htmlFor="bug" className="block text-sm font-medium">
              Bug description <span className="text-red-600">*</span>
            </label>
            <textarea
              id="bug"
              value={bug}
              onChange={(e) => handleBugChange(e.target.value)}
              placeholder="Describe the bug you want to fix, e.g. division by zero in the calculator."
              rows={4}
              maxLength={MAX_BUG_LENGTH}
              className="mt-1 w-full rounded border border-gray-300 p-2 font-mono text-sm"
            />
            <div className="mt-1 flex items-center justify-between">
              {trimmedBug.length === 0 ? (
                <p className="text-sm text-gray-500">Required for analysis.</p>
              ) : bugTooLong ? (
                <p className="text-sm text-red-600" role="alert">
                  Bug description must be {MAX_BUG_LENGTH} characters or fewer.
                </p>
              ) : (
                <p className="text-sm text-gray-500">{trimmedBug.length} / {MAX_BUG_LENGTH} characters</p>
              )}
            </div>
          </div>
        </section>

        {/* Step 3: analyze */}
        <section aria-labelledby="step-analyze" className="mb-8">
          <h2 id="step-analyze" className="text-lg font-semibold">3. Analyze</h2>
          <p className="mt-2 text-sm text-gray-600">
            PatchPilot asks the AI provider to analyze the sample and propose a structured unified diff.
          </p>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!canAnalyze || analyzing}
            aria-busy={analyzing}
            className="mt-3 rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {analyzing ? "Analyzing…" : "Analyze"}
          </button>
          {analyzing ? (
            <p className="mt-2 text-sm text-gray-600" role="status">The AI is preparing a patch proposal…</p>
          ) : null}
        </section>

        {/* Step 4: review proposed patch */}
        <section aria-labelledby="step-patch" className="mb-8">
          <h2 id="step-patch" className="text-lg font-semibold">4. Review the proposed patch</h2>
          {editingPatch ? (
            <div className="mt-2">
              <label htmlFor="patch" className="block text-sm font-medium">
                Patch (unified diff) <span className="text-gray-500">(editing the proposed patch)</span>
              </label>
              <textarea
                id="patch"
                value={patch}
                onChange={(e) => setPatch(e.target.value)}
                placeholder={"Paste a unified diff here (optional), e.g.\n--- a/mathlib.py\n+++ b/mathlib.py\n@@ -1,4 +1,4 @@\n ..."}
                rows={8}
                className="mt-1 w-full rounded border border-gray-300 p-2 font-mono text-sm"
              />
            </div>
          ) : patch.trim() ? (
            <>
              <p className="mt-2 text-sm text-gray-600">
                This is the patch proposed for the current bug report. It has not been applied or tested yet.
              </p>
              <div className="mt-2">
                <DiffView diff={patch} />
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setEditingPatch(true)} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
                  Edit patch
                </button>
                <button
                  type="button"
                  onClick={() => { setPatch(""); setAnalysis(null); setEditingPatch(false); }}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
                >
                  Clear patch
                </button>
              </div>
            </>
          ) : (
            <div className="mt-2">
              <label htmlFor="patch" className="block text-sm font-medium">
                Patch (unified diff) <span className="text-gray-500">(optional — paste a unified diff to verify directly)</span>
              </label>
              <textarea
                id="patch"
                value={patch}
                onChange={(e) => { setPatch(e.target.value); if (e.target.value.trim() === "") setEditingPatch(false); }}
                placeholder={"Paste a unified diff here (optional), e.g.\n--- a/mathlib.py\n+++ b/mathlib.py\n@@ -1,4 +1,4 @@\n ..."}
                rows={8}
                className="mt-1 w-full rounded border border-gray-300 p-2 font-mono text-sm"
              />
            </div>
          )}
        </section>

        {/* Step 5: verify */}
        <section aria-labelledby="step-verify" className="mb-8">
          <h2 id="step-verify" className="text-lg font-semibold">5. Verify</h2>
          <p className="mt-2 text-sm text-gray-600">
            PatchPilot runs the predefined test suite against baseline and patched copies and compares the outcomes.
          </p>
          <p className="mt-1 text-xs text-gray-600">
            Test command sent to the backend: <code>{DEFAULT_TEST_COMMAND}</code>
          </p>
          <button
            type="button"
            onClick={handleVerify}
            disabled={!canVerify || verifying}
            aria-busy={verifying}
            className="mt-3 rounded bg-green-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-green-300 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {verifying ? "Verifying…" : "Verify"}
          </button>
          {!canVerify ? <p className="mt-2 text-sm text-gray-500">Run analysis or paste a patch to enable verification.</p> : null}
        </section>

        {/* Analysis summary */}
        {analysis ? (
          <section className="mb-8 rounded border border-gray-200 bg-white p-4" aria-labelledby="analysis-heading">
            <h2 id="analysis-heading" className="text-lg font-semibold">AI analysis</h2>
            <p className="mt-2 text-sm text-amber-700">
              This is an AI suggestion, not a verified fix. The verification status below comes from backend test execution.
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              {analysis.bug_summary ? (
                <div>
                  <dt className="font-medium">Summary</dt>
                  <dd className="text-gray-700 whitespace-pre-wrap">{toText(analysis.bug_summary)}</dd>
                </div>
              ) : null}
              {analysis.likely_root_cause ? (
                <div>
                  <dt className="font-medium">Likely root cause</dt>
                  <dd className="text-gray-700 whitespace-pre-wrap">{toText(analysis.likely_root_cause)}</dd>
                </div>
              ) : null}
              {analysis.evidence ? (
                <div>
                  <dt className="font-medium">Evidence</dt>
                  <dd className="text-gray-700 whitespace-pre-wrap">{toText(analysis.evidence)}</dd>
                </div>
              ) : null}
              {analysis.suggested_tests ? (
                <div>
                  <dt className="font-medium">Suggested tests</dt>
                  <dd className="text-gray-700 whitespace-pre-wrap">{toText(analysis.suggested_tests)}</dd>
                </div>
              ) : null}
              {analysis.limitations ? (
                <div>
                  <dt className="font-medium">Limitations</dt>
                  <dd className="text-gray-700 whitespace-pre-wrap">{toText(analysis.limitations)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        ) : null}

        {/* Error */}
        {error ? (
          <div className="mb-8 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
            <strong>Something went wrong.</strong> {error}
          </div>
        ) : null}

        {/* Results */}
        {result ? <ResultPanel result={result} /> : null}

        {!result ? (
          <section className="mt-8 rounded border border-dashed border-gray-300 p-4 text-center text-sm text-gray-600">
            Run the workflow to see baseline and patched test outcomes here.
          </section>
        ) : null}

        {history.length > 0 ? (
          <section className="mt-8 rounded border border-gray-200 bg-white p-4" aria-labelledby="history-heading">
            <h2 id="history-heading" className="text-lg font-semibold">Session history</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {history.map((h, i) => (
                <li key={i} className="flex flex-wrap gap-2 text-gray-700">
                  <span className="font-medium">{h.kind}</span>
                  <span className="text-gray-500">{h.sample}</span>
                  <span>{h.summary}</span>
                  <span className="ml-auto text-gray-400">{h.at}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
