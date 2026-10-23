# Authoring Rename / Signature-Change TDD Plans

A rename or signature change (a frontmatter property, a builder id, a region id, a
canvas `generated` marker, a CLI flag or `--json` field, an exported function's
parameter list) does not add or remove behavior — it moves a name that other code,
the DM's notes, or the vault's hooks bind to. Its failure modes are therefore neither
a feature plan's nor a removal plan's: the change is mechanically FORCED to fan out,
intermediate states do not typecheck, and tests go red — or stay green — for reasons
unrelated to the behavior under test.

Load this doc when a task renames any of the above, changes a function signature
other modules call, or changes the inputs to a `nid(...)` call.

## Some names live outside this repo

Three kinds of name are bound by things `tsc` and the suite never see:

| Name | Bound by | What the plan must add |
|---|---|---|
| A frontmatter property | the DM's notes (and another DM's) | A `RETIRED` entry in `src/builders/schema.ts` naming the replacement, in the SAME step as the rename, plus a test that a note still using the old name gets that error. The slice is a **vault gate** if the DM must migrate notes before the next slice (`docs/sdlc.md` §3). |
| A region id, a builder id used as a canvas `generated` value, the canvas file name | text already generated into the DM's vault | A decision on what happens to existing output. An old `%% taleform:<old> %%` region is no longer found: the `awards` builder inserts the new one under the H1 and leaves the old one orphaned, while an opt-in region (`resume`, `xp`) just warns that it is missing. Canvas items whose `generated` value no longer matches are kept as hand-made unless a new generated item reuses their id, so the map doubles whenever the node ids change too. Either ship a migration in the builder, with a fixture holding the old shape, or state that the DM cleans up and list it in the PR. |
| A CLI flag or `--json` field | the vault's git `pre-commit` hook and `taleform-hook.mjs` | The vault-side change the DM must make, listed for the DM. Rebuilding `dist/` makes the new CLI live for the hooks immediately (`docs/sdlc.md` §1), so this is a vault gate. |

A `nid(...)` input change is the same family: every existing node id changes, so every
dragged position on every existing map is lost. Treat it as a rename of every node.

## Red is not evidence here — classify every test individually

A behavioral checkpoint label is a lie in a rename plan. Vitest transpiles without
typechecking, so a test whose fixture still uses the old name does not fail to
compile — it runs, and goes red (or green) on whatever the old name now produces: a
schema error, an empty region, a missing card. A block-level label like "BASELINE-GREEN
GUARDS — these pass before and after" then misleads the executor into reading a
correct red as a broken step, or an incorrect green as done.

**Do instead:** keep the guard block, but give it a per-test **disposition table** —
`Test | state before sub-step A | state after sub-step N | turned green by`. Reserve
the words "pure guard" for tests that touch neither the renamed name nor the changed
behavior; those are the only ones whose red at ANY checkpoint means stop. Run
`npm run check`, not just Vitest, at every checkpoint: `tsc` is what catches the
typed callsites.

## Forced declarations land in the step that forces them

The `RETIRED` entry is not polish a later sub-step can pick up — invariant 4 forbids
any intermediate commit where the old property is silently ignored. It lands in the
SAME sub-step as the rename. Likewise a renamed builder id lands in `BUILDERS` and in
every place that compares it as a string in one sub-step.

Sequence the plan so the forced declaration is already the FINAL declaration. A
throwaway placeholder that a later sub-step replaces is a step the executor can ship
without — and a step that exists only to be undone is a step that will be got wrong.

## Removing a positional parameter is a fan-out, not a deletion

`tsc` catches most of this, but not all. Removing a MIDDLE positional parameter shifts
every later argument; where two adjacent parameters share a type, or a trailing one is
optional, a missed callsite still typechecks and silently passes the wrong value.
`build(io, builders, options, write)` is the shape to watch: drop `options` and a
caller's `false` lands where `options` was — a type error here, but not if the
remaining parameters were both booleans.

Enumerate every caller and forwarding wrapper as a callsite swap **in the same step**,
and say explicitly that they land together. Prefer converting to an options object
when the plan is touching the signature anyway.

## A contract step's removals table must list the BRIDGE, not just the name

If an earlier slice read both the old and the new property while the DM migrated
notes, the slice that drops the old name lists not just the old key but everything
that exists *only* to bridge the two shapes: the fallback read, a warning that told the
DM to migrate, a fixture that carries both. Enumerate by asking "what would still
reference the old name after the drop?", not "where is the old name spelled?", and
for every bridging symbol either remove it or state why it survives.

## A relocation's assertions must be per-item, not set-wide

A plan that moves a symbol many callsites bind to is tempted to assert the *set*:
"every builder still runs". That assertion passes when one builder is dropped and
another duplicated. **Assert the mapping, not its cardinality**: compare the exact
ordered list (`BUILDERS.map((b) => b.id)`) or the `{path: builder}` map of `changes`
by equality against the expected value.

**Pair every positive with its negative.** A rename's positives are all satisfied by
keeping the old name as an alias, which is the wrong outcome for a frontmatter
property (it must be `RETIRED`, not silently accepted) and the most natural cure when
fixtures break mid-move. A test that the old name now yields the `RETIRED` error is
what forbids it.

**Grep for the name as a string, not only as a symbol.** Builder ids, region ids, the
`generated` value and property keys are all strings; a search for references to the
TypeScript symbol finds none of them.

## A relocation's intermediate states do not typecheck, and the cure is the forbidden alias

Moving a module and updating its importers cannot be done one file at a time: between
the first edit and the last, `tsc` fails. An executor who runs `npm run check`
mid-step sees an error storm, and the most natural-looking recovery is to re-export
the old name from the old path — the shim the negatives above exist to forbid. **Say
in the plan that the sub-steps are one atomic edit, that no check runs until the last
lands, and that the storm is expected.** Silence here reads as an unanticipated failure.

## Verification for a rename is the full check plus parity, not a grep

A grep for the old name finds callsites. It does not find an *assertion* that silently
changed meaning — and a mechanical fixture sweep creates exactly that: it rewrites a
pre-plan fixture from the old property to the new one, leaves the assertion untouched,
and the test now asserts something the new code no longer means.

So a plan of this kind specifies as exit criteria:

- `npm run check` green, run once from a clean `dist/`;
- the read-only parity check, `node dist/cli.cjs check --vault "<vault>"`, with its
  expected result stated in advance — for a property rename, the exact set of notes
  now reporting the `RETIRED` error (that list is what the DM migrates); for a region
  or id rename, the exact set of files whose output changes.

Say in the plan that reds from that run are expected and are plan-silent gaps rather
than executor error, and that each is dispositioned on its merits — deleted when the
scenario has become structurally impossible, assertion flipped when the sweep changed
its meaning.
