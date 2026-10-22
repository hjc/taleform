import { debounce, Notice, Plugin, TFile, normalizePath, type App } from "obsidian";
import { BUILDERS } from "../builders/index";
import type { BuildOptions } from "../core/builder";
import { build, type BuildResult } from "../core/engine";
import type { VaultIO } from "../core/vault";

interface Settings {
  /** Rebuild shortly after any note's metadata changes. */
  autoBuild: boolean;
}

const DEFAULTS: Settings = { autoBuild: true };

/** VaultIO over Obsidian's own vault API, so every write is seen, indexed and repainted. */
class ObsidianVault implements VaultIO {
  constructor(private readonly app: App) {}

  async list() {
    // templates hold placeholders, not story data
    const tpl = (this.app as unknown as { internalPlugins: { getEnabledPluginById(id: string): { options?: { folder?: string } } | null } })
      .internalPlugins.getEnabledPluginById("templates")?.options?.folder?.replace(/^\/+|\/+$/g, "");
    return this.app.vault
      .getFiles()
      .filter((f) => (f.extension === "md" || f.extension === "canvas") && !(tpl && (f.path === tpl || f.path.startsWith(`${tpl}/`))))
      .map((f) => f.path);
  }

  async read(path: string) {
    const f = this.app.vault.getFileByPath(path);
    if (!f) throw new Error(`no such file: ${path}`);
    return this.app.vault.read(f);
  }

  async write(path: string, content: string) {
    path = normalizePath(path);
    const f = this.app.vault.getFileByPath(path);
    if (f) return this.app.vault.modify(f, content);
    const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    if (dir && !this.app.vault.getFolderByPath(dir)) await this.app.vault.createFolder(dir);
    await this.app.vault.create(path, content);
  }
}

export default class TaleformPlugin extends Plugin {
  prefs: Settings = DEFAULTS;
  private status!: HTMLElement;
  private running: Promise<BuildResult> | null = null;

  override async onload() {
    this.prefs = { ...DEFAULTS, ...((await this.loadData()) as Partial<Settings> | null) };
    this.status = this.addStatusBarItem();
    this.status.setText("Taleform");

    this.addCommand({ id: "build", name: "Build everything", callback: () => this.run({}, true, true) });
    this.addCommand({ id: "check", name: "Check (change nothing)", callback: () => this.run({}, false, true) });
    this.addCommand({
      id: "toggle-auto-build",
      name: "Toggle building on change",
      callback: async () => {
        this.prefs.autoBuild = !this.prefs.autoBuild;
        await this.saveData(this.prefs);
        new Notice(`Taleform: build on change ${this.prefs.autoBuild ? "on" : "off"}`);
      },
    });

    // Builds are idempotent, so the change events our own writes cause settle after one pass.
    const auto = debounce(() => void this.run({}, true, false), 1500, true);
    this.app.workspace.onLayoutReady(() => {
      this.registerEvent(this.app.metadataCache.on("changed", (file: TFile) => {
        if (this.prefs.autoBuild && file.extension === "md") auto();
      }));
    });
  }

  /** The entry point for the CLI and scripts: `app.plugins.plugins.taleform.run(...)`. */
  async run(options: BuildOptions = {}, write = true, loud = false): Promise<BuildResult> {
    if (this.running) await this.running.catch(() => undefined);
    this.running = build(new ObsidianVault(this.app), BUILDERS, options, write);
    try {
      const r = await this.running;
      const errors = r.problems.filter((p) => p.severity === "error");
      this.status.setText(errors.length ? `Taleform: ${errors.length} problem${errors.length > 1 ? "s" : ""}` : "Taleform ✓");
      this.status.title = r.problems.map((p) => `${p.path ?? ""}: ${p.message}`).join("\n");
      if (loud) {
        const what = write ? `${r.changes.length} file${r.changes.length === 1 ? "" : "s"} rebuilt` : `${r.changes.length} stale`;
        new Notice(`Taleform: ${what}, ${errors.length} error${errors.length === 1 ? "" : "s"}`);
      }
      return r;
    } finally {
      this.running = null;
    }
  }
}
