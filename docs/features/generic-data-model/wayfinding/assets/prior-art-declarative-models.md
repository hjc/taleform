# Prior art: declarative models

Ticket: q02 "Prior art for declarative models". Question: how do declarative systems let users declare types, compose and extend them, and compute derived values, and which choices fit a YAML-first model config for Obsidian notes?

Accessed 2026-10-25. Each row cites one URL. Tags: **[doc]** = the source states it; **[inf]** = my inference; **[known]** = prior knowledge, URL not re-fetched this session (verify before relying on it).

## 1. Summary matrix

| System | Type declaration | Extension / composition | Derived values | Defaults and overrides | Validation |
|---|---|---|---|---|---|
| Terraform / HCL | `variable` blocks with `type = object({...})` | modules called with arguments; `for_each` stamps instances | `locals` = named expressions; ~100 built-in functions | `default`, then a fixed precedence chain (tfvars, `-var`) | `validation`/`precondition` = errors; `check` = warnings |
| CUE | types are values; `#Def` = closed struct | unification (`&`), embedding; order-independent | expressions and comprehensions inside the same value | `*default` in a disjunction; any concrete value wins | conflict = bottom (`_|_`), "field not allowed" |
| JSON Schema + yaml-language-server | `type`, `properties`, `$ref` | `allOf`/`anyOf`/`oneOf`; not OO inheritance | none (validation only) | `default` is an annotation only | editor diagnostics, completion, hover |
| Kubernetes CRD | OpenAPI v3 structural schema in YAML | Kustomize base + overlay patches | none; CEL used only for validation | schema `default:` applied on read | `x-kubernetes-validations` CEL `rule` + `message` |
| Pkl | classes with constrained types `Int(isBetween(0,1023))` | `amends` (same type, override only) vs `extends` (subclass, `open` only) | late-bound properties, spreadsheet-like | class defaults; `default` for listing entries | type and constraint errors at eval |
| Jsonnet | untyped objects | `+` composition, `+:` deep merge, mixins as values | late-bound `self`, `super` | right-hand side wins | runtime errors only |
| Obsidian Bases `.base` | none of its own; reads property types | none between bases | `formulas:` map of name → expression string; formulas can call formulas | n/a | invalid formula → null value |
| Obsidian properties | one type per property name, vault-wide (`types.json`) | none | none | n/a | type mismatch shown in UI |
| Metadata Menu / Fileclass | fileClass = a note whose frontmatter lists `fields` | `extends` + `excludes`; same-name field overrides | Formula (JS), Lookup (Dataview query + Sum/Count/Avg/...) | per-field settings | required/missing/wrong-type flags |
| mdbase spec | type file = Markdown + frontmatter holding JSON Schema 2020-12 | multiple matching types merge constraints | CEL for filters/order/projections | JSON Schema `default` | conformance profiles |

## 2. Per-system notes

### 2.1 Terraform / HCL

| Claim | Tag | Source |
|---|---|---|
| A `variable` declares `type`, `description`, `default`; without a default Terraform prompts for a value | [doc] | https://developer.hashicorp.com/terraform/language/values/variables |
| `validation { condition, error_message }` runs before plan; failure stops the operation | [doc] | https://developer.hashicorp.com/terraform/language/expressions/custom-conditions |
| `check` blocks with `assert` produce warnings, never block | [doc] | https://developer.hashicorp.com/terraform/language/expressions/custom-conditions |
| Override precedence: `-var`/`-var-file` > `*.auto.tfvars` (lexical) > `terraform.tfvars.json` > `terraform.tfvars` > `TF_VAR_` env > `default` | [doc] | https://developer.hashicorp.com/terraform/language/values/variables |
| `optional(type, default)` inside `object({...})` substitutes the default when the attribute is missing or null | [doc] | https://developer.hashicorp.com/terraform/language/expressions/type-constraints |
| `locals` name any expression, referenced as `local.<name>`, module-scoped; docs warn they "obscure where values originate" | [doc] | https://developer.hashicorp.com/terraform/language/values/locals |
| Modules are the composition unit (call with arguments, read outputs); `for_each` creates one instance per map/set key | [known] | https://developer.hashicorp.com/terraform/language/meta-arguments/for_each |
| No inheritance: composition is by calling, not by extending | [inf] | — |

Fit: the error/warning split (validation vs `check`) maps directly onto Taleform's `problems` (errors) and warnings. The precedence chain is a clean model for "shipped default < vault config < CLI flag".

### 2.2 CUE

| Claim | Tag | Source |
|---|---|---|
| A field may be declared many times if the values do not conflict; structs and lists unify recursively | [doc] | https://cuelang.org/docs/tour/basics/unification/ |
| A default is a disjunct marked `*`, used only when no concrete value is given: `#def: string \| int \| *1`; `#def & 42` → `42` | [doc] | https://cuelang.org/docs/tour/types/defaults/ |
| Closed structs (usually from `#Definitions`) reject unknown fields: `b: _\|_ // field not allowed` | [doc] | https://cuelang.org/docs/tour/types/closed/ |
| Unification is commutative and order-independent, so layers can be merged in any order | [known] | https://cuelang.org/docs/tour/basics/order-irrelevance/ |

Fit [inf]: "a DM override is just another layer unified onto the default" is elegant, but unification forbids changing a concrete value. A DM cannot replace `xp: 50` with `xp: 75` without the default marking it `*50`. Taleform's users expect override, not conflict. Borrow `*default` and closed-by-default; don't adopt pure unification.

### 2.3 JSON Schema + YAML editor tooling

| Claim | Tag | Source |
|---|---|---|
| `allOf` = valid against all subschemas; it "can not be used to 'extend' a schema … in the sense of object-oriented inheritance" | [doc] | https://json-schema.org/understanding-json-schema/reference/combining |
| `additionalProperties: false` cannot see properties from `allOf` siblings; `unevaluatedProperties` (2019-09) fixes this | [doc] | https://json-schema.org/understanding-json-schema/reference/object |
| yaml-language-server modeline `# yaml-language-server: $schema=<url-or-path>`: relative to the file, highest priority, `$schema=none` disables | [doc] | https://github.com/redhat-developer/yaml-language-server |
| Supports draft-04, draft-07, 2019-09, 2020-12; gives validation, completion (fills defaults), hover; glob association via `yaml.schemas` | [doc] | https://github.com/redhat-developer/yaml-language-server |
| Docs don't say whether Markdown frontmatter is covered | [doc] | https://github.com/redhat-developer/yaml-language-server |

Fit [inf]: ship a JSON Schema for the **model-config file itself** (not for notes). The modeline gives a human in VS Code, and an LLM reading the file, completion and error checking at no cost. Don't use `allOf` as Taleform's composition model; resolve `extends` in Taleform and validate the flattened result.

### 2.4 Kubernetes CRDs + Kustomize

| Claim | Tag | Source |
|---|---|---|
| `apiextensions.k8s.io/v1` requires a structural OpenAPI v3 schema | [doc] | https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/ |
| `x-kubernetes-validations` holds CEL `rule` + `message` (or `messageExpression`), scoped to its schema node; `self` = the value | [doc] | https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/ |
| Schema `default:` is applied on request and on read, and is not written back to storage | [doc] | https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/ |
| CEL rules have a cost budget; unbounded lists are rejected ("add maxItems…") | [doc] | https://kubernetes.io/docs/tasks/extend-kubernetes/custom-resources/custom-resource-definitions/ |
| Kustomize patches are partial resources matched by name to base resources; prefer small single-purpose patches | [doc] | https://kubectl.docs.kubernetes.io/references/kustomize/kustomization/patchesstrategicmerge/ |
| Strategic merge merges lists by a merge key (default `name`), and `$patch: delete` removes an item | [known] | https://github.com/kubernetes/community/blob/master/contributors/devel/sig-api-machinery/strategic-merge-patch.md |

Fit [inf]: two strong precedents. (1) An expression string embedded as a YAML value with a sibling `message` is the proven way to put logic inside YAML schema. (2) Defaults applied on read and never written back match Invariant 1 (builders never write frontmatter). For overlays, **merge lists by a key** (`name`/`id`), with an explicit delete marker, so a DM can patch one field of one element type without restating it.

### 2.5 Pkl, Jsonnet, Dhall

| Claim | Tag | Source |
|---|---|---|
| Pkl `amends` keeps the same type and can only override existing properties, which catches typos; `extends` subclasses and needs `open` | [doc] | https://pkl-lang.org/main/current/language-reference/index.html |
| Pkl properties are late-bound: amending a source property updates its dependents, "similar to spreadsheet cells" | [doc] | https://pkl-lang.org/main/current/language-reference/index.html |
| Pkl renders to YAML/JSON | [doc] | https://pkl-lang.org/main/current/language-reference/index.html |
| Jsonnet: `+` composes (right wins), `+:` deep-merges a nested field or appends to a list, `::` hides fields, mixins are first-class values | [doc] | https://jsonnet.org/learning/tutorial.html |
| Dhall: a total (always-terminating), typed config language; no Turing-complete recursion | [known] | https://dhall-lang.org/ |

Fit [inf]: Pkl's `amends` vs `extends` split is the one to copy. A DM **amending** the shipped `Beat` (override only, so typos error) is a different act from **declaring a new type** that extends `Beat` (may add fields). Jsonnet's `+:` shows that "merge or replace?" must be explicit per key. Late binding means a derived value recomputes after an override; that is what Taleform's builders already do.

### 2.6 Obsidian Bases (`.base`) — the expression language

| Claim | Tag | Source |
|---|---|---|
| `.base` is YAML with optional top-level `filters`, `formulas`, `properties`, `summaries`, `views` | [doc] | https://obsidian.md/help/bases/syntax |
| Filters are a string expression or a tree of `and`/`or`/`not` lists | [doc] | https://obsidian.md/help/bases/syntax |
| `formulas:` maps name → expression string; formulas may reference other formulas (no cycles) | [doc] | https://obsidian.md/help/bases/syntax |
| Namespaces: `note.x` (or bare `x`), `file.x`, `formula.x`; `this` = the base, the embedding note, or the active note | [doc] | https://obsidian.md/help/bases/syntax |
| Top-level `summaries` take `values` (a column's values): `'values.mean().round(3)'`; built-ins include Sum, Average, Min, Max, Median | [doc] | https://obsidian.md/help/bases/syntax |
| Function set: global `if, min, max, number, list, link, date, duration, now, today, file, …`; String, Number, Date, List, Link, File, Object, RegExp methods | [doc] | https://obsidian.md/help/bases/functions |
| Lambdas: `filter`/`map` bind `value` and `index`; `reduce(acc + value, 0)` binds `acc` | [doc] | https://obsidian.md/help/bases/functions |
| No list `sum`/`mean` method in the formula function list; `min`/`max` take scalars, not lists | [doc] | https://obsidian.md/help/bases/functions |
| Semantics follow JavaScript; `number("x")` errors | [doc] | https://obsidian.md/help/bases/functions |
| Cross-note rollups are not built in; `link.asFile().properties.x` works (v1.9.7) but is slow and doesn't refresh when source notes change | [doc, forum] | https://forum.obsidian.md/t/bases-formula-cross-note-lookup-rollup/101990 |
| `file.links` / `file.backlinks` are file fields usable with `filter`/`map` over `asFile().properties` | [forum] | https://forum.obsidian.md/t/bases-list-all-backlinks-to-any-note-in-a-base/104827 |
| Plugin API: `BasesViewConfig.getEvaluatedFormula(view, key): Value` evaluates a config entry as a formula against the current Base; invalid → NullValue | [doc] | https://docs.obsidian.md/Reference/TypeScript+API/BasesViewConfig/getEvaluatedFormula |

**Is it a usable expression language?** [inf]

- **Yes, for per-note derivations:** arithmetic, conditionals, string building, and list `filter/map/reduce` cover `combatOf`-style sums over a note's own object lists. This matches the CLAUDE.md finding that `awards.filter(...).map(value.xp).reduce(acc + value, 0)` works.
- **Weak for graph aggregates** (sum of XP over all beats in a mission, running totals in sequence order). Possible through `asFile()`/backlinks, but not officially documented, with known refresh issues.
- **Not headless:** the only evaluator is inside Obsidian (`getEvaluatedFormula` needs a `BasesView`). The CLI would need its own parser/evaluator for the same syntax. That is a real cost, but the grammar is small and JS-like.
- **No type declarations:** Bases has no type system; it borrows property types.

### 2.7 Obsidian property types

| Claim | Tag | Source |
|---|---|---|
| Types: Text, List, Number, Checkbox, Date, Date & time, Tags | [doc] | https://obsidian.md/help/properties |
| One type per property **name**, vault-wide | [doc] | https://obsidian.md/help/properties |
| Nested properties are not supported in the Properties UI | [doc] | https://obsidian.md/help/properties |
| Stored in `.obsidian/types.json` as `{"types": {"name": "multitext", …}}`; only explicit assignments are written | [community] | https://www.dsebastien.net/the-complete-guide-to-obsidian-properties/ |

Fit [inf]: types are global per name, so `xp` cannot be a Number on Beat and a List on Mission. A Taleform model should treat field names as vault-global, or at least lint clashes. It could also *emit* `types.json` entries, but that is a write outside generated regions and needs a decision.

### 2.8 Metadata Menu / Fileclass / make.md / mdbase

| Claim | Tag | Source |
|---|---|---|
| A fileClass is a note (name = class) whose frontmatter has `fields:` (name, type, id, options) | [doc] | https://mdelobelle.github.io/metadatamenu/fileclasses/ |
| `extends: course` inherits fields; a same-named field overrides; `excludes: [grade]` drops inherited fields | [doc] | https://mdelobelle.github.io/metadatamenu/fileclasses/ |
| Multi-class conflicts resolve by binding priority: frontmatter `fileClass` > tags > paths > bookmarks > queries > global | [doc] | https://mdelobelle.github.io/metadatamenu/fileclasses/ |
| 22 field types incl. Formula (JS over `current` and `dv`) and Lookup (Dataview query; Sum/Count/Average/Max/Min, or custom JS); both write results **into the note** | [doc] | https://mdelobelle.github.io/metadatamenu/fields/ |
| Fileclass (successor, same author) drops Lookup/Formula, uses Bases views for reverse relations and computed columns, keeps `extends`/`excludes`, flags missing or wrong-type fields | [doc] | https://community.obsidian.md/plugins/fileclass |
| make.md "contexts": per-space properties (Text, Number, Date, Options, Yes/No, Link, Image) plus Aggregate/Relation/Formula as "advanced"; formula syntax not confirmed | [doc, thin] | https://www.make.md/docs/Getting%20Started/Lists%20and%20Databases/Contexts |
| mdbase spec v0.3.0: type files are Markdown with `kind: mdbase.type`, a `match: path_glob`, and a JSON Schema 2020-12; CEL for where/order/projections | [doc] | https://github.com/mdbase-dev/mdbase-spec |
| mdbase has an Obsidian Bases adapter: `formulas` → projections; translation to CEL "succeeds only when behavior is preserved", with diagnostics | [doc] | https://github.com/mdbase-dev/mdbase-spec/blob/main/adapters/obsidian-bases.md |

Fit [inf]:
- `extends` + `excludes` + override-by-name is the established Obsidian-community composition idiom, and the one DMs coming from Metadata Menu already know.
- Metadata Menu's Lookup writes computed values into frontmatter. That would break Invariant 1, and its successor dropped Lookup in favour of Bases. Taleform should keep derived values in generated regions.
- Bind a note to a type **explicitly** (a `kind:` property). Avoid folder/tag binding, which the developer calls "implicit wiring".
- mdbase is the closest prior art to the whole ticket: types as data in the vault, a portable expression language, a Bases adapter. Its choice of CEL over Bases syntax shows the tension: CEL is specified and headless, while Bases is what Obsidian users see.

## 3. Fit for Taleform

### (a) Composition model

| Option | Precedent | Pro | Con |
|---|---|---|---|
| A1 `extends` (single parent) + `excludes` + override-by-name | Metadata Menu, Fileclass, Pkl `extends` | familiar to Obsidian DMs; easy to diff; LLM-friendly | single inheritance; diamond cases need mixins |
| A2 Mixins / traits list (`uses: [HasXP, InSequence]`) merged left-to-right | Jsonnet mixins | reusable cross-cutting traits (sequence, XP) | merge order matters; harder to explain |
| A3 Unification | CUE | order-free, conflict-checked | can't override a concrete value; unfamiliar |

Leaning [inf]: A1, plus A2 for traits only if a real case appears (Beat and Encounter sharing "sequence member" suggests it might).

### (b) Expression language inside YAML

| Option | Precedent | Pro | Con |
|---|---|---|---|
| B1 Bases formula syntax as strings (`'awards.filter(value.type != "optional").map(value.xp).reduce(acc + value, 0)'`) | Bases `formulas:` | one language for DM and Bases; copy-paste into a `.base`; LLMs already see it | no headless evaluator: Taleform writes a parser; JS semantics; no list `sum` |
| B2 CEL | K8s CRDs, mdbase | specified, sandboxed, cost-bounded, JS implementations exist | a second dialect next to Bases |
| B3 No expressions: named built-in derivations (`derive: combat-xp`) with parameters | Terraform built-ins, today's code | simplest; type-safe | not extensible by a DM without TS |

Leaning [inf]: B3 for the shipped defaults, with B1 as the escape hatch for DM-defined fields. Restrict B1 to the Bases subset (no `html`/`icon`/`random`), and add the missing aggregates (`sum`, list `min`/`max`) as Taleform-only functions, flagged as such.

### (c) Layering a shipped default with DM overrides

| Option | Precedent | Pro | Con |
|---|---|---|---|
| C1 Precedence chain (built-in default < vault model file < CLI flag), deep-merge maps, lists merged by `name` key, explicit delete marker | Terraform tfvars, Kustomize strategic merge | predictable; a DM file stays small | needs a merge-key rule per list |
| C2 `amends` (override only, typo-checked) vs `extends` (new type) as separate verbs | Pkl | catches typos in overrides | two concepts to teach |
| C3 Eject: copy the full default into the vault and edit it | common practice | trivially understood | upgrades never reach the DM |

Leaning [inf]: C1 with C2's typo check. Unknown keys in an override of a shipped type are an error, and new fields need an explicit `fields:` add. Defaults apply on read and never touch frontmatter (K8s precedent, Invariant 1).

### (d) Aligning with Bases

- **D1:** Field types use Obsidian's property type names (`text`, `multitext`, `number`, `checkbox`, `date`, `datetime`), plus Taleform's `link` and object-list. One name per field, vault-wide [inf; https://obsidian.md/help/properties].
- **D2:** Expressions use Bases syntax and namespaces (`note.`, `file.`, `formula.`, `this`) [https://obsidian.md/help/bases/syntax].
- **D3:** Generate a `.base` per type from the model, as Fileclass does [https://community.obsidian.md/plugins/fileclass]. This makes the model visible in Obsidian, and it fits the parked "Bases is our Postgres" direction.
- **D4:** Validate the model file itself with a shipped JSON Schema plus a yaml-language-server modeline [https://github.com/redhat-developer/yaml-language-server].

## 4. Open questions surfaced

- Does Taleform write its own Bases-syntax evaluator for the CLI, or keep the CLI expression-free and let the plugin evaluate through `getEvaluatedFormula`? [inf]
- Graph aggregates (mission total XP, running totals) are outside what Bases formulas do reliably, so they likely stay built-in derivations. [inf; https://forum.obsidian.md/t/bases-formula-cross-note-lookup-rollup/101990]
- Should the model emit `types.json` entries? That is a write outside generated text, so it needs an invariant decision. [inf]
