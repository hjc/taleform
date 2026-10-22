import type { VaultIO } from "../src/core/vault";

/** An in-memory vault for tests: a path → content map. */
export class MemoryVault implements VaultIO {
  constructor(readonly files: Record<string, string>) {}
  async list() {
    return Object.keys(this.files);
  }
  async read(path: string) {
    const f = this.files[path];
    if (f === undefined) throw new Error(`no such file: ${path}`);
    return f;
  }
  async write(path: string, content: string) {
    this.files[path] = content;
  }
}

export const note = (fm: Record<string, string | number | boolean>, body: string) =>
  `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${typeof v === "string" && v.startsWith("[[") ? JSON.stringify(v) : v}`).join("\n")}\n---\n${body}`;
