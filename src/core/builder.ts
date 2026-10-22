import type { StoryIndex } from "./index";

export type Severity = "error" | "warning";

export interface Problem {
  builder: string;
  severity: Severity;
  path?: string;
  message: string;
}

export interface BuildOptions {
  /** Only build these missions (by note basename). */
  missions?: string[];
  /** Discard positions the DM dragged on generated maps. */
  relayout?: boolean;
  /** Draw `related` threads on adventure maps. */
  threads?: boolean;
}

export interface EmitOptions {
  /** Content equality for this output; defaults to exact text. Maps compare semantically. */
  same?: (before: string, after: string) => boolean;
}

/**
 * What a builder sees. `read` is overlay-aware: it returns what earlier builders in this run
 * emitted, so builders compose. `emit` never touches disk; the engine decides what changed.
 */
export interface BuildContext {
  readonly index: StoryIndex;
  readonly options: BuildOptions;
  read(path: string): string | undefined;
  emit(path: string, content: string, opts?: EmitOptions): void;
  problem(severity: Severity, message: string, path?: string): void;
}

/**
 * A builder turns typed frontmatter into one kind of generated resource. Builders never write
 * frontmatter: it is source only, so no build can feed back into itself.
 */
export interface Builder {
  readonly id: string;
  readonly description: string;
  run(ctx: BuildContext): void | Promise<void>;
}
