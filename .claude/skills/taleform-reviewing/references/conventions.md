# Taleform Conventions Reference

The code shapes the checklist in `../SKILL.md` refers to. Each one is taken from the code as it stands; open the cited file before relying on a detail.

## A region builder (opt-in)

`src/builders/resume.ts` is the smallest complete builder. Every shape a mission-note region needs is here:

```ts
export const resume: Builder = {
  id: "resume",
  description: "Resume-here callout on the mission note, derived from beat-status",
  run(ctx) {
    for (const mission of selectMissions(ctx.index, ctx.options.missions)) {   // honours --mission
      const seq = sequence(ctx.index, mission);                                 // membership by link
      if (!seq.length) continue;
      const at = resumeBeat(seq);                                               // derived, not declared
      const content = at ? [/* callout lines */] : [/* complete */];
      const { text, crlf } = toLF(ctx.read(mission.path)!);                     // overlay-aware read
      const r = setRegion(text, "resume", content);                             // no insertAt: opt-in
      if (!r.found) {
        ctx.problem("warning", "no `%% taleform:resume %%` region on the mission note, …", mission.path);
        continue;
      }
      ctx.emit(mission.path, fromLF(r.text, crlf));                             // engine diffs
    }
  },
};
```

- **Opt-in vs inserted.** `setRegion(text, id, content)` without `insertAt` returns `found: false` when the DM placed no markers. `awards` passes `insertAt` (the line after the H1) and so creates its region uninvited. Empty `content` removes an existing region.
- `ctx.emit` with unchanged text is free: the engine compares against disk and records no change.

## Rewriting a note outside a region

Only the sequence header and the `## Next` footer (`src/builders/navigation.ts`). The pattern keeps frontmatter untouchable by construction:

```ts
const { text, crlf } = toLF(raw);            // raw = ctx.read(n.path)
const lines = text.split("\n");
const end = n.fmEnd;                          // closing `---`
// … compose header / body / footer from lines after `end` …
const out = [...lines.slice(0, end + 1), ...header, ...body, ...footer, ""].join("\n");
ctx.emit(n.path, fromLF(out, crlf));
```

When text above the H1 is not a recognisable header, navigation warns and leaves the note alone rather than overwriting it. A new rewriter needs the same refusal path.

## The canvas merge

`buildMap` in `src/builders/adventureMap.ts`:

1. `const old = parseCanvas(ctx.read(out))`; `keep` maps old node ids to positions, emptied when `options.relayout`.
2. Each generated node is built with `{ id, ...kw, ...MARK }`; a kept id restores `x, y, width, height`.
3. Edge ids are `nid("e", from, to, label ?? "")`. Node ids are `nid(<family>, <identity>…)`.
4. Hand nodes: `old.nodes` whose `generated !== MARK.generated` and whose id is not regenerated.
   Hand edges: same, plus both endpoints still exist.
5. A duplicate-id check reports an error rather than emitting.
6. `ctx.emit(out, formatCanvas({ nodes, edges }), { same: sameCanvas })`.

`MARK = { generated: "adventure-map" }`. A new canvas builder defines its own marker and its own output file.

`nid = (...parts) => sha1(parts.join("|")).slice(0, 16)`. `test/core.test.ts` pins `nid("legend")` to `"a4097e080c550462"`, the id the Python prototype produced, so existing maps keep their layout.

## Adding or retiring a property

All in `src/builders/schema.ts`:

- **Retire:** add `"<old>": "<what replaced it>"` to `RETIRED`. The loop reports ``\`<old>\` is retired; use <now>`` as an error on any story note carrying it.
- **Add to a mission:** a check in `mission(ctx, n)`. **Add to a sequence note:** a check in `member(ctx, n)`. Text properties use `text(ctx, n, key)`; link-bearing object lists follow `storyLinks`.
- **A typed list** (like `awards`) gets a reader in `src/core/story.ts` that takes a `problem` callback. `schema` passes the real one; builders pass `() => undefined`.
- `schema` only checks notes that are story data: `kind: mission`, or any note with a `mission` property.

Then add the property to `README.md` § The typed model, and list the vault docs it affects.

## Adding a CLI option

Three places, all required:

1. `BuildOptions` in `src/core/builder.ts`, with a doc comment.
2. The argv loop in `main` (`src/cli/main.ts`): `else if (a === "--flag") options.flag = true;`. An unknown flag exits 2.
3. `USAGE`, one aligned line.

Then the builder reads `ctx.options.flag`, and a test passes `{ flag: true }` to `build()`.

## Adding a plugin preference

`src/plugin/main.ts`:

```ts
interface Settings { autoBuild: boolean; /* newKey: … */ }
const DEFAULTS: Settings = { autoBuild: true /* , newKey: … */ };
// onload: this.prefs = { ...DEFAULTS, ...(await this.loadData()) };
```

The field is `prefs`. A toggle is a command that flips the key and calls `this.saveData(this.prefs)`, as `toggle-auto-build` does.

## A builder test

From `test/builders.test.ts` and `test/model.test.ts`:

```ts
it("writes the callout under the H1 …", async () => {
  const v = mission([{ id: "A", status: "played" }, { id: "B", extra: awards }], "party-xp: 42250\nparty-size: 6\n");
  const r = await build(v, BUILDERS);
  expect(r.problems.filter((p) => p.severity === "error")).toEqual([]);
  expect(v.files["Job/Job B.md"]).toContain("# ▶ B\n\n%% taleform:awards %%\n> [!danger] …\n%% /taleform:awards %%\n");
  expect((await build(v, BUILDERS, {}, false)).changes).toEqual([]);   // idempotent
});
```

- `build(v, BUILDERS)` writes; `build(v, BUILDERS, {}, false)` is `check`.
- `v.files[path]` is the in-memory vault; `!` on a fixture lookup is fine in tests.
- A schema test builds with `write = false` and matches on `problems` messages.
- The `mission()` helper in `test/model.test.ts` writes a mission note with empty `resume` and `xp` regions, chained beats, and two stat blocks (`Wolf` CR 1/4, `Ogre` CR 2). The `vault()` helper in `test/builders.test.ts` writes a four-note mission across an act, with an optional scene and a hand-off out of the mission.

## Severity and exit codes

| | `check` / `build` exit | Vault Claude hook | Pre-commit |
|---|---|---|---|
| `error` problem | 1 | exits 2 (the error goes back to the session) | printed, never blocks |
| `warning` problem | 0 | passes | not printed |
| stale output (`check` only) | 1 | n/a (`build`) | rebuilt, staged or left |
| usage / crash | 2 | | |
