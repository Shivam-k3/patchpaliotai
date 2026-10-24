import { describe, expect, it } from "vitest";
import { CLASSIFICATIONS, getClassificationMeta, getTestStatusMeta } from "./status";
import type { Classification, TestStatus } from "../types";

describe("classification helpers", () => {
  it("exposes all required classifications", () => {
    const expected: Classification[] = [
      "IMPROVED",
      "REGRESSION_DETECTED",
      "PARTIAL_FIX",
      "NO_IMPROVEMENT",
      "INCONCLUSIVE",
    ];
    expect(Object.keys(CLASSIFICATIONS).sort()).toEqual([...expected].sort());
  });

  it("gives every classification a label, description and tone", () => {
    for (const meta of Object.values(CLASSIFICATIONS)) {
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(["green", "red", "amber", "blue", "gray"]).toContain(meta.tone);
    }
  });

  it("looks up classification metadata by value", () => {
    expect(getClassificationMeta("REGRESSION_DETECTED").shortLabel).toBe("REGRESSION_DETECTED");
    expect(getClassificationMeta("INCONCLUSIVE").label).toBe("Inconclusive");
  });
});

describe("test status helpers", () => {
  it("maps every test status to a label and tone", () => {
    const statuses: TestStatus[] = ["PASSED", "FAILED", "ERROR", "TIMEOUT", "SKIPPED"];
    for (const status of statuses) {
      expect(getTestStatusMeta(status).label.length).toBeGreaterThan(0);
    }
  });
});
