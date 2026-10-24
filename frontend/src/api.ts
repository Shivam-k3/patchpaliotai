import type { AnalyzeResponse, VerificationResult } from "./types";
import { extractErrorMessage, mapApiError } from "./lib/errors";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:8000";
const DEFAULT_TIMEOUT_MS = 30000;
const ANALYZE_TIMEOUT_MS = 180000;
export const DEFAULT_TEST_COMMAND = "python -m pytest -v";
const VERIFICATION_TIMEOUT_MS = 600000;

export interface HealthResponse {
  status?: string;
  service?: string;
  [key: string]: unknown;
}

export interface ReadyResponse {
  ready?: boolean;
  checks?: {
    docker?: boolean;
    samples_dir?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ProjectInfo {
  id: string;
  label: string;
  runtime: string;
  test_command: string;
  build_command: string;
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseErrorResponse(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => "");
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  const detail = extractErrorMessage(payload, fallback);
  return mapApiError(res.status, detail, fallback);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isAnalyzeResponse(value: unknown): value is AnalyzeResponse {
  if (!value || typeof value !== "object") return false;
  const diff = (value as { proposed_unified_diff?: unknown }).proposed_unified_diff;
  return typeof diff === "string" && diff.trim().length > 0;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, "The backend health check failed."));
  }
  return (await res.json()) as HealthResponse;
}

export async function fetchReady(): Promise<ReadyResponse> {
  const res = await fetchWithTimeout(`${API_BASE}/ready`);
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, "The backend readiness check failed."));
  }
  return (await res.json()) as ReadyResponse;
}

export async function fetchSamples(): Promise<string[]> {
  const res = await fetchWithTimeout(`${API_BASE}/api/samples`);
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, "Could not load the sample list from the backend."));
  }
  const data = (await res.json()) as { samples?: unknown };
  const list = Array.isArray(data.samples) ? data.samples : [];
  return list.filter((s): s is string => typeof s === "string");
}

export async function fetchProjects(): Promise<ProjectInfo[]> {
  const res = await fetchWithTimeout(`${API_BASE}/api/projects`);
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res, "Could not load the registered projects."));
  }
  const data = (await res.json()) as { projects?: unknown };
  return Array.isArray(data.projects) ? data.projects.filter((p): p is ProjectInfo => typeof p === "object" && p !== null && typeof (p as ProjectInfo).id === "string") : [];
}

export async function analyzeBug(bugReport: string, sampleName?: string, projectId?: string): Promise<AnalyzeResponse> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bug_report: bugReport, sample_name: sampleName || undefined, project_id: projectId || undefined }),
    }, ANALYZE_TIMEOUT_MS);
    if (!res.ok) {
      throw new Error(await parseErrorResponse(res, "The analysis request failed."));
    }
    const data: unknown = await res.json();
    if (!isAnalyzeResponse(data)) {
      throw new Error("The AI response did not include a valid proposed patch. Review the provider response and try again.");
    }
    return data;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("Analysis timed out before the backend responded. No patch was accepted; please retry.");
    }
    throw error;
  }
}

export async function verifyPatch(sampleName: string, patchText: string, testCommand?: string, projectId?: string): Promise<VerificationResult> {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sample_name: projectId ? undefined : sampleName, project_id: projectId || undefined, patch_text: patchText, test_command: testCommand || DEFAULT_TEST_COMMAND }),
    }, VERIFICATION_TIMEOUT_MS);
    if (!res.ok) {
      throw new Error(await parseErrorResponse(res, "The verification request failed."));
    }
    const data = (await res.json()) as VerificationResult;
    return data;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("Verification timed out before the backend responded. No success was claimed; please retry.");
    }
    throw error;
  }
}