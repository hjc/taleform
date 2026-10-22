import type { BuildContext, BuildOptions, Builder, EmitOptions, Problem, Severity } from "./builder";
import { StoryIndex } from "./index";
import type { VaultIO } from "./vault";

export interface Change {
  path: string;
  builder: string;
  created: boolean;
}

export interface BuildResult {
  changes: Change[];
  problems: Problem[];
  /** Whether the changes were written (false for a check / dry run). */
  written: boolean;
}

/**
 * Run every builder in order over one story index. Each emit lands in an overlay that later
 * builders read through; at the end, anything that differs from disk is a change.
 */
export async function build(io: VaultIO, builders: Builder[], options: BuildOptions = {}, write = true): Promise<BuildResult> {
  const index = await StoryIndex.load(io);
  const disk = new Map<string, string | null>();
  const overlay = new Map<string, { content: string; builder: string; same?: EmitOptions["same"] }>();
  const problems: Problem[] = [];
  const known = new Set([...index.notes.keys(), ...index.canvases]);

  // StoryIndex.load already read every note; re-read lazily only what builders touch.
  const original = async (path: string) => {
    if (!disk.has(path)) disk.set(path, known.has(path) ? await io.read(path) : null);
    return disk.get(path) ?? null;
  };
  const preload = new Map<string, string>();
  for (const n of index.notes.values()) preload.set(n.path, n.crlf ? n.text.replace(/\n/g, "\r\n") : n.text);
  for (const c of index.canvases) preload.set(c, await io.read(c));

  for (const builder of builders) {
    const ctx: BuildContext = {
      index,
      options,
      read: (path) => overlay.get(path)?.content ?? preload.get(path),
      emit: (path, content, opts?: EmitOptions) => {
        const entry: { content: string; builder: string; same?: EmitOptions["same"] } = { content, builder: builder.id };
        if (opts?.same) entry.same = opts.same;
        overlay.set(path, entry);
      },
      problem: (severity: Severity, message: string, path?: string) => {
        const p: Problem = { builder: builder.id, severity, message };
        if (path) p.path = path;
        problems.push(p);
      },
    };
    await builder.run(ctx);
  }

  const changes: Change[] = [];
  for (const [path, out] of overlay) {
    const before = await original(path);
    const same = before !== null && (out.same ? out.same(before, out.content) : before === out.content);
    if (same) continue;
    changes.push({ path, builder: out.builder, created: before === null });
    if (write) await io.write(path, out.content);
  }
  return { changes, problems, written: write };
}
