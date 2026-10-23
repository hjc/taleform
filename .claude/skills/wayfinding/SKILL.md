---
name: wayfinding
description: Plan a chunk of work too big for one agent session under `.claude/plans/features/<feature>/wayfinding/` — a map, three registers, and one ticket per open question — and resolve the tickets one at a time until the way to the destination is clear.
disable-model-invocation: true
---

A loose idea has arrived — too big for one agent session, and the way from here to the **destination** isn't visible yet. Wayfinding is about finding that way, not charging at the destination. This skill charts the way as a **map** of local HTML documents, then works its **decision tickets** — questions whose resolution is a decision, not slices of a build to execute — one at a time until the route is clear.

The destination varies per effort, and naming it is the first act of charting — it shapes every ticket. It might be a PRD to hand off, a decision to lock before planning starts, or a change made in place like retiring a frontmatter property through the schema's `RETIRED` map.

## Where this sits in the Taleform loop

Wayfinding is **step 0** of the core loop in `docs/sdlc.md` §4:

**Wayfind → Discuss → Spec (`prd-writing`) → Plan (`tdd-planner`) → Auto-review → Human review → Execute → Tidy**

It runs *before* Discuss, and only for efforts whose Discuss cannot fit in one session — reach for it when Discuss would sprawl across sessions, when the shape of the thing is still unclear, or when the user calls the effort large. Skip it for anything one session can settle.

Its output is decisions and a slicing, never a deliverable. It hands off to whichever step the destination calls for:

| Destination reached | Hand off to |
|---|---|
| A product/feature spec | `prd-writing` skill — a PRD carrying the cross-cutting contract and the slice list, plus a thin spec per slice |
| An implementation approach | `tdd-planner` agent (which follows `tdd-planning` + `html-planning`) |
| An architecture decision (a new builder kind, the Bases read path) | Straight to a PRD, with the decision graduated into `.claude/context/` |
| A visual direction (an Adventure Map layout, a generated region's shape) | `prd-writing`, with the prototype from `wayfinding/assets/` as its reference |

Wayfinding never replaces those. The map is done when there is nothing left to decide before one of them can run.

**Decisions graduate as they are made, not at map close** — each one lands in `.claude/context/` the session it resolves, so a branch cut mid-effort still builds against the truth.

## Plan, don't do

Wayfinding is **planning** by default: each ticket resolves a decision. Produce decisions, not deliverables. The pull to just do the work signals the edge of the map — hand off. An effort can override this in the map's **Destination** section, alongside its standing constraints.

## Refer by name

Every map, register and ticket has a **title**. In everything the human reads, refer to it by that title, never a bare id, number, or filename. The id and path ride *inside* the name as its link; they never stand in for it.

In chat messages, render the link as a `file://` URL with the absolute path so it opens in the browser on click.

**Inside the documents, every reference to another concrete document is a hyperlink** — registers, tickets, the PRD, slice specs, context docs. The effort is read by clicking through it in a browser. The mechanics, including the relative-`href` trap and the no-globs rule, are `html-planning` → Content Guidelines rule 10.

## Formatting

Every map, register and ticket document is written with the **`html-planning`** skill. Never hand-write the HTML skeleton, inline `<style>`/`<script>`, or raw `<div>` layout.

Scaffold in **one** command — header attributes are set with dotted `--set` keys, not follow-up calls — and **always with the matching template**:

```bash
P="node .claude/skills/html-planning/planr.js"
W=.claude/plans/features/<feature>/wayfinding

# Charting: the map and its three registers, once, at the start.
$P new $W/map.html        --title "<Effort> — Wayfinding Map" --template wayfinding-map        --set header.status=draft
$P new $W/decisions.html  --title "<Effort> — Decision Register" --template wayfinding-decisions --set header.status=draft
$P new $W/vocabulary.html --title "<Effort> — Vocabulary"     --template wayfinding-vocabulary --set header.status=draft
$P new $W/evidence.html   --title "<Effort> — Evidence Manifest" --template wayfinding-evidence --set header.status=draft

# One per ticket, as it is charted.
$P new $W/q01-<slug>.html --title "<Ticket title>" --template wayfinding-ticket --set header.status=draft
$P meta $W/q01-<slug>.html --set ticket-type=grilling --set blocked-by=q04-<slug>.html
```

The five `wayfinding-*` templates are this repo's own: they live in `.claude/planr-templates/`, outside the synced `html-planning` folder, and `planr templates` lists them marked `[consumer]`. `planr templates <name>` prints a template's full guidance without generating a file.

## Driving the map with `planr`

A wayfinding write is **small and deep**: one badge, four rows, an amendment above an old resolution. Each has a `planr` command that costs the hunk instead of the document. **Reach for them first** — `Edit` is the last resort (below).

**Status badges are authored empty** — the runtime derives the label from `type`, so an empty badge follows every flip. Pass `--text` only for a label the type cannot express (`Claimed`, `Out of scope`, `shipped`).

**A flip off a custom label states the label of the state it is flipping *to*.** `badge --set` clears a label that only restates the old type, and **refuses** a custom one (`Claimed`) unless `--text` says what to do with it: `--text ""` when the target state needs no label because the type already names it, and `--text "<label>"` when it does.

```
badge map.html --match "…" --set open --text "Claimed"   # label on
badge map.html --match "…" --set decided                 # WRONG — refused: the badge carries "Claimed"
badge map.html --match "…" --set decided --text ""       # right — empty, runtime derives "Decided"
```

Addressing works because the section ids are fixed (below). `<file>` is elided here; the real form is `node .claude/skills/html-planning/planr.js <cmd> <file> …`.

| The write | Command |
|---|---|
| Claim / decide a ticket (its own header) | `set q07.html header.status=review` — `review` is Claimed; there is no claim chip |
| Flip a ticket's badge in the map row | `badge map.html --match "<ticket title>" --set decided --text ""` — **`--text ""` clears the "Claimed" label**; `--set` alone suffices only on a badge with no custom label |
| A decision onto the register | `append decisions.html register --into tbody --file rows.html` |
| A term, an artifact, a ticket row | `append vocabulary.html terms --into tbody` · `append evidence.html manifest --into tbody` · `append map.html tickets --into tbody` |
| A changelog entry | `prepend map.html changelog --into tbody --file row.html` — newest first, same commit as the change |
| Amendment above a resolution | `prepend q07.html resolution --file amendment.html` |
| Something beside a known heading | `insert q07.html resolution --before-heading "<heading>" --file hunk.html` |
| Remove a row (a sharpened horizon entry, an invalidated row, a scaffolded sample row) | `rm-item map.html horizon --match "<row text>"` — `--into tbody` to scope it |
| Rewrite text inside one cell or paragraph | `replace q07.html resolution --match "…" --with "…"` |
| Strike superseded text | `strike q07.html resolution --match "<superseded sentence>"` |
| Write a whole section body | `set-body map.html horizon --file body.html` · `add-section … --body-file` |
| Fix content inside a section | `read <addr> --body` → edit the hunk → `set-body <addr> --file` |
| See a doc's spine without loading it | `list map.html` (sections **and** their headings — the anchors `insert --before-heading` takes) |
| Verify after writing | `check map.html` — **exits 1 on a structural break** |

`planr tasks` surveys **section** statuses, which wayfinding docs don't carry — ticket state lives in the map's Tickets table and each ticket's header. The frontier is read off that table, not off `tasks`.

Hunk bodies go in a scratch file and are spliced by address, so the document is never read into context. `--into` names a container the section owns (`tbody` = the last one; `tr:2`, `#id`), never `plan-section`, `plan-subsection` or `plan-header`, which the dot-path addresses. Almost every wayfinding section is a table, so `tbody` is the container in practice — the exceptions are a ticket's `question` and `context`, which are prose and take `set-body`. The map's `destination` is mixed: its prose and completion bar take `set-body`, its standing-constraints table takes `append --into tbody`.

**`set-body` replaces everything, including structure a later command depends on.** A scaffolded section is not decoration: `insert --before-heading` addresses the `<h3>`s inside a ticket's `resolution`, and `append --into tbody` needs the `<plan-table><table><tbody>` a table section was scaffolded with. A body that omits them removes the anchor the *next* write needs — and `check` still passes, because it validates tag balance, not whether a heading survived. The two that bite:

- **`set-body <ticket>.html resolution`** — the body must carry `<h3>For the register</h3>` and `<h3>What would change this answer</h3>` back, or "Amending a closed map" below has nothing to address.
- **`set-body map.html slices`** — the body must carry its own `<plan-table><table>` wrapper, or the section is left with no `tbody` for the next `append`.

**So prefer `read --body` → edit the hunk → `set-body`** over composing a body from scratch: the round-trip is lossless and keeps whatever the scaffold had.

**Run `check` after every write session, on every file touched.** It is the authoritative structure validation — never hand-roll a `grep -c '<plan-table>'` balance count, and never trust `grep -c '<plan-section'` as a section count (`list` is that count).

**Rows and text runs are addressed by their visible text.** `rm-item` deletes a row, `replace` rewrites a run inside one element, and `strike` wraps a superseded run in `<s>`; each refuses a `--match` that hits two candidates, so narrow the text or pass `--nth`. A run crossing an element boundary (two cells of one row) is refused — rewrite that with `read --body` → edit → `set-body`. `Edit` is left for what none of these reach.

## The Map

```
.claude/plans/features/<feature>/
├── wayfinding/
│   ├── map.html           ← the meta document: pointers and status
│   ├── decisions.html     ← register: every decision, what it rests on, where it graduated
│   ├── vocabulary.html    ← register: terms bound to referents
│   ├── evidence.html      ← register: measured artifacts and their authority rank
│   ├── q01-<slug>.html    ← tickets, one per question
│   ├── q02-<slug>.html
│   └── assets/            ← the artifacts themselves, indexed by evidence.html
└── <prd/tdd docs land here once the map is done>
```

Every one of these has a `planr` template — `wayfinding-map`, `wayfinding-decisions`, `wayfinding-vocabulary`, `wayfinding-evidence`, `wayfinding-ticket`. **Scaffold with the template, never by hand.**

**The map holds pointers and status, never content.** If a fact lives in a register or a context doc, the map cites it and does not restate it. Anything that grows monotonically belongs in a register.

**A register is greppable, not readable.** One row shape, one fact per row. You do not load `decisions.html` to orient — you search it for a rule and follow its `Graduated to` column into the context doc. Only the map is narrative.

### The map body

The whole map at low resolution, loaded once per session. Sections, in order — **use these ids verbatim**: every command in the table above addresses the map by them, and a renamed id breaks the next session's writes.

| id | Section | Contents |
|---|---|---|
| `destination` | **Destination** | Where this effort ends, plus the **completion bar** — the single observable that closes it, written so a finished thing can be held against it. Domain and standing constraints live here too. |
| `documents` | **Documents** | Every artifact the effort owns and what each holds — **including the PRD and slice specs once they exist**. This is the entry point for a session that has never seen the effort, and it is how the map ties back to the PRD. |
| `tickets` | **Tickets** | One row per ticket: id, **title**, question, **type**, status, **what blocks it**, where the answer landed, which slice builds it. Never the answer itself. The title is the ticket's own, minus its `q##` prefix, and is what `badge --match` addresses the row by — keep the two identical. `Type` is one of the five below, and it is on the map because instructions act on it — "dispatch every `research` ticket" has to be answerable without opening five tickets. |
| `slices` | **Slices** | Owned here **only until the PRD exists**. After that: id, name, status, blockers, spec path — nothing else. The hand-off is one-way. |
| `horizon` | **On the horizon** | In scope, not yet sharp enough to ticket; sharpens as the frontier advances (see The horizon). |
| `out-of-scope` | **Out of scope** | Work ruled beyond the destination; closed, never sharpens into a ticket (see Out of scope). |
| `changelog` | **Changelog** | **Last, and the id is reserved.** Newest first: what moved and where to look. The first thing a session reads after a week away. |

Map header: `<plan-header status="draft">` while the way is still unclear, `approved` once it's clear and the user has approved the closed map. **Those are the only two.** The map has no `implemented` state — it is deleted when the effort closes (`references/closing.md`), so a status meaning "the build shipped" would be set on a document that no longer exists. What shipped is tracked on the slice specs, which outlive the map's usefulness and are deleted only at effort close.

### The three registers

**The section ids are fixed here too** — the same reason the map's and the ticket's are, and every `append` above addresses a register by one of them:

| File | Section ids | Holds | Mandatory column |
|---|---|---|---|
| `decisions.html` | `register` · `superseded` | One row per decision: the rule as a single normative sentence, the ticket that decided it, what it **rests on**, what it **binds**, and where it **graduated to**. Superseded rows move to the second table rather than being deleted. | `Rests on` — an evidence id, `measured live <date>`, or `user call`. Never empty. |
| `vocabulary.html` | `terms` · `collisions` · `states` · `relationships` | The `domain-modeling` glossary, verbatim: `Term \| Means \| Binds to \| Not`. Collisions are tracked separately — a word used two ways is fixed by renaming one side in the *code*, not by a glossary footnote. | `Binds to` — a real referent, or `NEW`. There is no third value. |
| `evidence.html` | `manifest` · `authority` | Measured artifacts: what fact each fixes, and when it was taken. | `Authority` — `live` > `report` > `export` > `prose`. **A lower rank never overrides a higher one.** |

**`vocabulary.html` implements `domain-modeling`'s contract and does not paraphrase it.** Its columns are that skill's four, and the **`Not` column is not optional** — a term without stated edges gets stretched. `states` and `relationships` are the optional blocks that skill calls for "where the domain has them": the template scaffolds both, and a vocabulary whose domain has neither removes them with `rm-section`, exactly as a ticket does with `obligations`.

**`Decided in` names the ticket that decided the rule, and takes exactly one non-ticket value: `slicing`.** The slicing happens after every ticket is closed (see Reaching the destination), so the calls it makes — a departure from the obvious ordering, a split, a deliberate non-blocker — have no ticket to cite. They are the only decisions that do. Any other non-ticket value in that column is a decision whose reasoning was never written down.

**Graduate as you go, and record where.** Write the fact into the relevant `.claude/context/` doc the moment the decision is made, not at map close, and put that location in the row's `Graduated to`. An empty `Graduated to` is a debt. **`Graduated to` names a `.claude/context/` doc and nothing else** — pointing it at the map or the PRD marks a decision graduated into an artifact that is itself deleted or filed at close.

**A template spine is a floor, not a ceiling.** An effort may add a column of its own where it genuinely needs one. Keep `Graduated to` and `Context corrected` last: the graduation check in `references/closing.md` matches on the final cell of each row. A column that exists only to serve one migration is not worth back-porting into the template.

**Update the changelog in the same commit as the change.** A changelog written retrospectively is fiction.

### Tickets

One document per ticket, `q<nn>-<slug>.html`, numbered sequentially. Ids are stable and never reused — a ticket ruled out of scope keeps its number. Section ids are fixed for the same reason the map's are:

| id | Section | Contents |
|---|---|---|
| `question` | **Question** | The decision or investigation this ticket resolves, phrased so it can be answered with a named choice. Sized to one agent session. |
| `context` | **Context** | Why it's open, what it hangs on, which files/docs are relevant (`<plan-file>` for code references). |
| `findings` | **Findings** | What the world turned out to be — each with its evidence id, or marked read live with the date. |
| `resolution` | **Resolution** | The decision, the options rejected and why, the one-line normative form for the register, and what would change the answer. |
| `obligations` | **Obligations** | Optional — the template scaffolds it; delete the section if the ticket earned none. What this answer commits a *downstream* artifact to: a PRD requirement, a build check, a context-doc rule, an amendment another ticket needs. At map close these are the PRD's structured input. |

**`findings` and `resolution` are separate.** A finding is what was measured; a resolution is a choice. Overturning a decision must not take its evidence with it.

**A finding with no provenance is an assertion.** Cite the evidence id, or state that it was read live and when. An unverified assumption is not a finding at all: it is a blocker to raise now, not a caveat to record here and not a step to defer to whoever builds the thing later.

A ticket's state is its header `status`; its type and blockers are the `ticket-type` and `blocked-by` metadata fields:

| State | `status` | Map badge | Meaning |
|---|---|---|---|
| Open | `draft` | `<plan-badge type="open">` | Unclaimed, on or behind the frontier |
| Claimed | `review` | `<plan-badge type="open">Claimed</plan-badge>` | A session is working it |
| Decided | `approved` | `<plan-badge type="decided">` | Resolved; answer in the Resolution section |
| Out of scope | `rejected` | `<plan-badge type="deferred">Out of scope</plan-badge>` | Ruled past the destination |

**Blocking** is declared on the ticket (`planr meta <ticket>.html --set blocked-by=<file>,<file>` naming the blocking tickets' files) and mirrored in the map's ticket table. A ticket is **unblocked** when every ticket blocking it is Decided; the **frontier** is the open, unblocked, unclaimed tickets — the edge of the known.

`planr`'s derived `blocked` column counts a Decided (`approved`) blocker as still open — it releases only at `implemented` or `rejected` — so read the frontier from the map, never from `planr query --where blocked=false`.

**Claiming**: a session claims a ticket by flipping its state to Claimed in *both* the ticket doc and the map row, **first**, before any work. This matters when the user runs parallel sessions or worktrees against the same map. Two commands:

```bash
node .claude/skills/html-planning/planr.js set <ticket>.html header.status=review
node .claude/skills/html-planning/planr.js badge map.html --match "<ticket title>" --set open --text "Claimed"
```

`badge --match` refuses a text matching two rows and lists the candidates — narrow the text rather than passing `--all`. **Match on the title, never on the bare `q##` id**: the id recurs in `Blocked by` and `Answer landed in`, so it matches several rows at once.

Assets created while resolving a ticket (prototypes, scripts, research dumps) are written to `wayfinding/assets/` and linked from the ticket, not pasted into it. **Every asset also gets a row in `evidence.html`**, so a finding or a decision can cite it by id.

## Ticket types

Every ticket is either **HITL** — human in the loop, worked *with* the user — or **AFK**, driven by the agent alone. A HITL ticket only resolves through that live exchange; the agent never stands in for the user's side of it (a grilling that answers its own questions has broken this).

- **Research** (AFK): Surface a fact a decision waits on. In-repo questions go to an `Explore` agent; external questions (the Obsidian API and its docs, the JSON Canvas spec, another plugin's behaviour as documented) go to a `general-purpose` agent with `WebSearch`/`WebFetch`. Findings land in the ticket's **Findings** section, each with its evidence id; any bulk dump goes to `wayfinding/assets/` and gets a row in `evidence.html`. **Research answers what a system documents. When the question is what it *does*, that is a Probe.**
- **Probe** (AFK, or HITL when a credential is involved): Measure external behaviour with a throwaway script — one that exercises the system and records what it actually does, written to `wayfinding/assets/` with its output. For Taleform that is usually Obsidian itself, read through the vault's CLI client `eval` (`CLAUDE.md` § The vault has the command), or a round-trip: YAML through `yaml` and Obsidian's properties panel, a canvas through an Obsidian re-save. Use when a decision rests on how a third-party system actually responds. A probe reads the live vault and never writes to it; one that must write runs against a scratch copy. **The user runs any probe touching a credential**, receiving an exact invocation and handing back the output. **Findings** records what was measured and when; the **Resolution** records **what it falsified** and the call made — correct the falsified claim at its source.
- **Prototype** (HITL): Raise the fidelity of the discussion by making a cheap, rough, concrete artifact to react to — a hand-built `.canvas`, a mock note showing a generated region, an outline, a stub. Prototypes go in `wayfinding/assets/`. Use when "how should it look" or "how should it behave" is the key question.
- **Grilling** (HITL): Conversation via the `grilling` skill, one question at a time — with `domain-modeling` alongside it whenever the ticket introduces or contests a term. **The default type.**
- **Task** (HITL or AFK): Manual work blocking a decision — building a fixture vault, standing up a branch, having the DM open Obsidian for a probe. The one type that *does* rather than decides, and it must unblock a decision rather than deliver the destination. The agent drives it where it can; otherwise it hands the user a precise checklist. **Findings** records what was done and the facts later tickets depend on (note counts, fixture paths, which plugin version was loaded).

Never write to the live vault as part of a Task ticket — no `build` against it, no `npm run deploy`, no note edits (`CLAUDE.md` § The vault). The read-only `node dist/cli.cjs check --vault "<vault>"` and an `eval` that reads state are fine; anything that writes is a HITL checklist item for the DM.

## The horizon

The map is *deliberately* incomplete: don't chart what you can't yet see. Beyond the live tickets lies the **horizon** — decisions you can tell are coming but can't yet pin down. Resolving a ticket brings the horizon closer, and whatever is now specifiable **sharpens into** a fresh ticket.

**Two verbs, and they are not interchangeable.** A horizon entry *sharpens* into a ticket. A decision *graduates* into `.claude/context/`. Nothing else graduates.

**Clear a horizon row only once every decision it carries has a register row.** A row that sharpened often states a rule in its own prose, and that prose is the only copy until `decisions.html` holds it — clearing first destroys the decision. Check the register, then clear.

The map's **On the horizon** section holds the dim view: the suspected question, the area to revisit. Everything here is in scope, just not sharp enough to ticket.

**An assumption is not a horizon entry.** A horizon entry is a question you can see but can't yet phrase. An unmeasured assertion about how an external system behaves is a *sharp* question wearing a fact's clothing, and never surfaces on the horizon because nothing about it feels open. **Whenever a ticket's reasoning leans on one, ticket it as a Probe.** The tell is a claim about someone else's system that nobody here has run.

**Horizon or ticket?** The test is whether you can state the question precisely now — *not* whether you can answer it now.

- **Ticket** when the question is already sharp — even if it's blocked and you can't act on it yet.
- **On the horizon** when you can't yet phrase it that sharply. Don't pre-slice the horizon into ticket-sized pieces: it's coarser than a ticket, and one entry may sharpen into several tickets, or none, once the frontier reaches it.

**On the horizon** excludes what's already decided, what's already a live ticket, and what's out of scope.

## Out of scope

Work beyond the destination is **out of scope** — never **On the horizon**. Scope, not sharpness, lands it in the map's **Out of scope** section. It never sharpens into a ticket; it returns only if the destination is redrawn, and then as a fresh effort.

When an existing ticket turns out to sit past the destination, flip it to **Out of scope** and leave one line in the map's **Out of scope** section: the gist, why it is out, and the link. It gets no row in the decision register — ruling something out of scope is a scope judgement, not a decision the codebase is held to.

Out-of-scope work that deserves to outlive this effort gets a one-line entry under `.claude/plans/issues/` or the follow-ups section of `.claude/plans/README.md`, in addition to the map line.

## Invocation

Two modes. Either way, **never resolve more than one ticket per session** — with the exception of research tickets.

### Chart the map

The user invokes with a loose idea and a feature name.

1. **Name the destination.** Run a `grilling` + `domain-modeling` session to pin down what this map is finding its way to — the spec, decision, or change — and which hand-off target it feeds. The destination fixes the scope, so it's settled first, and the terms it's stated in are the first rows of `vocabulary.html`.
2. **Map the frontier.** Grill again, **breadth-first** this time: fan out across the whole space rather than deep on any one thread, surfacing the open decisions and the first steps takeable now. Every new noun that surfaces gets a row in `vocabulary.html` or goes on the horizon — an unnameable thing is an open question. **If nothing lands on the horizon** — the way is already clear and the journey fits one session — you don't need a map. Stop and ask the user how they'd like to proceed (likely: straight to `prd-writing` or `tdd-planner`).
3. **Create the map and its three registers** from their templates (see Formatting). Fill Destination — including the completion bar and the standing constraints — and sketch what you can't yet ticket into **On the horizon**. The templates carry every section; overwrite their scaffolded rows as real ones arrive, or remove them with `rm-item`. Do not `add-section` a spine that already exists.
4. **Create the tickets you can specify now**, then fill in the blocking edges in a **second pass** (ids must exist before they can be referenced). Wiring sorts them into the frontier and the blocked; everything you can't yet specify stays on the horizon. Each ticket is **one** `new --template wayfinding-ticket --set header.status=draft` plus one `meta --set ticket-type=… blocked-by=…` — the template carries the spine, so no `add-section` — and each map row is one `append map.html tickets --into tbody`.
5. **Fire the research subagents.** Dispatch every `research` ticket in parallel in one message, and write each one's findings into its ticket.
6. **Raise a Probe ticket for every external behaviour a decision rests on**, while charting — not when the build reaches it. A probe lacking a credential is still ticketed, blocked on a Task for access; never deferred to the build.
7. **Commit the map.** See "Commit as you go" below — a freshly charted map is exactly the kind of progress that must not be lost.
8. **Stop** — charting is one session's work; it hand-resolves nothing. Report the map and the frontier to the user.

### Work through the map

The user invokes with a map path. A ticket is **optional** — without one, you pick the next decision, not the user.

1. Load the **map** — the low-res view, not every ticket body.
2. Choose the ticket. If the user named one, use it. Otherwise take the first frontier ticket in order. **Claim it** in both the ticket doc and the map row before any work.
3. Resolve it — **zoom as needed**: pull one section of a related or decided ticket with `read <addr> --body` rather than opening the whole document, and `list <file>` when you need its spine first. Invoke the skill the ticket's type calls for; if in doubt, use `grilling`. Run `domain-modeling` when the ticket introduces a term, and correct any row in `vocabulary.html` the answer invalidates (`append vocabulary.html terms --into tbody --file rows.html` for new terms).
4. Record the resolution — each a `planr` call:
   - `set-body <ticket>.html findings --file findings.html` — what was measured, with evidence ids
   - `append evidence.html manifest --into tbody --file rows.html` for any artifact the ticket produced
   - `set-body <ticket>.html resolution --file body.html` — **carry both `<h3>` anchors back** (see `set-body` above), then `set-body <ticket>.html obligations --file obligations.html` if the ticket earned any — `rm-section <ticket>.html obligations` if it did not
   - `set <ticket>.html header.status=approved`
   - `badge map.html --match "<ticket title>" --set decided --text ""` — the `--text ""` clears the "Claimed" label set when the ticket was claimed
   - `append decisions.html register --into tbody --file rows.html` — one row per rule, with `Rests on` filled
   - **Write the fact into its `.claude/context/` doc now**, and put that location in the row's `Graduated to`.
   - `prepend map.html changelog --into tbody --file row.html`
5. Update the frontier: add newly-surfaced tickets (create, then wire, then `append map.html tickets --into tbody`); sharpen any horizon entry the answer made specifiable, clearing it from **On the horizon** so it lives only as its new ticket. If the answer reveals a ticket sits beyond the destination, rule it out of scope rather than resolving it. If the decision invalidates other tickets, update or delete them.
6. **Run `check` on every file touched** — the map, the ticket, any ticket amended. It exits 1 with line numbers on a structural break.
7. **Commit.** See "Commit as you go" below.

Autonomous calls made while resolving a ticket — decisions the user did not make explicitly — are attributed in the ticket's Resolution, per ticket rather than in one trailing table, so the DM can tell their own calls from the agent's.

The user may run unblocked tickets in parallel sessions or worktrees, so expect the map to change under you — re-read it before writing to it.

### Commit as you go

**Always commit after resolving a ticket, and after any material creation of or change to the map.** A map cannot be reconstructed from the code. Commit on a `map--` branch with the `mapping:` prefix (`docs/sdlc.md` §3).

- Wayfinding maps, their registers, tickets, and their assets **are committed** — `.gitignore` keeps only TDD plans untracked (`docs/sdlc.md` §4e).
- **Issue docs and roadmap entries are committed as you file them**, on whatever branch is in hand. Matching a finding to its "correct" branch is worth nothing next to not losing it.
- A ticket resolution usually touches several files — the ticket, the map, `decisions.html`, any ticket it amends, and `.claude/context/`. Commit them together; a decision row and the context-doc fact it graduated into must land in the same commit, and the amendment is meaningless without the decision that caused it.

### Reaching the destination

When no open tickets remain and the horizon is clear — every row in the Tickets table is Decided or Out of scope, and `horizon` is empty:

1. **Take the closed map to the user for approval.** A wayfinding map sits behind the loop's **unconditional** human gate (`docs/sdlc.md` §4 step 3), alongside the PRD and slice specs: it is never suspended, on any branch — only the TDD-plan gate is — and **the agent never flips the header itself**. Present the closed map and stop. Only once the user approves it, run `set map.html header.status=approved`.
2. **Once that gate has cleared, produce the slicing** — the last act of charting, and the first input to everything downstream. Split the effort into shippable slices in **dependency order**: what must ship first sits first — core (`src/core/`) and schema changes before the builders that consume them, builders before the plugin or CLI surface that exposes them. One slice becomes one branch, one spec, and one TDD plan. Mark each vault-gating slice in the `slices` table (`docs/sdlc.md` §3 → Landing the stack).

   **Run the coverage check while slicing.** Every ticket must land in exactly one slice or be explicitly marked *no build work* — a filed issue, a carried question, a decision that only constrains others. This is the check that catches a decision quietly dropped between map and code, and it is the only traceability worth keeping; do not build a matrix.

   **End the slicing with a close slice.** The last slice of every effort wraps up loose ends: it removes the scaffolding the effort built, carries the nice-to-haves deferred along the way, and does the mapping-and-planning tidy-up. Give it a spec like any other slice — a deletion or cleanup slice with no spec loses its inventory the moment the map stops carrying content. It is the stack's final branch (`docs/sdlc.md` §3), and where `/pr-tidying`'s stack-close pass runs.

   Record it in the map's existing `slices` section: `set-body map.html slices --file slices.html` — **the body carries its own `<plan-table><table>` wrapper** (see `set-body` above). Each slicing *call* — an ordering that departs from the obvious one, a split, a deliberate non-blocker — is a decision and gets a register row, with `slicing` in `Decided in`.
3. **Commit the closed map**, along with the slicing, any issue docs, and the context-doc updates it produced.
4. Summarize the route — Destination, the decision register, the slicing — and hand off to the target named in the Destination section. For a `prd-writing` hand-off that means **one PRD carrying the cross-cutting contract and the slice list, plus a thin spec per slice**; the map and its tickets are that step's input, and the tickets' **Obligations** are its checklist.
5. **If the downstream work is large enough to need a stack of branches**, the `map--` branch is the planning layer of that stack and everything else builds on top of it — see `docs/sdlc.md` §3 for the sequencing. The close slice is the stack's final branch and carries the cleanup, not this one.
6. **Do not file the map.** Reaching the destination is not closing the effort. When the last slice ships and nothing cites these artifacts any more, close the effort per `references/closing.md`.

### Amending a closed map

Execution will eventually contradict a decided ticket — a constraint that proves false, a cheaper path found while building, a fact the map got wrong.

**Amend the map; do not leave it lying.** Add a callout to the affected ticket recording **what superseded the decision and why**, and strike the superseded text with `<s>` rather than deleting it — the same shape as an amendment between tickets. Move the register row to `decisions.html`'s **Superseded** table with what overturned it, and name the superseding source (usually a slice spec or a context doc) so a reader can follow it forward.

```bash
node .claude/skills/html-planning/planr.js prepend <ticket>.html resolution --file amendment.html
node .claude/skills/html-planning/planr.js insert <ticket>.html resolution --before-heading "<heading>" --file amendment.html
node .claude/skills/html-planning/planr.js strike <ticket>.html resolution --match "<superseded sentence>"
node .claude/skills/html-planning/planr.js rm-item decisions.html register --match "<rule text>"
node .claude/skills/html-planning/planr.js append decisions.html superseded --into tbody --file row.html
```

`prepend` puts the callout above everything in the Resolution; `insert --before-heading` places it against a specific heading. `rm-item` then `append` moves the register row. Run `check` after.

## Maintaining this skill

**Run `node .claude/skills/wayfinding/check-tooling.js` after editing any wayfinding artifact.** It exits 1 on a break and names the invariant. It exists because this tooling was patched into inconsistency four rounds running, and every defect that mattered was found by *executing* a command rather than reading prose.

**It has outgrown this skill, and that is deliberate.** Alongside the wayfinding invariants it now asserts the mechanically decidable half of `/pr-tidying` Category H, because a checker terminates where a reading pass does not: every repo-rooted path cited by `CLAUDE.md`, `docs/sdlc.md`, a context doc, **a skill or an agent definition** resolves and is committable (`instrpaths`); `docs/sdlc.md`'s three AI-infrastructure inventories join to the tree in both directions (`sdlcinv`); and the artifact lifecycle rules `docs/sdlc.md` §4e states hold — no TDD plan is tracked (`tddplans`) and no tracked doc cites one (`tddcites`), no issue doc carries the `implemented` status `issue-creating` gives it no end state for (`issuedocs`), and every `.claude/agent-memory/` index pointer resolves with nothing orphaned beside it (`memindex`). Each of those was a hand-found finding in a tidy pass first. **A finding this file could have made and did not is a checker gap: add the assertion, do not hand-fix the prose.** Every check is registered in `pr-tidying`'s Category H table — an unregistered one is never run by that pass, and the omission is invisible because everything still passes.

**Every rule here is stated in several places on purpose**, and that is what makes it easy to break. A template comment ships into every generated document, so the rule has to live there; a session that never opens the template still needs it here. Fixing one copy and leaving the others *relocates* an inconsistency rather than reducing it — so change a rule in **all** of its places in one pass, then run the checker.

**Each file states a rule once, at its own altitude.** Restating another file's content is how the copies drift apart:

| File | States |
|---|---|
| `SKILL.md` | The mechanics. Every invariant appears here or it is not part of the system |
| `references/closing.md` | The close-time rules, outright — nothing else restates them in enforceable form |
| The five templates | Only what a reader of the *generated* document needs |
| `docs/sdlc.md`, root `CLAUDE.md` | Only the shape: enough to know this skill exists and when to reach for it. Never the mechanics |

Two consequences worth stating, because both have been violated here: **every value in a documented enum must be reachable by some step** — a status nothing ever sets is a lie the next reader acts on — and **a record one instruction reads must be written by another**, or the reader finds it empty forever.
