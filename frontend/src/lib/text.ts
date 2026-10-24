import type { TextBlock } from "../types";

export function toText(value: TextBlock): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join("\n");
  return String(value);
}