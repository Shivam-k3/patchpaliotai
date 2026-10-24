import { describe, expect, it } from "vitest";
import { parseDiff } from "./diff";

describe("parseDiff", () => {
  it("parses context, added and removed lines", () => {
    const diff = [
      "--- a/mathlib.py",
      "+++ b/mathlib.py",
      "@@ -1,4 +1,4 @@",
      " def divide(a, b):",
      "-    return a / b",
      "+    return a / b if b else 0",
    ].join("\n");

    expect(parseDiff(diff)).toEqual([
      { type: "header", content: "--- a/mathlib.py" },
      { type: "header", content: "+++ b/mathlib.py" },
      { type: "header", content: "@@ -1,4 +1,4 @@" },
      { type: "context", content: "def divide(a, b):" },
      { type: "removed", content: "    return a / b" },
      { type: "added", content: "    return a / b if b else 0" },
    ]);
  });

  it("strips the leading marker from context lines", () => {
    const lines = parseDiff("--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n ctx");
    expect(lines[3]).toEqual({ type: "removed", content: "old" });
    expect(lines[4]).toEqual({ type: "added", content: "new" });
    expect(lines[5]).toEqual({ type: "context", content: "ctx" });
  });

  it("handles CRLF line endings and trailing newline", () => {
    const lines = parseDiff("--- a/x\r\n+++ b/x\r\n@@ -1 +1 @@\r\n-a\r\n+b\r\n");
    expect(lines).toHaveLength(5);
    expect(lines[3]).toEqual({ type: "removed", content: "a" });
    expect(lines[4]).toEqual({ type: "added", content: "b" });
  });

  it("returns an empty list for an empty diff", () => {
    expect(parseDiff("")).toEqual([]);
  });
});
