import { splitFrontmatter, str, type Frontmatter } from "./frontmatter";
import { findLink, parseLink, type WikiLink } from "./links";
import { basename, dirname, toLF, type VaultIO } from "./vault";

/** Notes that sit on a mission's main line, in `act`/`beat` order. */
export const SEQ_KINDS = new Set(["act", "beat", "scene", "combat", "challenge"]);

export interface Note {
  path: string;
  basename: string;
  folder: string;
  /** LF-normalised content. */
  text: string;
  crlf: boolean;
  fm: Frontmatter;
  /** Index of the closing frontmatter `---` in `text.split("\n")`, or -1. */
  fmEnd: number;
  fmError?: string;
  kind?: string;
  /** The H1 text, or the basename when there is none. */
  title: string;
  h1Line: number | null;
}

/**
 * The story graph Taleform builds from. It is read from the same notes and frontmatter that
 * Obsidian (and Bases) index, through `VaultIO`, so the plugin and the CLI see one model.
 */
export class StoryIndex {
  readonly notes = new Map<string, Note>();
  readonly canvases = new Set<string>();
  private readonly byName = new Map<string, Note[]>();

  static async load(io: VaultIO): Promise<StoryIndex> {
    const idx = new StoryIndex();
    for (const path of (await io.list()).sort()) {
      if (path.endsWith(".canvas")) {
        idx.canvases.add(path);
        continue;
      }
      if (!path.endsWith(".md")) continue;
      idx.add(path, await io.read(path));
    }
    return idx;
  }

  add(path: string, raw: string): Note {
    const { text, crlf } = toLF(raw);
    const split = splitFrontmatter(text);
    const lines = split.lines;
    let h1: number | null = null;
    for (let i = split.end + 1; i < lines.length; i++) {
      if (lines[i]!.startsWith("# ")) {
        h1 = i;
        break;
      }
    }
    const note: Note = {
      path, basename: basename(path), folder: dirname(path), text, crlf,
      fm: split.fm, fmEnd: split.end, kind: str(split.fm.kind),
      title: h1 !== null ? lines[h1]!.slice(2).trim() : basename(path), h1Line: h1,
    };
    if (split.error) note.fmError = split.error;
    this.notes.set(path, note);
    const named = this.byName.get(note.basename) ?? [];
    named.push(note);
    this.byName.set(note.basename, named);
    return note;
  }

  /** Resolve a link target the way Obsidian does for a basename: unique name, else shortest path. */
  resolve(link: WikiLink | string | null | undefined): Note | undefined {
    const target = typeof link === "string" ? link : link?.target;
    if (!target) return undefined;
    if (target.includes("/")) {
      const want = target.endsWith(".md") ? target : `${target}.md`;
      return this.notes.get(want) ?? [...this.notes.values()].find((n) => n.path.endsWith(`/${want}`));
    }
    const hits = this.byName.get(target.replace(/\.md$/, ""));
    if (!hits?.length) return undefined;
    return hits.length === 1 ? hits[0] : [...hits].sort((a, b) => a.path.split("/").length - b.path.split("/").length)[0];
  }

  /** Resolve a frontmatter value that must be a whole link. */
  link(value: unknown): Note | undefined {
    return this.resolve(parseLink(value) ?? findLink(value));
  }

  /** Every note with `kind: mission`. */
  missions(): Note[] {
    return [...this.notes.values()].filter((n) => n.kind === "mission");
  }

  /** Every note whose `mission` property links to this mission. Membership is the link, never the folder. */
  members(mission: Note): Note[] {
    return [...this.notes.values()].filter((n) => n !== mission && this.link(n.fm.mission) === mission);
  }
}
