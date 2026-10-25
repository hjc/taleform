# Story model

The concepts Taleform's declarative model is built from, decided in the Declarative Model wayfinding effort (`docs/features/generic-data-model/wayfinding/`). These are model decisions: the config language and property names are decided separately. Today's code predates them; where it differs, the default config maps today's notes onto this model so their output stays unchanged.

## Families

Every concept belongs to one family. The set is open: a new family (Threads, Clues, Sessions) can be added without redesigning the others.

| Family | Is | Members by default | Trait |
|---|---|---|---|
| Structure | Containers that group and order | Campaign, Arc, Mission, Act | Has members and an order; never played itself, so its progress is derived from its members |
| Moments | What happens at the table | Moments, placed as beats | Has a position, a status and XP |
| Cast & world | What exists across moments | Creature, NPC, Place, Faction, Item | No position or status; moments refer to it |

## Structure is open nesting

- One generic **container**. Its levels, their names, the property that links a child to its parent and the property that orders siblings all come from config.
- The default config declares Campaign > Arc > Mission > Act. An Act groups by the `act` number within its mission, which is how today's notes are written.
- **Mission is not special in the core.** The config binds features to levels: one Adventure Map, XP ledger and Resume here per Mission. No builder targets Arc or Campaign yet.

## Moment and beat: recipe and instance

| | Moment (recipe) | Beat (instance) |
|---|---|---|
| Is | The reusable definition | A moment placed in one container |
| Holds | Content, the `^card` text, its encounter, awards, rules | Point-in-time state: status, local overrides, table notes |
| Written as | A note anywhere | A note with an `instance-of` link to its moment (name not final) that embeds the moment's content |

- **A one-time moment is its own only beat.** Every sequence note today is one, so today's notes are valid as they stand.
- **A beat's own frontmatter key overrides its moment's**, like a prototype chain. An edit to the moment reaches every beat: embeds update live, and derived values on the next build. Beat state stays local.
- **A moment can be placed in several containers.** Each placement is its own beat, with its own state and its own generated navigation.
- **Order comes from either side.** A container may list its beats in order; the default config reads order from each beat's own `act` and `beat` numbers.
- **The word `beat` now means a placed moment.** It used to be both a `kind` value and an order number; how the default config keeps `kind: beat` building is left to the schema decisions.

## Builds derive; authoring creates

- **A build only derives**: it is pure and idempotent, and touches generated text only (`CLAUDE.md` § Invariants).
- **Creating a beat is an authoring action**, run by a plugin command or by Claude as the DM's assistant, never by a build. Placing a moment writes frontmatter, which a build must never do.
- Future generators (seeded arrangement from pools of moments) are authoring actions too.

## Cast & world

- **Creature** is a recipe: a stat block with `cr` and, later, the rest of a system's numbers. Today it is a `statblock: true` note, matched by `name`.
- **NPC** is an entity with an identity. It may be an instance of a creature (`instance-of` the Bandit Captain, named Vexa) and inherits its numbers; without one it is just a person.
- **Place, Faction, Item** carry no numbers by default; they exist so moments can refer to them.

## Encounter is a relation

- **An encounter is a beat featuring a roster of cast**, such as "4 × Wolf" or "Vexa". It is not a type of note.
- Combat XP derives from the roster's creatures; an NPC counts through its creature.
- The Initiative Tracker ```` ```encounter ```` block is the default config's way of writing a roster.
