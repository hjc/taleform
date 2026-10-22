import { parse } from "yaml";

export type Frontmatter = Record<string, unknown>;

export interface Split {
  fm: Frontmatter;
  /** Index of the closing `---` line, or -1 when there is no frontmatter. */
  end: number;
  lines: string[];
  error?: string;
}

/** Parse the YAML frontmatter of an LF note. Builders read it; they never write it. */
export function splitFrontmatter(text: string): Split {
  const lines = text.split("\n");
  if (lines[0] !== "---") return { fm: {}, end: -1, lines };
  const end = lines.indexOf("---", 1);
  if (end < 0) return { fm: {}, end: -1, lines, error: "frontmatter is never closed" };
  try {
    const data = parse(lines.slice(1, end).join("\n")) ?? {};
    if (typeof data !== "object" || Array.isArray(data)) return { fm: {}, end, lines, error: "frontmatter is not a mapping" };
    return { fm: normalize(data) as Frontmatter, end, lines };
  } catch (e) {
    return { fm: {}, end, lines, error: `invalid YAML: ${(e as Error).message.split("\n")[0]}` };
  }
}

/**
 * An unquoted `[[Note]]` is valid YAML for a nested list. Obsidian always quotes links it
 * writes, but a hand-typed one must still mean the link, so fold `[["Note"]]` back.
 */
function normalize(v: unknown): unknown {
  if (Array.isArray(v)) {
    if (v.length === 1 && Array.isArray(v[0]) && v[0].length === 1 && typeof v[0][0] === "string") return `[[${v[0][0]}]]`;
    return v.map(normalize);
  }
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)]));
  return v;
}

export const str = (v: unknown): string | undefined =>
  v === null || v === undefined || v === "" ? undefined : String(v);

export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === null || v === undefined || v === "" ? [] : [v]);

export const truthy = (v: unknown) => v === true || v === "true";
