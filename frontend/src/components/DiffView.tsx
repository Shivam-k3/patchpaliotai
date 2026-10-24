import type { DiffLine } from "../lib/diff";
import { parseDiff } from "../lib/diff";

const HEADER_TONE = "text-gray-500 bg-gray-100";
const ADDED_TONE = "bg-green-50 text-green-800";
const REMOVED_TONE = "bg-red-50 text-red-800";
const CONTEXT_TONE = "text-gray-800";

interface DiffViewProps {
  diff: string;
}

export default function DiffView({ diff }: DiffViewProps) {
  const lines: DiffLine[] = parseDiff(diff);

  if (lines.length === 0) {
    return <p className="text-sm text-gray-500">No diff content to display.</p>;
  }

  return (
    <div
      className="overflow-auto max-h-96 rounded border border-gray-200 bg-white font-mono text-sm"
      role="region"
      aria-label="Proposed patch diff"
    >
      <div className="min-w-max">
        {lines.map((line, index) => {
          const lineNumber = index + 1;
          let rowTone = CONTEXT_TONE;
          if (line.type === "header") {
            rowTone = HEADER_TONE;
          } else if (line.type === "added") {
            rowTone = ADDED_TONE;
          } else if (line.type === "removed") {
            rowTone = REMOVED_TONE;
          }
          return (
            <div key={`${lineNumber}-${line.type}-${line.content}`} className={`flex ${rowTone}`}>
              <span className="w-12 shrink-0 select-none pr-3 text-right text-xs text-gray-400" aria-hidden="true">
                {lineNumber}
              </span>
              <span className="whitespace-pre-wrap break-all py-0.5">{line.content || " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
