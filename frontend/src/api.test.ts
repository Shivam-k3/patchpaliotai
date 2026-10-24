import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeBug } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function response(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe("analyzeBug", () => {
  it("parses a successful backend response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({
      bug_summary: "Fix email validation",
      proposed_unified_diff: "--- a/src/lib/validation.ts\n+++ b/src/lib/validation.ts\n",
    })));

    await expect(analyzeBug("fix email validation", undefined, "northstar-landing-page-bugtest")).resolves.toMatchObject({
      bug_summary: "Fix email validation",
      proposed_unified_diff: expect.stringContaining("--- a/"),
    });
  });

  it("rejects a successful response with no usable patch", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ bug_summary: "missing diff" })));

    await expect(analyzeBug("fix email validation")).rejects.toThrow(/valid proposed patch/i);
  });

  it("maps an AbortController timeout to an actionable error", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })));

    const request = analyzeBug("fix email validation");
    const rejection = expect(request).rejects.toThrow(/timed out/i);
    await vi.advanceTimersByTimeAsync(180000);
    await rejection;
  });
});
