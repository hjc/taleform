// Copy the built plugin into a vault: node scripts/deploy.mjs <vault dir>
// (or set TALEFORM_VAULT). Reload it in Obsidian afterwards: disable + enable, or the CLI.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const vault = process.argv[2] ?? process.env.TALEFORM_VAULT;
if (!vault || !existsSync(join(vault, ".obsidian"))) {
  console.error("usage: node scripts/deploy.mjs <vault dir>  (a folder containing .obsidian)");
  process.exit(2);
}
const dest = join(vault, ".obsidian", "plugins", "taleform");
mkdirSync(dest, { recursive: true });
for (const [from, to] of [["dist/main.js", "main.js"], ["manifest.json", "manifest.json"]]) {
  copyFileSync(from, join(dest, to));
  console.log(`${from} -> ${join(dest, to)}`);
}
