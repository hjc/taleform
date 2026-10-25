# Taleform test vault

A small, fictional campaign that exercises every Taleform builder. It is committed with its generated output, so `npm run check` fails when a change alters output that was not rebuilt.

- Rebuild after a change to generated output: `npm run build:vault`, then review the diff.
- Open it in Obsidian after `npm run deploy` to see the plugin run.
- Never hand-edit generated text (regions, sequence headers, `## Next` footers, map items); edit frontmatter and rebuild.
