import type { WebHandoffPayload } from "./types";

/**
 * Structural diff between two web payloads. Pure functions — used by the
 * Handoff Engine UI, and by the WebMCP prepare_web_handoff tool to describe
 * what a re-preparation changed versus the previous draft.
 */

export type DiffKind = "changed" | "added" | "removed";

export interface PayloadDiffRow {
  path: string;
  kind: DiffKind;
  before: string | null;
  after: string | null;
}

type Primitive = string | number | boolean | null;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isPrimitive(v: unknown): v is Primitive {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

/** Flatten an object into `path -> primitive | JSON-stringified structure`. */
function flatten(
  value: unknown,
  prefix = "",
  out: Record<string, unknown> = {}
): Record<string, unknown> {
  if (isPlainObject(value)) {
    if (Object.keys(value).length === 0) {
      out[prefix] = "{}";
    }
    for (const [k, v] of Object.entries(value)) {
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      out[prefix] = "[]";
    }
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (isPrimitive(value)) {
    out[prefix] = value;
  } else {
    out[prefix] = JSON.stringify(value);
  }
  return out;
}

function render(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") {
    const s = v.replace(/\s+/g, " ").trim();
    return s.length > 96 ? `${s.slice(0, 93)}…` : s;
  }
  return String(v);
}

/** Field-level diff between two payload versions, ordered by path. */
export function diffPayloads(
  before: WebHandoffPayload,
  after: WebHandoffPayload
): PayloadDiffRow[] {
  const a = flatten(before);
  const b = flatten(after);
  const paths = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();

  const rows: PayloadDiffRow[] = [];
  for (const p of paths) {
    const oldVal = p in a ? a[p] : undefined;
    const newVal = p in b ? b[p] : undefined;
    if (oldVal === newVal) continue;
    // Only compare meaningful fields: handoffRef/generatedAt always change.
    if (p === "handoffRef" || p === "generatedAt") continue;
    rows.push({
      path: p,
      kind:
        oldVal === undefined ? "added" : newVal === undefined ? "removed" : "changed",
      before: oldVal === undefined ? null : render(oldVal),
      after: newVal === undefined ? null : render(newVal),
    });
  }
  return rows;
}
