import type { Classification, TestStatus } from "../types";

export interface ClassificationMeta {
  label: string;
  shortLabel: string;
  description: string;
  tone: "green" | "red" | "amber" | "blue" | "gray";
}

export const CLASSIFICATIONS: Record<Classification, ClassificationMeta> = {
  IMPROVED: {
    label: "Improved",
    shortLabel: "IMPROVED",
    description:
      "At least one original failure was resolved and no new failures were observed among comparable tests.",
    tone: "green",
  },
  REGRESSION_DETECTED: {
    label: "Regression detected",
    shortLabel: "REGRESSION_DETECTED",
    description:
      "At least one previously passing test now fails. A regression takes precedence over an improvement.",
    tone: "red",
  },
  PARTIAL_FIX: {
    label: "Partial fix",
    shortLabel: "PARTIAL_FIX",
    description: "Some original failures were resolved, but failures remain.",
    tone: "amber",
  },
  NO_IMPROVEMENT: {
    label: "No improvement",
    shortLabel: "NO_IMPROVEMENT",
    description: "The available comparable results showed no meaningful improvement.",
    tone: "blue",
  },
  INCONCLUSIVE: {
    label: "Inconclusive",
    shortLabel: "INCONCLUSIVE",
    description:
      "The evidence is incomplete or unreliable, so no firm conclusion could be drawn.",
    tone: "gray",
  },
};

export function getClassificationMeta(classification: Classification): ClassificationMeta {
  return CLASSIFICATIONS[classification];
}

export const TEST_STATUS_META: Record<TestStatus, { label: string; tone: "green" | "red" | "amber" | "gray" }> = {
  PASSED: { label: "Passed", tone: "green" },
  FAILED: { label: "Failed", tone: "red" },
  ERROR: { label: "Error", tone: "amber" },
  TIMEOUT: { label: "Timeout", tone: "red" },
  SKIPPED: { label: "Skipped", tone: "gray" },
};

export function getTestStatusMeta(status: TestStatus) {
  return TEST_STATUS_META[status];
}
