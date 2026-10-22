/**
 * Generated regions inside a hand-written note:
 *
 *     %% taleform:resume %%
 *     …generated…
 *     %% /taleform:resume %%
 *
 * The markers are Obsidian comments, invisible when reading. Everything between them belongs
 * to Taleform; everything outside them belongs to the author.
 */
const open = (id: string) => `%% taleform:${id} %%`;
const close = (id: string) => `%% /taleform:${id} %%`;

export interface RegionHit {
  start: number;
  end: number;
}

/** Line indexes of a region's markers in LF lines, or null. */
export function findRegion(lines: string[], id: string): RegionHit | null {
  const start = lines.findIndex((l) => l.trim() === open(id));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.trim() === close(id));
  return end < 0 ? null : { start, end };
}

/**
 * Replace a region's content. When the note has no region yet, `insertAt` (a line index)
 * places a new one there; without it, the note is returned unchanged and `found` is false.
 * Empty content removes the region (and one blank line after it) entirely.
 */
export function setRegion(text: string, id: string, content: string[], insertAt?: number): { text: string; found: boolean } {
  const lines = text.split("\n");
  const hit = findRegion(lines, id);
  const block = content.length ? [open(id), ...content, close(id)] : [];
  if (hit) {
    let end = hit.end + 1;
    if (!block.length && lines[end] === "") end++;
    lines.splice(hit.start, end - hit.start, ...block);
    return { text: lines.join("\n"), found: true };
  }
  if (insertAt === undefined || !block.length) return { text, found: false };
  lines.splice(insertAt, 0, ...block, "");
  return { text: lines.join("\n"), found: true };
}
