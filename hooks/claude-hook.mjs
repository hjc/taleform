// Claude Code PostToolUse hook: rebuild Taleform's generated output after an edit to a note, so a
// map, header or ledger can never be left stale by an agent.
//
// It ships in the plugin folder (<vault>/.obsidian/plugins/taleform/) beside cli.cjs, and runs that
// CLI against its own vault; TALEFORM_CLI overrides the CLI. Register it in the vault's
// .claude/settings.json:
//   "PostToolUse": [{ "matcher": "Write|Edit|MultiEdit",
//     "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/.obsidian/plugins/taleform/claude-hook.mjs\"" }] }]
//
// While Obsidian is running, the Taleform plugin already rebuilds on every change, through the
// vault API, so this hook steps aside rather than race it with a second writer (TALEFORM_FORCE
// overrides). Errors from the build come back to Claude (exit 2); warnings stay quiet.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const CLI = process.env.TALEFORM_CLI ?? join(here, "cli.cjs");
const vault = process.env.CLAUDE_PROJECT_DIR || resolve(here, "..", "..", "..");

const input = JSON.parse(readFileSync(0, "utf8") || "{}");
const file = String(input.tool_input?.file_path ?? "");
if (!/\.(md|canvas)$/.test(file) || /[\\/]\.(claude|obsidian)[\\/]/.test(file) || !existsSync(CLI)) process.exit(0);

const obsidianRunning = () => {
  try {
    if (process.platform === "win32")
      return /Obsidian\.exe/i.test(execFileSync("tasklist", ["/FI", "IMAGENAME eq Obsidian.exe"], { encoding: "utf8" }));
    execFileSync("pgrep", ["-xi", "obsidian"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
if (!process.env.TALEFORM_FORCE && obsidianRunning()) process.exit(0);

const run = spawnSync(process.execPath, [CLI, "build", "--vault", vault, "--json"], { encoding: "utf8" });
let result;
try {
  result = JSON.parse(run.stdout);
} catch {
  process.stderr.write(`taleform build failed to run: ${run.stderr || run.stdout}`);
  process.exit(2);
}
const errors = result.problems.filter((p) => p.severity === "error");
if (errors.length) {
  process.stderr.write(`Taleform found ${errors.length} error(s) after this edit:\n${errors.map((p) => `- ${p.path ?? ""}: ${p.message}`).join("\n")}\n`);
  process.exit(2);
}
