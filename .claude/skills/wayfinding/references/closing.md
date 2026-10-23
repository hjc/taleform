# Closing a wayfinding effort

Read this when a branch **retires a wayfinding effort** — the downstream build has shipped and its artifacts are being cleared.

**Closing is not the same as reaching the destination.** The destination is reached when the map has no open tickets and hands off to a PRD; the artifacts stay, because the slices still cite them. Closing happens later, when the last slice has shipped and nothing points at them any more.

## The rule

**A wayfinding artifact is scaffolding, and scaffolding comes down.** The tickets — the reasoning, the rejected options, the measurements — are deleted, and the git history is their record. Same rule as an issue doc (`issue-creating`: delete when the fix ships) and a consumed QA checklist. What survives, and where, is the table at the end of this file.

## Before deleting anything: the graduation check

**The decision register is the checklist**, and its two tables have opposite contracts. Run it on **both**. In `register`, every row's `Graduated to` must name a context doc, and that reference must resolve. In `superseded`, every row's `Context corrected` must read `Yes` — **a doc name in that cell is itself the blocker**, because it names the correction still to be made.

**Print the row count first.** A check that only reports problems reports nothing when it matches nothing, and reads as a pass. Confirm the count is non-zero and matches the register before trusting the second command.

**The two tables take opposite matches, so they get separate commands.** One regex cannot express both contracts: `register` blocks on an *empty* final cell, `superseded` blocks on any final cell that is not exactly `Yes`. A single loop over both silently passes every superseded row that names a doc — which is the one thing that cell exists to flag.

```bash
P="node .claude/skills/html-planning/planr.js"
D=<effort>/wayfinding/decisions.html
rows() { $P read "$D" "$1" --text | grep -E ' \| ' | tail -n +2; }

# register — the last cell must NAME a context doc. Empty or dashed is a blocker.
echo "== register: $(rows register | wc -l) rows"
rows register | grep -E '\|[[:space:]]*(—|–|-|TBD)?[[:space:]]*$' || true

# superseded — the last cell must read exactly Yes. Anything else is a blocker,
# INCLUDING a doc name: that names the correction still owed.
echo "== superseded: $(rows superseded | wc -l) rows"
rows superseded | grep -vE '\|[[:space:]]*Yes[[:space:]]*$' || true
```

Each line either command prints is a blocker.

**Three things this snippet is deliberately shaped around:**

- **`rows` drops the first table line.** `read --text` prints the `<thead>` row in the same ` | `-joined form as a body row, and on the inverted `superseded` match a header row is not `Yes` and would report as a false blocker.
- **Both greps are `|| true`.** A grep that matches nothing exits 1, so an unguarded clean run fails and a run with blockers succeeds — exactly backwards, and invisible if you are reading the printed lines rather than `$?`.
- **Match the `read --text` form, never the markup.** It puts each row on one line with entities decoded, however the source is wrapped. The register template scaffolds one `<td>` per line, so a pattern written against the markup matches zero rows and passes vacuously.

A clean run proves only that every last cell is filled. **Then open each context doc named in `Graduated to` and confirm it carries the fact** — the grep cannot do that half. An empty last cell means a decision lives only in an artifact about to be deleted.

Do the same for `vocabulary.html`: the terms graduate into the context doc's own vocabulary, because the words outlive the effort that bound them.

`evidence.html`'s manifest is deleted with everything else. Any asset a later reader would need — a property export, a measured baseline — is either summarised into the context doc or kept deliberately, with a line in that doc saying why. **Never keep `assets/` wholesale**: an unindexed folder is the failure the manifest existed to prevent.

## The order

1. **Verify graduation**, above. Stop here if anything is ungraduated.
2. **Retire the consumed QA checklists** — each one's status is already `implemented`; it is deleted with its slice spec (`docs/sdlc.md` §4e).
3. **Delete the tickets**, `assets/` and the three registers.
4. **Delete the map last**, and say what it was in the commit message. The final commit is the effort's record; make it worth reading.
5. **Fix the danglers.** Any tracked artifact citing a deleted path is a broken reference, and those citations are usually stale claims as well:

   ```bash
   git grep -n "wayfinding/" -- '*.md' '*.html' | grep -v "^docs/features/<effort>/"
   ```

   Correct the claim, not just the link. **Use `git grep`, not `grep -r`** — the latter drags in `.claude/handoffs/`, `.tmp/` and `.claude/reviews/`, which are gitignored and can easily outnumber the real hits.
6. **Leave the context docs authoritative.** After closing, `.claude/context/` is the only place the effort's rules live. Read the sections it touched once, end to end — not diffed — and check they still make sense without the map behind them.

## What survives

| Artifact | Fate |
|---|---|
| `.claude/context/<effort>.md` | **Stays.** This is the whole point |
| Issue docs the effort filed | Stay if still open; deleted by `issue-creating`'s rule if fixed |
| QA checklists the effort produced | **Deleted** with their slice specs — `docs/sdlc.md` §4e |
| Slice specs and the PRD | **Deleted** at effort close, behind the graduation check — `docs/sdlc.md` §4e |
| The map, tickets, registers, `assets/` | **Deleted.** Never moved to `implemented/` — a reader who finds them there cannot tell whether they are current |

**Graduate a rule's TEXT, never its id.** A decision id (`C15`, `D37`, `q08`) is defined only in the artifacts a close deletes, so a surviving document that cites one is left holding a reference that resolves nowhere. Inline the rule at every citation before deleting the register or ticket that defines it. **Run `node .claude/skills/wayfinding/check-tooling.js` BEFORE deleting the registers** — its `W71` check sweeps the surviving docs for ids no live effort defines, and it can only make that comparison while the artifacts that define them still exist. **`W71` cannot see the closing effort's own ids**: they are defined until deletion, and after it no live effort remains, so the check passes vacuously; its pattern also omits the PRD's `G#` and `S#` shapes. The close-slice spec must therefore require a manual regex sweep of surviving docs for the effort's own ids (`C#`, `G#`, `S#`, `D##`, `q##`, `E##`), with its own acceptance criterion, before the registers are deleted.
