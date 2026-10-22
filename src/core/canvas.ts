/** JSON Canvas 1.0, as much of it as Taleform writes. */
export interface CanvasNode {
  id: string;
  type: "text" | "file" | "link" | "group";
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  [key: string]: unknown;
}

export interface Canvas {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export function parseCanvas(text: string | undefined): Canvas {
  if (!text?.trim()) return { nodes: [], edges: [] };
  const data = JSON.parse(text) as Partial<Canvas>;
  return { nodes: data.nodes ?? [], edges: data.edges ?? [] };
}

/** Python-`json.dumps(indent="\t")`-compatible output, the shape the vault's maps already have. */
export const formatCanvas = (c: Canvas) => JSON.stringify(c, null, "\t") + "\n";

/**
 * Two canvases are the same if they hold the same items by id, ignoring key order, item order,
 * and what Obsidian drops on save (`toEnd: "arrow"` is the default). Formatting never counts.
 */
export function sameCanvas(a: string, b: string): boolean {
  try {
    return canonical(parseCanvas(a)) === canonical(parseCanvas(b));
  } catch {
    return false;
  }
}

function canonical(c: Canvas): string {
  const norm = (items: Array<Record<string, unknown>>) =>
    items
      .map((it) => {
        const o = { ...it };
        if (o.toEnd === "arrow") delete o.toEnd;
        return sortKeys(o);
      })
      .sort((x, y) => String(x.id).localeCompare(String(y.id)));
  return JSON.stringify({ nodes: norm(c.nodes), edges: norm(c.edges) });
}

function sortKeys(o: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
}
