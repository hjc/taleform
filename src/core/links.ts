export interface WikiLink {
  target: string;
  /** Includes the leading `#`, e.g. `#The Long Table`. */
  subpath?: string;
  alias?: string;
}

const WHOLE = /^\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]*))?\]\]$/;

/**
 * A property value that is exactly one wikilink. Anything else is not a link: Obsidian only
 * indexes (and rewrites on rename) a property link that is the entire value.
 */
export function parseLink(value: unknown): WikiLink | null {
  if (typeof value !== "string") return null;
  const m = WHOLE.exec(value.trim());
  if (!m) return null;
  const link: WikiLink = { target: m[1]!.trim() };
  if (m[2]) link.subpath = m[2];
  if (m[3] !== undefined) link.alias = m[3];
  return link;
}

/** The first wikilink anywhere in a string, for values that only start with one. */
export function findLink(value: unknown): WikiLink | null {
  if (typeof value !== "string") return null;
  const m = /\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]*))?\]\]/.exec(value);
  return m ? parseLink(m[0]) : null;
}
