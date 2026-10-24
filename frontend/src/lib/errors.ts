export const EXECUTION_FAILED_DETAIL = "execution_failed_or_unavailable";

export function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail;
    }
    if (Array.isArray(detail) && detail.length > 0) {
      const messages = detail
        .map((d) => {
          if (d && typeof d === "object" && typeof (d as { msg?: unknown }).msg === "string") {
            return (d as { msg: string }).msg;
          }
          return String(d);
        })
        .filter((m) => m && m.trim().length > 0);
      if (messages.length > 0) {
        return messages.join("; ");
      }
    }
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim().length > 0) {
      return error;
    }
  }
  return fallback;
}

function friendlyForStatus(status: number, detail: string, fallback: string): string {
  const clean = (detail || fallback).trim();
  if (clean === EXECUTION_FAILED_DETAIL) {
    return "Verification execution failed or was unavailable (for example the test runner could not start). The result was marked inconclusive; no success was claimed.";
  }
  switch (status) {
    case 400:
      switch (clean) {
        case "sample not found":
          return "The selected sample could not be found. Please choose a valid sample and try again.";
        case "patch required":
          return "Please provide a unified diff before running verification.";
        case "invalid patch":
          return "The proposed patch is invalid or could not be applied. Please review the diff and try again.";
        case "bug report required":
          return "Please describe the bug before running analysis.";
        case "bug report too large":
          return "The bug description is too long. Please shorten it and try again.";
        case "patch too large":
          return "The patch is too large. Please provide a smaller diff.";
        case "unsupported test command":
          return "The selected test command is not supported by the backend.";
        case "sample required":
          return "Please select a sample project.";
        default:
          return `The request was rejected by the backend: ${clean}`;
      }
    case 422:
      return `The request was invalid: ${clean}`;
    case 502:
      if (clean.startsWith("Gemini is temporarily unavailable")) {
        return "Gemini is temporarily unavailable. Wait a moment and retry, or configure another available Gemini model.";
      }
      if (clean.startsWith("Gemini quota or rate limit exceeded")) {
        return "Gemini is temporarily rate-limited or out of quota. Check the backend API key/project quota, wait, or use another valid key.";
      }
      if (clean.startsWith("Gemini authentication or permission failed")) {
        return "Gemini rejected the backend credentials. Check GEMINI_API_KEY and the Google project permissions.";
      }
      return `The AI could not generate a patch: ${clean}`;
    case 500:
      return `The backend could not complete the request: ${clean}`;
    default:
      return clean || `The backend returned an error (status ${status}).`;
  }
}

export function mapApiError(status: number, detail: string, fallback: string): string {
  const clean = detail.trim() || fallback;
  return friendlyForStatus(status, clean, fallback);
}
