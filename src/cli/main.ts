import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { BUILDERS } from "../builders/index";
import type { BuildOptions } from "../core/builder";
import { build, type BuildResult } from "../core/engine";
import type { VaultIO } from "../core/vault";

const USAGE = `taleform — build a vault's generated story resources

  taleform build [options]   regenerate everything that is stale
  taleform check [options]   change nothing; exit 1 if anything is stale or invalid

  --vault <dir>      the vault (default: nearest folder above cwd containing .obsidian)
  --mission <name>   only this mission (repeatable)
  --relayout         discard dragged positions on generated maps
  --threads          draw related threads on adventure maps
  --json             machine-readable result
`;

class FsVault implements VaultIO {
  constructor(readonly root: string) {}

  async list(): Promise<string[]> {
    const out: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (name.startsWith(".") || name === "node_modules") continue;
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (name.endsWith(".md") || name.endsWith(".canvas")) out.push(relative(this.root, full).split(sep).join("/"));
      }
    };
    walk(this.root);
    return out;
  }

  async read(path: string) {
    return readFileSync(join(this.root, path), "utf8");
  }

  async write(path: string, content: string) {
    const full = join(this.root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, "utf8");
  }
}

function findVault(from: string): string | null {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".obsidian"))) return dir;
    if (dirname(dir) === dir) return null;
  }
}

export async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (cmd !== "build" && cmd !== "check") {
    process.stdout.write(USAGE);
    return cmd === "help" || cmd === "--help" ? 0 : 2;
  }
  const options: BuildOptions = {};
  let vault: string | null = null;
  let json = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--vault") vault = rest[++i] ?? null;
    else if (a === "--mission") (options.missions ??= []).push(rest[++i] ?? "");
    else if (a === "--relayout") options.relayout = true;
    else if (a === "--threads") options.threads = true;
    else if (a === "--json") json = true;
    else {
      process.stderr.write(`unknown option ${a}\n${USAGE}`);
      return 2;
    }
  }
  const root = vault ? resolve(vault) : findVault(process.cwd());
  if (!root || !existsSync(join(root, ".obsidian"))) {
    process.stderr.write("no Obsidian vault found (pass --vault)\n");
    return 2;
  }

  const result = await build(new FsVault(root), BUILDERS, options, cmd === "build");
  if (json) process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  else report(result);
  const errors = result.problems.filter((p) => p.severity === "error").length;
  return errors || (cmd === "check" && result.changes.length) ? 1 : 0;
}

function report(r: BuildResult) {
  for (const p of r.problems) process.stdout.write(`${p.severity.toUpperCase()} [${p.builder}] ${p.path ?? ""}: ${p.message}\n`);
  const verb = r.written ? "wrote" : "stale";
  for (const c of r.changes) process.stdout.write(`${verb} [${c.builder}] ${c.path}${c.created ? " (new)" : ""}\n`);
  if (!r.changes.length) process.stdout.write("up to date\n");
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    process.stderr.write(`${(e as Error).stack}\n`);
    process.exit(2);
  },
);
