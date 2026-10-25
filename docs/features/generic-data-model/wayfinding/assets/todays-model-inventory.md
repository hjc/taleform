# Today's model as data: inventory

Seed for the shipped default model config. Every rule, literal and constant Taleform hard-codes, read from the tree at `5dc8b28` (branch `hjc/map--generic-data-model`). All `file:line` refs are against that tree. Parity: `node dist/cli.cjs check --vault test-vault --json` returned `changes: []`, `problems: []` at time of writing, so every test-vault sample quoted below is current generated output.

Notation: `fmt(n)` = `n.toLocaleString("en-US")` (`src/core/story.ts:145`). `title(n)` = the note's first H1 text, else its basename (`src/core/index.ts:52-61`). `status(n)` = `beat-status` or `"planned"` (`src/core/story.ts:9`). `truthy(v)` = `v === true || v === "true"` (`src/core/frontmatter.ts:46`).

## 1. Note kinds and classification

| Kind | Declared by | Role | Where |
|---|---|---|---|
| `mission` | `kind: mission` | Root of a story; owns members, hosts `resume` / `xp` regions, map hub | `index.ts:90-92` |
| `act` | `kind: act` + `mission` link | Sequence note; heads an act group; excluded from resume | `index.ts:6`, `story.ts:27` |
| `beat`, `scene`, `combat`, `challenge` | `kind` + `mission` link | Sequence notes; no behavioural difference between them anywhere in `src/` | `index.ts:6` |
| `reference` | `kind: reference` + `mission` link | Member, not on the line; drawn as a file card in the map's left column | `adventureMap.ts:56,124` |
| `bench` | `kind: bench` + `mission` link | Accepted by the schema; **read by nothing** | `schema.ts:11` |
| stat block | `statblock: true` (no `kind`) | Creature with `name`, `cr` for combat XP | `story.ts:128-132` |
| (anything else) | — | Ignored, but resolvable as a link target (e.g. hand-off place) | — |

Constants: `SEQ_KINDS = {act, beat, scene, combat, challenge}` (`index.ts:6`); `KINDS = {mission, …SEQ_KINDS, reference, bench}` (`schema.ts:11`).

Classification rules:

| Rule | Exact logic | Where |
|---|---|---|
| Kind | `str(fm.kind)` (empty string / null = no kind) | `index.ts:60` |
| Story-data gate (schema) | validated only if `kind` is set **and** (`kind === "mission"` or `fm.mission !== undefined`). A note with `mission` but no `kind`, or `kind: beat` with no `mission`, is silently skipped | `schema.ts:36` |
| Mission | `kind === "mission"` | `index.ts:91` |
| Member | any note `≠ mission` whose `mission` resolves (via `link()`, see §4) to the mission | `index.ts:95-97` |
| Sequence note | member with `kind ∈ SEQ_KINDS` | `story.ts:16` |
| Beat (strict, for resume) | sequence note with `kind !== "act"` | `story.ts:27` |
| Act note of act N | member with `kind: act` and `String(fm.act) === String(N)` (last wins) | `navigation.ts:24-25`; map: first `act` note in that act's ordered run, `adventureMap.ts:101` |
| Optional beat | `truthy(fm.optional)` | `story.ts:33`, `awards.ts:51`, `adventureMap.ts:97` |
| Stat block | `truthy(fm.statblock)` | `story.ts:129,131` |

## 2. Frontmatter properties per kind

Validation lives in `src/builders/schema.ts`; all are severity `error` unless marked.

### Every note

| Check | Error text | Where |
|---|---|---|
| frontmatter starts line 0 `---`, closes with `---` | `frontmatter is never closed` | `frontmatter.ts:16-18` |
| YAML is a mapping | `frontmatter is not a mapping` | `frontmatter.ts:21` |
| YAML parses | `invalid YAML: <first line of parser message>` | `frontmatter.ts:24` |
| (fm errors reported for **every** note, before the story-data gate) | — | `schema.ts:35` |

### Story notes (passed the gate)

| Property | Applies to | Type / rule | Error text | Where |
|---|---|---|---|---|
| `kind` | all story notes | one of `KINDS` | ``kind `<k>` is not one of mission, act, beat, scene, combat, challenge, reference, bench`` | `schema.ts:37` |
| retired keys | all story notes | must be absent (§3) | ``\`<old>\` is retired; use <now>`` | `schema.ts:38` |

### `kind: mission`

| Property | Type | Req | Rule | Error text | Read by | Where |
|---|---|---|---|---|---|---|
| `party-size` | number | opt | `Number.isFinite(Number(v)) && Number(v) >= 0` | ``\`party-size\` must be a number`` | `partySize()` uses it only if `> 0` (so `0` passes schema but means "unset") | `schema.ts:46-49`, `story.ts:147-150` |
| `party-xp` | number | opt | same as above | ``\`party-xp\` must be a number`` | running totals, ledger party line; presence test is `!== undefined` | `schema.ts:46-49`, `awards.ts:46-47`, `ledger.ts:57-58` |
| `handoff` | text | opt | `undefined`, `null` or string | ``\`handoff\` must be text`` | map hand-off note card (only if a hand-off link exists) | `schema.ts:50,73-76`, `adventureMap.ts:276` |

### Members (any kind with a `mission`)

| Property | Type | Req | Rule | Error text | Where |
|---|---|---|---|---|---|
| `mission` | link | req | resolves via `index.link()` (lenient: whole link **or first embedded link**) | ``\`mission\` <raw> does not link to a note`` | `schema.ts:55-56` |
| `mission` target | — | — | target's `kind` is `mission` | ``\`mission\` links to <basename>, which is not \`kind: mission\``` | `schema.ts:57` |

Non-sequence members (`reference`, `bench`) stop here (`schema.ts:58`).

### Sequence notes (`kind ∈ SEQ_KINDS`)

| Property | Type | Req | Enum / rule | Error text | Where |
|---|---|---|---|---|---|
| `act` | integer | req | `Number.isInteger(Number(v))` (missing → `NaN` → error) | ``\`act\` must be a whole number`` | `schema.ts:60` |
| `beat` | integer | req | same; acts use `beat: 0` by convention only (test vault) | ``\`beat\` must be a whole number`` | `schema.ts:60` |
| `beat-status` | enum | opt (default `planned`) | `planned`, `played`, `partial`, `skipped` (`STATUSES`, `story.ts:8`) | ``\`beat-status\` <v> is not one of planned, played, partial, skipped`` | `schema.ts:61-62` |
| `prev` | whole link | req | `parseLink` | ``\`prev\` must be a whole link``; unresolved → **warning** ``\`prev\` <target> does not resolve yet`` | `schema.ts:63-67` |
| `next` | whole link | req | same | ``\`next\` must be a whole link`` / warning ``\`next\` <target> does not resolve yet`` | `schema.ts:63-67` |
| `awards` | list of objects | opt | see award fields below | see below | `schema.ts:68`, `story.ts:51-70` |
| `entry` | text | opt | string/null | ``\`entry\` must be text`` | `schema.ts:69` |
| `branches` | list of `{to, label}` | opt | item is object; `to` whole link; `label` string if present | `branches[i] must be an object`; `branches[i].to must be a whole link`; `branches[i].label must be text` | `schema.ts:81-89` |
| `outcomes` | list of `{if, then, to}` | opt | item is object; `then` non-empty; `to` whole link if present; `if` **unvalidated** | `outcomes[i] must be an object`; ``outcomes[i] needs \`then\```; `outcomes[i].to must be a whole link` | `schema.ts:90-93` |
| `optional` | bool | opt | **unvalidated**; `true` or `"true"` | — | `story.ts:33` |
| `related` | list of links | opt | **unvalidated**; read only with `--threads` | — | `adventureMap.ts:211` |

A non-object `branches`/`outcomes` item reports `must be an object` and then is checked as `{}`-ish, so a string item also yields `.to must be a whole link` (double error, `schema.ts:83-87`). A scalar `branches: X` is wrapped as a one-item list (`list()`, `frontmatter.ts:44`).

### Award fields (`awardsOf`, `story.ts:51-70`)

| Field | Type | Default | Rule | Error text (prefix `awards[i]`) |
|---|---|---|---|---|
| (item) | object | — | not null/array | ``awards[i] must be an object with at least \`xp\``` |
| `xp` | number | req | finite and `> 0` | `awards[i].xp must be a positive number` |
| `type` | enum | `story` | `story` or `optional` | `awards[i].type must be story or optional, not <t>` |
| `for` | text | — | what earns it | — |
| `per` | text | — | repeatable unit | — |
| `max` | number | — | `Number(a.max)`, unvalidated | — |
| `note` | text | — | extra DM line | — |
| (unknown key) | — | — | allowed set `xp, type, for, per, max, note` | `awards[i].<k> is not an award field (xp, type, for, per, max, note)` |
| `per`/`max` on story | — | — | only on optional | `awards[i]: per / max only make sense on an optional award` |

A malformed award is reported and skipped; the rest still count. Builders other than schema call `awardsOf` with a no-op reporter (`awards.ts:21,52`, `ledger.ts:41`, `adventureMap.ts:245`).

### Stat block notes (not schema-validated)

| Property | Rule | Where |
|---|---|---|
| `statblock` | `truthy` | `story.ts:129` |
| `name` | matched exactly (`str(name) === creature`) | `story.ts:129` |
| `cr` | `str(cr)` must be a key of `XP_BY_CR` (`"1/8"`, `"2"`; `0.5` / `"0.5"` miss) | `story.ts:116-117` |

## 3. Retired properties (`RETIRED`, `schema.ts:18-26`)

| Old | Replacement text (verbatim) |
|---|---|
| `map-label` | `entry` |
| `map-branches` | `branches (a list of {to, label})` |
| `map-if` | `outcomes (a list of {if, then, to})` |
| `map-handoff` | `handoff` |
| `map` | `top-level entry / branches / outcomes / handoff` |
| `xp-award` | `awards (a list of {xp, for, …})` |
| `resume` | `nothing: resume is derived from beat-status` |

Checked on every story note of every kind, including `mission` (`schema.ts:38`).

## 4. Relations and resolution

### Link parsing (`src/core/links.ts`)

| Function | Rule | Where |
|---|---|---|
| `parseLink` (whole) | `^\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]*))?\]\]$` on trimmed string; `target` trimmed; `subpath` keeps the `#`; `alias` | `links.ts:8,14-22` |
| `findLink` (embedded) | first match of the same pattern anywhere, re-parsed whole | `links.ts:25-29` |
| YAML fold | unquoted `[[X]]` parses as `[["X"]]`; folded back to `"[[X]]"` | `frontmatter.ts:32-39` |

### Resolution (`StoryIndex`, `src/core/index.ts`)

| Case | Rule | Where |
|---|---|---|
| target contains `/` | exact path (`.md` appended if absent), else first note whose path ends with `/<want>` | `index.ts:75-78` |
| basename | strip `.md`; unique hit, else fewest path segments (ties: first in sorted-path order) | `index.ts:79-81` |
| `link(value)` | `parseLink(value) ?? findLink(value)` then `resolve`, used for `mission` membership and schema `mission` check | `index.ts:85-87` |

### Relations

| Relation | Source | Target | Resolution / rule | Where |
|---|---|---|---|---|
| membership | member `mission` | mission note | `link()` (lenient); folder never used | `index.ts:95-97` |
| sequence | members ∩ `SEQ_KINDS` | — | sorted, §5 | `story.ts:13-18` |
| `prev` / `next` | sequence note | any note (+ `#heading`) | whole link; navigation labels them; map draws `next` edges only between beats of this mission (by **basename**, `beats.has(target)`) | `navigation.ts:54`, `adventureMap.ts:148-149` |
| `entry` | beat | — | label of the sequence edge **into** this beat, only if this beat's `prev` targets the source | `adventureMap.ts:152-153` |
| `branches[].to` | beat | beat of this mission | by basename; else map error ``branches: <raw> is not a beat of this mission`` | `adventureMap.ts:163-174` |
| `outcomes[].to` | beat | beat of this mission | optional; not a beat → map error ``outcomes[k].to <t> is not a beat of this mission`` and the IF card is kept without its edge | `adventureMap.ts:225-238` |
| `related[]` | beat | beat of this mission | `--threads` only; dedup unordered pair; skip self and pairs already joined by `next`/`prev` | `adventureMap.ts:207-221` |
| hand-off | **last beat in map order**'s `next` | any non-beat note (+ subpath) | `index.resolve`; unresolved → map error ``\`next\` <t> does not resolve to a note`` | `adventureMap.ts:267-285` |
| `handoff` text | mission | — | shown beside hand-off card only if the link resolved | `adventureMap.ts:276-281` |
| encounter → stat block | ```` ```encounter ```` creature name | stat block | first note (sorted-path order) with `truthy(statblock)` and `name === creature`; else `resolve(creature)` by basename if that note is `truthy(statblock)` | `story.ts:128-132` |
| act group | act number | act note | §1 | `adventureMap.ts:101` |
| reference | `kind: reference` member | mission map | left column, sorted by path | `adventureMap.ts:55-56,124` |

Note: the map keys beats by **basename** (`adventureMap.ts:62`), so two members with one basename collapse to one card.

## 5. Ordering rules

| What | Rule | Where |
|---|---|---|
| Index load | `io.list()` sorted with default `.sort()` (UTF-16 code units) | `index.ts:36` |
| Sequence | members (index order) filtered to `SEQ_KINDS`, stable sort by `Number(act ?? 0)`, then `Number(beat ?? 0)`; ties keep sorted-path order | `story.ts:13-18` |
| Map order | members sorted by `path.localeCompare`, then by `act`, `beat` (`Number(x ?? 0)`); ties keep **localeCompare** order (differs from `sequence()` on ties) | `adventureMap.ts:55,89` |
| Map acts | distinct `act` values in map order | `adventureMap.ts:90` |
| Navigation emit order | members by `basename.localeCompare` (no output effect) | `navigation.ts:36` |
| Builder run order | `schema, navigation, awards, resume, ledger, adventure-map` | `builders/index.ts:14` |
| Award render order | story awards in list order, then optional in list order | `awards.ts:70-82` |
| Canvas node order | groups (creation order), then other generated nodes (creation order), then kept hand nodes | `adventureMap.ts:293` |
| Canvas edge order | generated (creation order), then kept hand edges | `adventureMap.ts:294` |
| Reference cards | by path `localeCompare` | `adventureMap.ts:55-56` |

## 6. Derived values

| Value | Exact rule | Where |
|---|---|---|
| `status(n)` | `str(fm["beat-status"]) ?? "planned"` | `story.ts:9` |
| touched | `status ∈ {played, partial, skipped}` | `story.ts:10` |
| **resume beat** | beats = sequence minus `kind: act`; `furthest` = last index touched; if `beats[furthest]` is `partial` → it; else first beat after `furthest` with `status === planned` and not `truthy(optional)`; none → "mission complete" | `story.ts:26-34` |
| `partySize` | `Number(fm["party-size"])` if finite and `> 0`, else undefined | `story.ts:147-150` |
| **combat XP total** | Σ `count × XP_BY_CR[cr]` over readable entries with a known CR; unknown CR → problem, entry dropped | `story.ts:92-126` |
| combat XP each (ledger) | `Math.floor(total / partySize)`; no party → undefined | `ledger.ts:33` |
| combat XP each (running) | `party ? Math.floor(total / party) : 0` | `awards.ts:53` |
| combat XP each (map) | `Math.floor(total / party)` | `adventureMap.ts:260` |
| story XP of a note | Σ `xp` of `type: story` awards | `awards.ts:52`, `adventureMap.ts:246` |
| **running totals** | only if `party-xp` present and finite; `xp = party-xp`; for each sequence note (acts included) with `status === planned` and not optional: `story + combatEach`; skip if both 0; record `{before: xp, after: xp + gain}`; `xp += gain` | `awards.ts:44-59` |
| `nextLevel(xp)` | first `i` with `LEVELS[i] > xp` → `[i+1, LEVELS[i]]`; none → null | `story.ts:140-143` |
| running text | `crossed = nextLevel(before)`; if `crossed && after >= crossed.threshold` → `**<after> · LEVEL <L>.**`; else `next = nextLevel(after)` → `**<after> / <threshold>.**`, or `**<after>.**` at level 20 | `awards.ts:61-66` |
| ledger `earned` | Σ over **all** sequence notes, every status, optional beats included: combat each (0 without party) + story xp | `ledger.ts:26-49` |
| ledger `optionalMax` | Σ `a.max ?? a.xp` over optional awards. `max` is a **count** in the award callout but summed here as XP: test vault prints `plus up to 3 optional` for `xp: 25, max: 3` (true cap 75) | `ledger.ts:46-48` |
| ledger end XP | last running `after`, else `party-xp` | `ledger.ts:59-60` |
| status mark | `played ✓`, `partial ◐`, `skipped ✗`, else `○` | `ledger.ts:29` |
| map "played" (edge colour) | raw `beat-status ∈ {played, partial}` | `adventureMap.ts:145` |
| act group status | the act note's raw `beat-status`, else `planned` (not derived from its beats) | `adventureMap.ts:102` |
| link label (nav) | target resolves into this mission (mission or member) and no subpath → `title(target)`; else subpath minus `#`, else target. Frontmatter **alias is ignored** | `navigation.ts:27-34` |
| `linkTo(n, label)` | `[[basename]]` or `[[basename|label]]` when label differs | `story.ts:152` |
| hand-off | §4 | — |

## 7. Tables

### `XP_BY_CR` (`story.ts:75-81`; comment at `:74` cites "the vault's xp-budget.py")

| CR | XP | CR | XP | CR | XP | CR | XP |
|---|---|---|---|---|---|---|---|
| `0` | 10 | `5` | 1800 | `13` | 10000 | `21` | 33000 |
| `1/8` | 25 | `6` | 2300 | `14` | 11500 | `22` | 41000 |
| `1/4` | 50 | `7` | 2900 | `15` | 13000 | `23` | 50000 |
| `1/2` | 100 | `8` | 3900 | `16` | 15000 | `24` | 62000 |
| `1` | 200 | `9` | 5000 | `17` | 18000 | `25` | 75000 |
| `2` | 450 | `10` | 5900 | `18` | 20000 | `26` | 90000 |
| `3` | 700 | `11` | 7200 | `19` | 22000 | `27` | 105000 |
| `4` | 1100 | `12` | 8400 | `20` | 25000 | `28`/`29`/`30` | 120000/135000/155000 |

### `LEVELS` (`story.ts:137`): XP to reach level `i+1`

`[0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]` (levels 1–20).

### Colour ids (Obsidian canvas presets: 1 red, 2 orange, 3 yellow, 4 green, 5 cyan, 6 purple)

| Name | Value | Use | Where |
|---|---|---|---|
| `STATUS_COLOR.played` | `"4"` | beat card, act group | `adventureMap.ts:22` |
| `STATUS_COLOR.partial` | `"3"` | same | `:22` |
| `STATUS_COLOR.skipped` | `"1"` | same | `:22` |
| planned | (no `color` key) | same | `:86` |
| `BRANCH` | `"2"` | branch edges / pinned labels | `:23` |
| `RED` | `"1"` | IF (with `if`), XP, combat, hand-off note cards and edges | `:23` |
| `RESUME` | `"6"` | resume marker + edge | `:23` |
| path taken | `"4"` | sequence / skip / branch edge between two played-or-partial beats | `:154,187,194` |
| thread | `"5"` | `related` edge | `:218` |

## 8. Builders

All run per mission in `selectMissions(index, --mission names)` (all missions if none; filter by basename, `navigation.ts:83-86`).

### 8.1 `schema` (`schema.ts`)

id `schema`; description `Validates mission and beat frontmatter against Taleform's types`. Reads every note; writes nothing; emits only problems (§2).

### 8.2 `navigation` (`navigation.ts`)

id `navigation`; description `Beat header and Next footer from mission / prev / next`. Reads each sequence member via `ctx.read`; writes the whole note back (only header and footer change).

| Step | Rule / literal | Where |
|---|---|---|
| H1 | first line after frontmatter starting `# `; none → error `no H1, so the header has nowhere to go` | `:43-47` |
| guard | non-blank lines between frontmatter and H1 must all match `^\*?\[\[|^← |^%%`; else **warning** `unexpected text above the H1, so the header was left alone` | `:48-53` |
| links | `mission`, `prev`, `next` labelled (§6); any not a whole link → error ``\`mission\`, \`prev\` and \`next\` must all be whole links`` | `:54-58` |
| header (3 lines, replaces everything between frontmatter and H1) | `<mission>` / `← <prev> • **<H1 text>** • <next> →` / `` | `:59-60` |
| footer back-line parts | `← <prev>`; then `[[<actBasename>|Act <act>]]` if note is not an act and an act note exists; then `<mission>` unless rendered `prev === mission` | `:61-64` |
| footer | `## Next` / `` / `> [!tip] Next → <next>` / `> ` + parts joined ` • ` | `:65` |
| body | H1 up to the **last** line whose trim is `## Next` (everything from it to EOF is replaced); if none: trim trailing blank lines, append `` / `---` / `` | `:67-75` |
| file end | footer + `""` (single trailing newline); CRLF preserved | `:76-77` |

Sample (`Road 1.01`):

- header line 1: `[[The Lantern Road]]`
- header line 2: `← [[Road Act 1 — The Crossroads|Act 1 — The Crossroads]] • **Hired at the inn** • [[Road 1.02 — Wolves on the road|Wolves on the road]] →`
- footer back-line: `> ← [[Road Act 1 — The Crossroads|Act 1 — The Crossroads]] • [[Road Act 1 — The Crossroads|Act 1]] • [[The Lantern Road]]`

### 8.3 `awards` (`awards.ts`)

id `awards`; description `AWARD XP callouts in beats, from typed awards`. Region `awards` in each sequence note (acts included).

| Item | Rule / literal | Where |
|---|---|---|
| placement (new region) | after H1, skipping one blank line if present: `h1 + (next line === "" ? 2 : 1)`; block followed by `""`. No H1 → not inserted | `:26-28`, `regions.ts:43` |
| empty content | removes an existing region and one blank line after; never inserts | `regions.ts:35-42` |
| emit | only if text changed | `:29` |
| story callout title | `> [!danger] 🟥 AWARD XP NOW — <fmt(Σxp)> EACH 🟥` | `:75` |
| story callout body | items `<for ?? "Award">` + (` (<fmt(xp)>)` when >1 story award) + (`: <note>`), joined ` · `; append `.` unless it ends `/[.!?]\**$/`; then ` Running: <running text>` if a running total exists | `:73-75` |
| separator | `""` line between callouts | `:78` |
| optional title | `> [!danger] 🟥 OPTIONAL XP — <fmt(xp)> EACH` + ` PER <PER UPPERCASED>` + ` (max <fmt(max)>)` + ` — <FOR UPPERCASED>` + ` 🟥` | `:79-80` |
| optional note | `> <note>` | `:81` |

### 8.4 `resume` (`resume.ts`)

id `resume`; description `Resume-here callout on the mission note, derived from beat-status`. Region `resume` on the mission note; replaced only, never inserted. Skips missions with no sequence (silently).

| Case | Content | Where |
|---|---|---|
| resume beat | `> [!tip] ▶ Resume here → [[<basename>|<H1>]]` / `> ![[<basename>#^card]]` | `:20` |
| none | `> [!success] Mission complete: every beat on the line has been played.` (also shown when the rest is skipped or optional) | `:21` |
| no region | warning ``no `%% taleform:resume %%` region on the mission note, so Resume here is not shown`` | `:25-27` |

### 8.5 `ledger` (`ledger.ts`)

id `ledger`; description `XP ledger on the mission note; checks Encounter lines against encounter blocks`. Region `xp` on the mission note; replaced only. Skips missions with no sequence.

| Line | Literal | Where |
|---|---|---|
| title | `> [!abstract]- XP ledger — <fmt(earned)> each` + `, plus up to <fmt(optionalMax)> optional` if `optionalMax` | `:56` |
| party line (if `party-xp` present & finite) | `> **Party now:** <fmt(party-xp)> each · **after this mission:** <fmt(end)>` + ` · level <L> at <fmt(threshold)>` | `:57-63` |
| spacer | `>` | `:64` |
| row (only notes with ≥1 bit) | `> - <mark> [[<basename>|<H1>]] — <bits joined " · ">` + ` → <running text>` | `:53` |
| combat bit | `⚔ <fmt(total)>` + (` ÷ <party> = **<fmt(each)> each**` or `` (set `party-size` for XP each)``); `<party>` is **not** `fmt`-ed | `:34` |
| story bit | `<for ?? "award"> **<fmt(xp)>**` (lowercase default, vs `Award` in callouts) | `:43` |
| optional bit | `optional <fmt(xp)>` + ` per <per>` + ` (max <fmt(max)>)` | `:47` |
| spacer | `>` | `:64` |
| legend | `> ✓ played · ◐ partial · ○ planned · ✗ skipped. Story and combat XP count toward the running total; optional XP does not.` | `:64` |
| no region | warning ``no `%% taleform:xp %%` region on the mission note, so the XP ledger is not shown`` | `:68-70` |
| cross-check | §10; warning ``the Encounter line says <stated> XP, but the encounter block adds up to <fmt(total)> (<count> × <creature> + …)`` | `:36-39` |
| combat parse problems | reported as **warnings** here only (awards/map swallow them) | `:31` |

### 8.6 `adventure-map` (`adventureMap.ts`)

id `adventure-map`; description `One Adventure Map canvas per mission`. Output `<mission folder>/<mission basename> — Adventure Map.canvas` (`:51`); emitted with `same: sameCanvas`. Skipped if the mission has no sequence members (`:64`). Every generated item carries `"generated": "adventure-map"` (`MARK`, `:20`).

Geometry constants (`:24-29`):

| Name | Value | Meaning |
|---|---|---|
| `W`, `H` | 360, 240 | beat card |
| `YS` | 340 | row step (`H + 100`) |
| `SIDE` | 460 | optional-beat x (`W + 100`); IF cards at `2*SIDE = 920`; hand-off note x |
| `LW` | 280 | left-column card width |
| `LX` | -340 | left column x (`-(LW + 60)`) |
| `HX` | -860 | hub / references / legend x (`LX - 40 - 80 - (W + 40)`) |
| act gutter | `row += 0.4` | `:109` |

Rows: each beat in map order takes one row; `y = trunc(row * YS)`; optional beats `x = SIDE`, else `0` (`:92-100`).

Node ids: `nid(...parts) = sha1(parts.join("|")).slice(0, 16)` (`:32`). Edge id `nid("e", from, to, label ?? "")` (`:80`).

| Node | id | type / keys (in emitted order) | Geometry | Colour | Text / label | Where |
|---|---|---|---|---|---|---|
| act group | `g|<act>` | `type, x, y, width, height, label, color?` | `x = LX-40 = -380`, `y = trunc(first*YS) - 60`, `w = -LX + 2*SIDE + W + 80 = 1700`, `h = trunc(rows*YS) + 20` | `STATUS_COLOR[actStatus]` | `Act <act> — <title> · <status>`; title = act note **basename** after first ` — `, whole basename if none, `""` if no act note (→ `Act N —  · planned`) | `:101-108` |
| beat card | `n|<basename>` | `type:"text", text, x, y, width, height, color?` (or `type:"file", file` when 0 `^card`) | `W×H` at row pos | `STATUS_COLOR[beat-status]` | `## [[<basename>|<H1>]]\n![[<basename>#^card]]` (always aliased) | `:112-119` |
| hub (mission) | `hub` | `type:"file", file, x, y, width, height` | `(HX, 0, W+40=400, H+160=400)` | — | — | `:122-123` |
| reference i | `ref|<basename>` | file | `(HX, H+220 + i*(H+60) = 460 + 300i, 400, 240)` | — | — | `:124` |
| resume marker | `resume` | `type, x, y, width, height, color, text` | `(LX, y(resume)+140, LW, 90)` | `6` | `## ▶ RESUME HERE\nthe first planned beat after the furthest one played` | `:126-131` |
| legend | `legend` | `type, x, y, width, height, text` | `(HX, -360, 400, 300)` | — | see below | `:132-142` |
| pinned branch label | `jump|<from>|<to>` | `type, x, y, width, height, text, color` | `(LX, y(from)+60, LW, 120)` | `"4"` if path taken else `"2"` | the branch `label` | `:196-201` |
| IF card | `if|<beat>|<k>` | `type, x, y, width, height, text, color?` | `(2*SIDE, y(beat)+50, W, 140)`; **all outcomes of a beat share one position** | `1` if `if` set | `**IF <if>**\n<then>` or `<then>` | `:224-239` |
| award XP card | `xp|<beat>` | `type, x, y, width, height, color, text` | `(LX, y(beat)+60, LW, 120)` | `1` | `## 🟥 AWARD XP\n**<fmt(story)> each**` (if story) then lines `🟥 OPTIONAL <fmt(xp)> each` + ` per <per>` + ` (max <fmt(max)>)`, joined `\n` | `:243-256` |
| combat XP card | `combat|<beat>` | same | `(LX, y+60, …)`, or `y+190` below an award card | `1` | `## ⚔ COMBAT XP\n<fmt(total)>` + ` · **<fmt(each)> each**` if party; only if `total > 0` | `:257-264` |
| hand-off | `handoff|<target>` | `type:"file", file, subpath?, x, y, width, height` | `(0, y(last)+YS+80, W+40, H+60)` | — | — | `:272-274` |
| hand-off note | `handoff-note` | `type, x, y, width, height, color, text` | `(SIDE, hy, W+40, 140)` | `1` | mission `handoff` verbatim | `:277-280` |

Legend text (`:135-141`), verbatim:

```
## Legend
**Cards** 🟩 played · 🟨 partial · ⬜ planned · 🟥 skipped
**Stepped right** optional or alternative beat
**Arrows** grey = sequence · 🟩 = the path the table took · 🟧 = branch
**Red cards** IF states (far right) and XP: 🟥 awards, ⚔ combat (left)

Generated by Taleform from beat frontmatter: edit the notes, not these cards. Drag freely — positions survive a regenerate, and anything you add by hand is kept.
```

Edges (keys `id, fromNode, fromSide, toNode, toSide, toEnd?, label?, color?`; default sides `right`→`left`; `toEnd` written only when not `arrow`):

| Edge | From → to | Sides | Label | Colour | Where |
|---|---|---|---|---|---|
| hub | hub → first beat | right→left | — | — | `:125` |
| resume | marker → resume beat | right→left | — | `6` | `:130` |
| sequence | beat → its `next` (if a beat) | main→side: right→top; side→main: bottom→right; else bottom→top | `entry` of target if target's `prev` is source | `4` if both played/partial | `:146-155` |
| skip | beat before a run of optional beats → beat after it (unless a branch already joins them) | `jump()` | `skip — optional` | `4` if both ends played and no optional in run played | `:176-191` |
| branch (short) | from → to | `jump()` | `label` | `4` if both played, else `2` | `:203` |
| branch (long, labelled) | from → label card → to | left→right, left→left | — | same | `:196-201` |
| thread (`--threads`) | earlier → later | right→right, `toEnd: "none"` | — | `5` | `:218` |
| outcome | beat → IF card; IF card → `to` | right→left; bottom→right | — | `1` if `if` | `:237-238` |
| XP / combat | card → beat | right→left | — | `1` | `:254,263` |
| hand-off | last beat → hand-off | bottom→top | `hands off to` | — | `:275` |
| hand-off note | hand-off → note | right→left | — | `1` | `:280` |

`jump(f, t)`: if every map-order beat strictly between them (by y) is optional → `bottom`→`top`, else `left`→`left` (`:157-161`).

Merge: positions (`x, y, width, height`) of a kept node with the same id overwrite the generated ones unless `--relayout` (`:68,73-75`). Hand nodes kept = not marked and id not regenerated; hand edges kept only if both ends still exist (`:288-292`).

Map errors (severity `error`):

- ``<n> `^card` blocks (needs exactly one): end the Trigger / Lands when paragraph with ` ^card` `` (`:61`, names the developer's own section wording)
- branches / outcomes / hand-off texts (§4)
- `duplicate ids <ids>: two map items resolve to the same thing` (`:297`)
- `map path outside the mission folder` (`:298`)

Test-vault overlap evidence: the pinned label `ask the hermit` and the `## 🟥 AWARD XP` card both sit at `(-340, 400)`; both IF cards of `Road 2.01` sit at `(920, 1886)`.

### 8.7 Engine, regions, canvas format

| Item | Rule | Where |
|---|---|---|
| region markers | `%% taleform:<id> %%` / `%% /taleform:<id> %%`, matched on trimmed lines | `regions.ts:11-12,21-23` |
| region ids | `awards` (beats, auto-inserted), `resume`, `xp` (mission, hand-placed) | `awards.ts:28`, `resume.ts:24`, `ledger.ts:67` |
| overlay | later builders `read` earlier emits | `engine.ts:42` |
| change | text differs from disk (or `same()` false); new file → `created` | `engine.ts:57-64` |
| line endings | LF internally; CRLF restored on write if the file had any `\r\n` | `vault.ts:15-22` |
| canvas format | `JSON.stringify(c, null, "\t") + "\n"` | `canvas.ts:31` |
| canvas equality | parse, drop `toEnd: "arrow"`, sort keys, sort items by id | `canvas.ts:37-59` |

## 9. Indexing rules

| Rule | CLI (`FsVault`) | Plugin (`ObsidianVault`) |
|---|---|---|
| files | `.md`, `.canvas` | same (`main.ts:24`) |
| dot names | skips any file/dir whose name starts `.` at any depth (`cli/main.ts:40`) | relies on Obsidian, which does not index dot folders |
| `node_modules` | skipped (`cli/main.ts:40`) | **not** skipped |
| Templates folder | `folder` from `.obsidian/templates.json`, read **whether or not** the core Templates plugin is enabled; exact relative-path match (`cli/main.ts:26-33,42`) | only when the core `templates` plugin is enabled; path equal or prefix (`plugin/main.ts:20-24`) |
| Templater / QuickAdd folders | not skipped | not skipped |
| vault discovery | `--vault`, else nearest ancestor with `.obsidian/` (`cli/main.ts:62-67,116`) | the open vault |
| auto-build | — | `metadataCache` `changed` on `.md`, `debounce(…, 1500, true)`, gated by `prefs.autoBuild` (default `true`) (`plugin/main.ts:12,67-71`) |

## 10. Parse / format conventions

| Convention | Rule | Where |
|---|---|---|
| H1 | first line after frontmatter starting `# `; title = rest trimmed | `index.ts:52-61` |
| `^card` | `/\s\^card[ \t]*$/gm` over the whole note text; exactly 1 per sequence note (0 → file card + error, >1 → text card + error) | `adventureMap.ts:30,60-61,115` |
| `^card` embed | `![[<basename>#^card]]` (map card, resume callout) | `adventureMap.ts:116`, `resume.ts:20` |
| encounter block | first `/^```encounter\n([\s\S]*?)\n```/m`; YAML; `creatures` list; entry `"Name"` (count 1), `{N: "Name"}`, or `{N: {creature: "Name"}}`; other keys (`name`) ignored | `story.ts:93-114` |
| encounter problems | `the encounter block is not valid YAML: <msg>`; `could not read encounter entry <json>`; `no stat block with a known CR for "<name>", so its XP is not counted` | `story.ts:99,112,119` |
| Encounter prose | `/^\*\*Encounter:\*\*.*?([\d,]+) XP/m`; commas stripped; compared to block total; only when a block exists | `ledger.ts:36-37` |
| numbers | `toLocaleString("en-US")` everywhere except the ledger's raw `÷ <party>` | `story.ts:145`, `ledger.ts:34` |
| act-title split | act note basename after first ` — ` (em dash with spaces) | `adventureMap.ts:103` |
| "Act N" label | `[[<act basename>|Act <act>]]` in footers | `navigation.ts:63` |
| `## Next` | heading matched by `trim() === "## Next"`, last occurrence | `navigation.ts:67-70` |
| run-sheet glyphs | `▶ ◆ ⚔ ⚙` appear only in a comment; labels carry whatever the H1 has | `navigation.ts:13` |

## 11. Correction table for `docs/issues/vault-conventions-hardcoded-in-src.html`

| # | Issue cites | Correct refs | Other errors / gaps |
|---|---|---|---|
| 1 | `adventureMap.ts:30, :60-61, :116`; `resume.ts:204` | `resume.ts:204` → `resume.ts:20` | rest correct |
| 2 | `navigation.ts:141-158, :148`; `index.ts:53-57` | `navigation.ts:43-53`; regex `:50`; `index.ts:52-57` | — |
| 3 | `navigation.ts:158-172` | `navigation.ts:59-75` | open question cites `navigation.ts:165-174` → `:67-71`. Footer is replaced from the **last** `## Next` to EOF |
| 4 | `navigation.ts:129, :111`; `adventureMap.ts:103` | `navigation.ts:27-34`, `:13`; `:103` correct | omits the empty-title case (`Act N —  · planned`) |
| 5 | `resume.ts:204-205`; `awards.ts:150,154-155`; `ledger.ts:29,34,56,64`; `adventureMap.ts:129,132-142,248,252,262` | `resume.ts:20-21`; `awards.ts:75,79-80`; ledger and map refs correct | — |
| 6 | `awards.ts:100-103,150,155` | `awards.ts:26-28,75,80` | — |
| 7 | `ledger.ts:36-38` | correct | — |
| 8 | `story.ts:92-114` | `story.ts:92-126` (regex `:93`) | — |
| 9 | `story.ts:115-117,128-132` | correct | — |
| 10 | `story.ts:75-81,137-143`; `ledger.ts:33`; `awards.ts:128` | `awards.ts:128` → `awards.ts:53`; others correct | misses the `optionalMax` sums `max` (a count) as XP (`ledger.ts:46`) |
| 11 | `index.ts:6`; `schema.ts:227,253,276-285`; `story.ts:8-9,14-17` | `schema.ts:11,36-37,58-62,86-93`; `story.ts:8-10,13-18` | misses `bench` (accepted, unused) and the story-data gate (`schema.ts:36`) |
| 12 | `schema.ts:234-242,254` | `schema.ts:18-26,38` | applies to story notes only (gate `:36`), mission notes included |
| 13 | `resume.ts:208-211`; `ledger.ts:67-70`; `awards.ts:103` | `resume.ts:24-27`; ledger correct; `awards.ts:26-28` | **wrong claim**: the awards region is inserted only into notes that have awards (empty content never inserts, `regions.ts:42`), not "every sequence note" |
| 14 | `adventureMap.ts:51,298` | correct | — |
| 15 | `adventureMap.ts:22-31,187,236,275` | `:20-32` (consts), rest correct | misses IF cards stacking at one position, label/XP overlap |
| 16 | `story.ts:145` | correct | ledger `÷ <party>` is unformatted (`ledger.ts:34`) |
| 17 | `cli/main.ts:25-30`; `plugin/main.ts:19-21` | `cli/main.ts:25-47`; `plugin/main.ts:19-25` | misses CLI/plugin divergence: CLI reads `templates.json` even with Templates disabled; CLI skips `node_modules`, plugin does not |
| "not affected" | `navigation.ts:111,147` | `navigation.ts:13,49` | `index.ts:94-97` correct |
| note | "test-vault is untracked" | — | stale: `test-vault/` is committed and parity is clean |

Missing rows (hard-coded conventions the issue does not list):

1. Story-data gate: `kind` + `mission` both needed for validation (`schema.ts:36`).
2. Hand-off = the **last map-order beat's** `next` (`adventureMap.ts:267-268`), which may be an optional side beat.
3. `entry` labels the edge into a beat only when that beat's `prev` points back (`adventureMap.ts:153`).
4. Act group status comes from the act note's own `beat-status`, not its beats (`adventureMap.ts:102`).
5. Navigation drops a frontmatter link's `|alias` (`navigation.ts:31-33`).
6. Resume marker text "the first planned beat after the furthest one played" is wrong when resume is a `partial` beat (`adventureMap.ts:129`), as in the test vault.
7. Running totals count only `planned` beats, and act notes with awards (`awards.ts:50-51`); ledger `earned` counts every status (`ledger.ts:26-49`).
8. Different tie-break between `sequence()` (code-unit path order) and the map (`localeCompare`) (`story.ts:17`, `adventureMap.ts:55`).
9. Map identity by basename (`adventureMap.ts:62`).
10. Canvas output format (tabs) and `toEnd` omission (`canvas.ts:31`, `adventureMap.ts:81`).

## 12. Vault-specific traces in comments and messages

| Text | Where |
|---|---|
| `the same table as the vault's xp-budget.py` | `story.ts:74` |
| `the shape the vault's maps already have` | `canvas.ts:30` |
| `a beat's run-sheet symbol (▶ ◆ ⚔ ⚙)` | `navigation.ts:13` |
| `the Story Beat template's placeholder` | `navigation.ts:49` |
| `the Linter never re-pads it` (assumes the Linter plugin) | `ledger.ts:10` |
| error text `end the Trigger / Lands when paragraph with ` ^card`` (user-facing) | `adventureMap.ts:61` |

## 13. Test-vault coverage gaps (paths parity does not guard)

Not exercised by `test-vault/`:

- kinds `beat` (only in `Templates/`), `reference`, `bench`
- `beat-status: skipped`; `related` / `--threads`
- award `note`; multiple story awards on one note (the ` (<xp>)` suffix); a level crossing (`LEVEL N` text)
- a mission without `party-size` or `party-xp`; a mission whose H1 differs from its basename
- a beat with 0 or 2 `^card`; an outcome without `if` or `to`; a short (bottom→top) labelled branch
- hand-added canvas items; CRLF notes; an act with no act note
- the "Mission complete" callout; the Encounter-line mismatch warning
