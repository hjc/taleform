# I. Vault Coupling & Implicit Wiring

**Findings file:** `.tmp/pr-tidying-findings-vault-coupling.md`
**ID prefix:** `I1`, `I2`, …
**Read-set:** ADDED and MODIFIED lines of `src/` in `<parent>..HEAD`, and `CLAUDE.local.md` when present (it names the developer's own vault, so you know what its names look like). Diff-scoped: read the current file only to confirm a line.

Taleform is meant to be adopted by another DM (`CLAUDE.md` intro), so `src/` names nothing from the DM's vault: **everything comes from frontmatter.** And the developer prefers deriving to declaring and dislikes implicit wiring — magic names, folder matching (`CLAUDE.md` § Working style). Membership is the `mission` link, never the folder (`StoryIndex.members`).

## What to flag

- **A vault-specific literal in `src/`**: a mission, act, beat, NPC or place name from a DM's campaign (the developer's own included), a folder of theirs (`Story Beats/`, `Missions/`), the vault's name, or an absolute path on anyone's machine. Replace it with what frontmatter or `VaultIO` already supplies.
- **Folder matching** — deciding membership, kind or order from a note's folder or path (`path.includes("/Act 2/")`, `note.folder === mission.folder`) where a frontmatter property (`mission`, `kind`, `act`, `beat`) or a link decides it.
- **Magic names** — behavior keyed on a note's basename, title or heading text matching a pattern (`basename.endsWith(" — Adventure Map")` to find an input, `title.startsWith("Act ")`) instead of a typed property. An output path the builder itself constructs and only it reads is not magic; recognising an author-written note by its name is.
- **A declared value that could be derived** — a new frontmatter property the DM must keep in step with something Taleform already knows (a running XP total, a beat count, a "current beat" pointer). Resume, combat XP and running totals are derived; new ones should be too. Report it; the schema change itself is the developer's call (`CLAUDE.md` § Working style: propose before restructuring the schema).
- **Hardcoded campaign rules that belong to the data** — a party size, a level, an XP threshold written as a literal in a builder, where `partySize(mission)`, the level table in `src/core/story.ts` or a frontmatter property is the source.

## What NOT to flag

- Taleform's own vocabulary: frontmatter keys (`beat-status`, `party-xp`), `kind` values (`SEQ_KINDS`), region ids, the `generated` marker, the `Templates` folder read from `.obsidian/templates.json`.
- Rules of the game system the code models — the 2024 XP table, the level table. They are D&D 5e's, not the DM's.
- Fixture names in `test/` — fixtures may be anything, though a fixture copied wholesale from a DM's vault is worth a note.
- Obsidian's own conventions (`.obsidian/`, `.canvas`, `#^card` block refs) — those are the platform's.

## Report shape

| # | File | Line | Coupling | Action |
|---|------|------|----------|--------|
| I1 | `src/builders/adventureMap.ts` | 22 | `path.startsWith("Story Beats/")` — folder match | Select by `kind: mission` via `index.missions()` |
| I2 | `src/builders/ledger.ts` | 40 | `const party = 6` | `partySize(mission)` |

**Every finding names the frontmatter property, link or derivation that replaces the coupling.** "Hardcoded" alone gets applied wrong.
