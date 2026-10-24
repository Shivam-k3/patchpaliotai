export type DiffLineType = "context" | "added" | "removed" | "header";

export interface DiffLine {
  type: DiffLineType;
  content: string;
}

/**
 * Parse a unified diff into typed lines.
 * Context lines lose their leading marker space, added/removed keep their
 * content only, and ---/+++ /@@ headers are typed as "header".
 */
export function parseDiff(diff: string): DiffLine[] {
  const normalized = diff.replace(/\r\n?/g, "\n");
  const rawLines = normalized.split("\n");
  if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }
  const lines: DiffLine[] = [];
  for (const raw of rawLines) {
    if (raw.startsWith("---") || raw.startsWith("+++") || raw.startsWith("@@")) {
      lines.push({ type: "header", content: raw });
      continue;
    }
    if (raw.startsWith("+")) {
      lines.push({ type: "added", content: raw.slice(1) });
      continue;
    }
    if (raw.startsWith("-")) {
      lines.push({ type: "removed", content: raw.slice(1) });
      continue;
    }
    lines.push({ type: "context", content: raw.startsWith(" ") ? raw.slice(1) : raw });
  }
  return lines;
}
