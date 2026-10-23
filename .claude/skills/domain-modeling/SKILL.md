---
name: domain-modeling
description: Pin down the vocabulary for an effort — every term bound to a concrete referent in this codebase or marked NEW — before it gets spent in a PRD, plan, or schema. Use alongside `grilling` when naming a destination, scoping a feature, or whenever a discussion has started using a word two ways.
---

Fix the vocabulary for an effort **before** it is spent in a frontmatter property, a builder id, a region id or a canvas card, and bind each term to something that already exists here.

Vocabulary is discovered *with* the user. Pair this with the `grilling` skill: grilling walks the decision tree, domain-modeling names what the decisions are about. Look facts up yourself; put the naming choices to the user one at a time.

## Bind every term

Taleform's model is small and written down in a few places. A term is not modeled until it points at one of them — or is explicitly declared new.

| Term binds to | Look it up in |
|---|---|
| A frontmatter property | `README.md` § The typed model, then `src/builders/schema.ts` for what is enforced (`KINDS`, the `RETIRED` map of old names) |
| A domain rule (sequence, status, resume, awards, combat XP, levels, party size) | `src/core/story.ts` |
| A builder or its output | `BUILDERS` in `src/builders/index.ts` (run order), `README.md` § Builders, then the builder's own file |
| A generated region or marker | the `%% taleform:<id> %%` ids in `src/builders/*.ts`; `src/core/regions.ts` |
| Membership, links, kinds | `src/core/index.ts` (`StoryIndex`, `SEQ_KINDS`, `members`), `src/core/links.ts` |
| An Obsidian behaviour the schema rests on | `CLAUDE.md` § Obsidian facts we tested |
| A story-map term (Story Map, Adventure, Arc, Campaign) | `CLAUDE.md` § Roadmap and open questions |
| How the DM actually uses a word | the live vault's notes and its `CLAUDE.md` § Taleform — **read-only**, never edited from here |
| Nothing yet | Mark it **NEW** — and say what it is *not*, so its edges exist before its implementation does |

**A term that binds to an existing property must use that property's name.** Never coin a synonym for something in the typed model — if the discussion calls `beat-status` "progress," either rename the discussion or record "progress" as the DM's *spoken* name for `beat-status`.

**Check the generated text, not just the property name, for anything the DM reads.** A property and the words a builder writes into a note or card may differ (`optional` vs the `skip — optional` edge label), but the divergence must be deliberate and written down.

## Collision check

Before adopting a term, grep for it. This codebase already overloads several words:

| Word | Already means |
|---|---|
| **beat** | `kind: beat` (one sequence kind), the `beat` number property (position within an act), and loosely any sequence note (`act`, `beat`, `scene`, `combat`, `challenge`) |
| **act** | `kind: act` (an act's own note) and the `act` number property on every sequence note |
| **map** | the Adventure Map canvas (`adventure-map` builder), the retired `map` property, and "Story Map", the umbrella term for Adventure / Arc / Campaign |
| **card** | a canvas node on a generated map, and the `^card` block in a beat note that the map's card embeds |
| **resume** | the derived resume beat (`resumeBeat`), the `%% taleform:resume %%` region, and the retired `resume` property |
| **check** | `npm run check` (typecheck + tests + bundle) and the CLI's `check` command (stale output or schema errors) |
| **schema** | the `schema` builder, which validates frontmatter and emits nothing — not a JSON or Bases schema |
| **mission** | `kind: mission` (the note) and the `mission` link property that makes a note a member |

If the term you want is taken, either qualify it (`map card`, never bare `card`) or pick another word. Record the collision you dodged; the next person will reach for the same word.

## What to produce

A **glossary** — one row per term — plus, where the domain has them, states and relationships. It goes wherever the effort's vocabulary needs to be loaded: `vocabulary.html` beside a `wayfinding` map, the terminology section of a PRD, or a standalone `glossary.html`. Use `html-planning` for any document you write to disk.

**Glossary** (`<plan-table>`):

| Term | Means | Binds to | Not |
|---|---|---|---|
| Resume beat | Where the table picks up, derived from `beat-status` alone | `resumeBeat` in `src/core/story.ts` | Not a property the DM sets (`resume` is retired); not the `%% taleform:resume %%` region that displays it |
| Arc | A Story Map level above one Adventure (one mission); its exact scope is still the DM's to decide | **NEW** (Arc Map builder, named in `CLAUDE.md` § Roadmap, not designed) | Not an act (`kind: act`, inside one mission); not a folder |

The **Not** column is not optional — a term without stated edges gets stretched.

**States** — for anything with a lifecycle, list the states, the legal transitions, and what causes each. An entity whose states you cannot enumerate is a decision still open, not a glossary row.

**Relationships** — one line each, with cardinality and the direction that owns the reference: `mission 1—N member` (owned by each member's `mission` link), `beat 1—N award` (the beat's `awards` list). Where the relation already exists, cite the property or the `StoryIndex` method rather than describing it.

## Rules

- **One name per concept, one concept per name.**
- **Name the thing, not its current implementation.** A term encoding today's storage or transport ("the JSON blob") is wrong after the first refactor.
- **Nouns for entities, verbs for transitions.** A term doing both is two terms.
- **No term without a referent.** Bound to existing code, or marked NEW with its edges stated.
- **Vocabulary is a decision, not a summary.** Put each contested term to the user and wait.
- **Revisit on contradiction.** Fix a glossary row a later decision invalidates; everything downstream cites it.
