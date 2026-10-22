// Two bundles from one core:
//   dist/main.js   the Obsidian plugin (CommonJS, obsidian/electron provided by the app)
//   dist/cli.cjs   the headless CLI for git hooks and editors (Node)
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const common = { bundle: true, target: "es2022", sourcemap: watch ? "inline" : false, logLevel: "info" };

const builds = [
  {
    ...common,
    entryPoints: ["src/plugin/main.ts"],
    outfile: "dist/main.js",
    format: "cjs",
    platform: "browser",
    external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  },
  {
    ...common,
    entryPoints: ["src/cli/main.ts"],
    outfile: "dist/cli.cjs",
    format: "cjs",
    platform: "node",
    banner: { js: "#!/usr/bin/env node" },
  },
];

if (watch) {
  for (const b of builds) await (await esbuild.context(b)).watch();
} else {
  await Promise.all(builds.map((b) => esbuild.build(b)));
}
