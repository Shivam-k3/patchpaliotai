import { describe, expect, it } from "vitest";
import { EXECUTION_FAILED_DETAIL, extractErrorMessage, mapApiError } from "./errors";

describe("extractErrorMessage", () => {
  it("returns the detail string from a backend error payload", () => {
    expect(extractErrorMessage({ detail: "sample not found" }, "fallback")).toBe("sample not found");
  });

  it("joins pydantic validation error lists", () => {
    expect(extractErrorMessage({ detail: [{ msg: "field required" }] }, "fallback")).toBe("field required");
  });

  it("falls back when no usable detail exists", () => {
    expect(extractErrorMessage({}, "fallback message")).toBe("fallback message");
    expect(extractErrorMessage(null, "fallback message")).toBe("fallback message");
  });
});

describe("mapApiError", () => {
  it("explains execution failures and keeps them inconclusive", () => {
    const message = mapApiError(500, EXECUTION_FAILED_DETAIL, "fallback");
    expect(message).toContain("inconclusive");
    expect(message).toContain("no success was claimed");
  });

  it("maps known backend validation details to friendly messages", () => {
    expect(mapApiError(400, "sample not found", "fallback")).toBe(
      "The selected sample could not be found. Please choose a valid sample and try again.",
    );
    expect(mapApiError(400, "patch required", "fallback")).toBe("Please provide a unified diff before running verification.");
  });

  it("includes the detail for unmapped errors", () => {
    expect(mapApiError(502, "GEMINI_API_KEY not configured", "fallback")).toContain("GEMINI_API_KEY not configured");
  });
});
