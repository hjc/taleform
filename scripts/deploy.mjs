// Install the built plugin into a vault: node scripts/deploy.mjs [<vault dir>] [--hooks]
// The vault defaults to TALEFORM_VAULT, else the repo's test-vault. The plugin folder gets the
// plugin, the CLI and the Claude hook, so the vault's hooks run the CLI it shipped with.
// --hooks also installs the git pre-commit hook when the vault is a git repo.
// Reload the plugin in Obsidian afterwards: disable + enable, or the CLI.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const hooks = args.includes("--hooks");
const vault = args.find((a) => !a.startsWith("--")) ?? process.env.TALEFORM_VAULT ?? "test-vault";
if (!existsSync(join(vault, ".obsidian"))) {
  console.error("usage: node scripts/deploy.mjs [<vault dir>] [--hooks]  (a folder containing .obsidian)");
  process.exit(2);
}

const copy = (from, to) => {
  copyFileSync(from, to);
  console.log(`${from} -> ${to}`);
};

const dest = join(vault, ".obsidian", "plugins", "taleform");
mkdirSync(dest, { recursive: true });
for (const [from, to] of [
  ["dist/main.js", "main.js"],
  ["manifest.json", "manifest.json"],
  ["dist/cli.cjs", "cli.cjs"],
  ["hooks/claude-hook.mjs", "claude-hook.mjs"],
])
  copy(from, join(dest, to));

if (hooks) {
  const gitHooks = join(vault, ".git", "hooks");
  if (!existsSync(gitHooks)) {
    console.error(`--hooks: ${vault} is not a git repo; skipped the pre-commit hook`);
  } else {
    const target = join(gitHooks, "pre-commit");
    const ours = readFileSync("hooks/pre-commit", "utf8");
    if (existsSync(target) && readFileSync(target, "utf8") !== ours) copy(target, `${target}.bak`);
    copy("hooks/pre-commit", target);
    chmodSync(target, 0o755);
  }
}
