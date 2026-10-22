/**
 * The one seam between Taleform's core and the world. The Obsidian plugin implements it
 * over `app.vault`, the CLI over the filesystem; builders never see either.
 * Paths are vault-relative and always use forward slashes.
 */
export interface VaultIO {
  /** Every .md and .canvas file in the vault. */
  list(): Promise<string[]>;
  read(path: string): Promise<string>;
  /** Create or overwrite. Parent folders are created as needed. */
  write(path: string, content: string): Promise<void>;
}

/** Split a file into LF text plus whether it came in with CRLF, so a write can preserve it. */
export function toLF(raw: string): { text: string; crlf: boolean } {
  const crlf = raw.includes("\r\n");
  return { text: crlf ? raw.replace(/\r\n/g, "\n") : raw, crlf };
}

export function fromLF(text: string, crlf: boolean): string {
  return crlf ? text.replace(/\n/g, "\r\n") : text;
}

export const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
export const dirname = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
