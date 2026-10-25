# q03 asset: Obsidian view API for a data-model view

Research for wayfinding ticket q03, "Obsidian view API". Question: what the Obsidian plugin API offers for a view that shows the data model (custom views, settings tabs, modals), and how such a view refreshes when notes change. Target: a read-only first plugin UI that dumps the model config's element definitions (Mission / Act / Beat), the notes matching each, derived values and build problems. Editing comes later.

All web sources were accessed on 2026-10-25. `d.ts:N` means `node_modules/obsidian/obsidian.d.ts` line N (package `obsidian@1.14.4`).

Each claim carries one of three tags:

- **[D]** documented, either in `obsidian.d.ts` or on docs.obsidian.md;
- **[I]** inferred, by reasoning from [D] and Taleform's code;
- **[P]** needs a live probe in a running Obsidian.

## 0. Baseline: Taleform today

| Fact | Source |
|---|---|
| Plugin registers a status-bar item, the commands `build`, `check` and `toggle-auto-build`, and a `metadataCache.on("changed")` listener (`.md` only, inside `onLayoutReady`) debounced 1500 ms with `resetTimer=true` | `src/plugin/main.ts` |
| Settings live in `prefs` (`{autoBuild}`), saved with `saveData`. They are not on `this.settings`, because `settings` clashes with the Plugin base | `src/plugin/main.ts`, `CLAUDE.md` |
| `run(options, write, loud)` returns `BuildResult {changes, problems, written}` and serialises runs through `this.running` | `src/plugin/main.ts` |
| `minAppVersion` is `1.10.3` | `manifest.json` |
| The installed `obsidian` is `1.14.4`, which `npm view obsidian version` confirms is the latest (published 2026-10-08) | `node_modules/obsidian/package.json`, npm registry |
| No UI framework is in `devDependencies`. The bundle is esbuild only | `package.json` |

## 1. Custom views: `registerView` / `ItemView` / `WorkspaceLeaf`

### Signatures [D]

| API | Signature | d.ts |
|---|---|---|
| Register | `registerView(type: string, viewCreator: ViewCreator): void` | 7219 |
| Factory | `type ViewCreator = (leaf: WorkspaceLeaf) => View` | 10605 |
| Base | `abstract class View extends Component` with fields `app`, `icon`, `navigation: boolean`, `leaf`, `containerEl`, `scope` | 10460–10507 |
| Lifecycle | `protected onOpen(): Promise<void>`, `protected onClose(): Promise<void>` | 10520, 10526 |
| Identity | `abstract getViewType(): string`, `abstract getDisplayText(): string`, `getIcon(): IconName` | 10532, 10587, 10575 |
| State | `getState(): Record<string, unknown>`, `setState(state: unknown, result: ViewStateResult): Promise<void>` | 10538, 10556 |
| Ephemeral state | `getEphemeralState()` / `setEphemeralState(state)` | after 10556 |
| Pane menu | `onPaneMenu(menu: Menu, source: 'more-options' \| 'tab-header' \| string)` | ~10597 |
| Item view | `abstract class ItemView extends View { contentEl: HTMLElement; addAction(icon, title, callback): HTMLElement }` | 5391–5419 |
| `navigation` | "If your view is a static view that is not intended to be navigated away, set this to false. (For example: File explorer, calendar, etc.)" | 10474–10483 |

### Leaves and placement [D]

| API | Signature / note | d.ts |
|---|---|---|
| Right sidebar | `getRightLeaf(split: boolean): WorkspaceLeaf \| null` | 10919 |
| Left sidebar | `getLeftLeaf(split: boolean): WorkspaceLeaf \| null` | 10912 |
| Get or create a side leaf | `ensureSideLeaf(type: string, side: Side, options?: {active?, split?, reveal?, state?}): Promise<WorkspaceLeaf>` (since 1.7.2) | 10928 |
| `Side` | `'primary' \| 'secondary' \| 'left' \| 'right'` | 9382 |
| Main area | `getLeaf(newLeaf?: PaneType \| boolean)` / `getLeaf('split', direction)` | 10815, 10830 |
| Find existing | `getLeavesOfType(viewType: string): WorkspaceLeaf[]` | 10976 |
| Reveal | `revealLeaf(leaf): Promise<void>`. "If the leaf is in a sidedock, the sidedock will be uncollapsed. `await` this function to ensure your view has been fully loaded and is not deferred." (since 1.7.2) | 10992 |
| Detach | `detachLeavesOfType(viewType: string): void` | 10983 |
| Set the view on a leaf | `leaf.setViewState(viewState: ViewState, eState?)`, where `ViewState = {type, state?, active?, pinned?, group?}` | 11253, 10611 |
| Deferred | `get isDeferred(): boolean`; `loadIfDeferred(): Promise<void>` (since 1.7.2) | 11261, 11267 |
| Active view | `getActiveViewOfType<T extends View>(type: Constructor<T>): T \| null`. `activeLeaf` is `@deprecated` ("discouraged") | 10946, 10698 |
| Plugin first-enable hook | `onUserEnable(): void`: "If your plugin registers a custom view, you can open it here." (since 1.7.2) | 7356 |

### Documented guidance [D]

- **Pattern.** The `activateView` example takes the first `getLeavesOfType(TYPE)` leaf if one exists. Otherwise it calls `getRightLeaf(false)` and then `await leaf.setViewState({type, active: true})`, and finally `workspace.revealLeaf(leaf)` "in case it is in a collapsed sidebar". Source: https://docs.obsidian.md/Plugins/User+interface/Views
- **No view references.** "Never manage references to views in your plugin", because "Obsidian may call the view factory function multiple times". Source: https://docs.obsidian.md/Plugins/User+interface/Views
  - Reach instances through `getLeavesOfType()` with a `leaf.view instanceof MyView` check.
  - The guidelines add: "Managing references to custom view can cause memory leaks or unintended consequences." Source: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- **Don't detach leaves in `onunload`.** "When the user updates your plugin, any open leaves will be reinitialized at their original position." Source: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- **Deferred views (1.7.2+).** At load, "all views are created as instances of DeferredView", and each is swapped for the real view once it is visible. Source: https://docs.obsidian.md/plugins/guides/defer-views
  - Do an `instanceof` check before using `leaf.view`, and `await revealLeaf` before talking to a view.
  - `loadIfDeferred` "remov[es] this performance optimization … Use this *sparingly*", guarded by `requireApiVersion('1.7.2')` (d.ts 7964).
  - The changelog announcing it is in `node_modules/obsidian/CHANGELOG.md` § v1.7.2.
- **Load time.** Register views in `onload`, but keep view constructors cheap: "If your view is loaded (and not deferred), this will directly impact the app load time." Source: https://docs.obsidian.md/plugins/guides/load-time

### State persistence [D] / [I]

- [D] `getState()` / `setState()` round-trip through `ViewState.state`, which Obsidian saves with the workspace layout. `result.history = true` records a navigation-history entry (d.ts 10542–10556).
- [I] For a model view, the state worth persisting is UI-only: the selected element type, the expanded sections, and maybe a mission filter. The model itself is always re-derived and never persisted in view state.
- [P] Whether a sidebar leaf with a restored `state` is deferred at startup, and so whether `setState` runs before `onOpen` or only after reveal.

## 2. Settings tab and `Setting`

### Signatures [D]

| API | Signature / note | d.ts |
|---|---|---|
| Register | `addSettingTab(settingTab: PluginSettingTab): void` | 7205 |
| Class | `abstract class PluginSettingTab extends SettingTab`, `constructor(app, plugin)` | 7431 |
| Declarative (new) | `getSettingDefinitions(): SettingDefinitionItem[]` (since 1.13.0). It is "called on every display() and once when the tab is added … for search indexing" | 9238–9246 |
| Imperative (deprecated) | `display(): void` is `@deprecated Since 1.13.0. Use getSettingDefinitions instead.` It is "Not called when getSettingDefinitions returns a non-empty array" | 9290–9303 |
| Value binding | `PluginSettingTab.getControlValue(key)` "Reads from `this.plugin.settings`"; `setControlValue(key, value)` "Mutates and persists `this.plugin.settings`" | 7445–7460 |
| Refresh | `update()` re-runs the definitions; `refreshDomState()` re-evaluates `visible` / `disabled` cheaply | 9247–9290 |
| Definition kinds | `SettingDefinition = Control \| Render \| Action \| Empty`; `SettingDefinitionItem = SettingDefinition \| Group \| List \| Page` | 8573, 8792 |
| Controls | toggle, dropdown, text, textarea, number, file, folder, slider, color, secret | 8519 |
| Custom row | `SettingDefinitionRender.render: (setting: Setting, group: SettingGroup) => void \| (() => void)`, which may return a cleanup function | 8911 |
| Sub-page | `SettingDefinitionPage {type:'page', name, items? \| page?, displayValue?, status?: 'warning'}` | 8847 |
| Mutable list | `SettingDefinitionList {type:'list', onReorder?, onDelete?, addItem?, emptyState?}` | 8802 |
| Group search | `SettingDefinitionGroup.search {placeholder?, match}` (since 1.13.1) | ~8745 |
| Imperative row | `class Setting` with `setHeading()`; `class SettingGroup` (1.11.0) | 8209, 8324, 9011 |
| Tab icon | `SettingTab.icon: IconName` (1.11.0) | 9218 |
| Sync reload | `onExternalSettingsChange?()`, called when `data.json` changes on disk (1.5.7) | 7367 |

### Documented guidance [D]

Source: https://docs.obsidian.md/Plugins/User+interface/Settings

- The declarative API requires 1.13.0. `display()` remains supported for older versions, through a dual-support pattern.
- Keep `getSettingDefinitions()` lightweight, since it runs on every update.
- A `control` key maps to `this.plugin.settings`, and "Obsidian reads the current value, writes changes back, and calls `saveData()` automatically". For other storage, override `getControlValue` / `setControlValue`.
- `render` callbacks do not auto-save.
- Use no top-level heading, and do not put the word "settings" in headings.

### Implications for Taleform [I]

- **The `prefs` naming collides with the declarative default.** `PluginSettingTab` binds to `this.plugin.settings`, but Taleform deliberately uses `prefs`. Any declarative tab must override `getControlValue` / `setControlValue` to read and write `prefs` and to call `saveData(this.prefs)`.
- **The version floor.** `minAppVersion` is `1.10.3`, so `getSettingDefinitions` needs either a bump to `1.13.0` or a `display()` fallback.
- **Fit.** A settings tab suits *preferences* (`autoBuild`, maybe a model-config path). It is a poor host for a live data dump. It is modal, it closes when the DM goes back to notes, and it refreshes only when `update()` is called. A `page` sub-page with `status: 'warning'` could surface "N build problems" as a secondary entry point.

## 3. Modal

| API | Signature / note | d.ts |
|---|---|---|
| `class Modal` | Fields `app`, `scope`, `containerEl`, `modalEl`, `titleEl`, `contentEl`; methods `open()`, `close()`, `onOpen(): Promise<void> \| void`, `onClose()`, `setTitle()` | 6540–6620 |
| `ConfirmationModal` | Has a button row and auto-closes unless the handler returns truthy (since 1.13.0) | 3135 |
| `SuggestModal<T>` / `FuzzySuggestModal<T>` | Filterable pickers | 9571, 4935 |

[D] Extend `Modal`, open it with `new X(app).open()`, and return input through an `onSubmit` callback. `SuggestModal` shows a filterable list, and `FuzzySuggestModal` needs only `getItems` / `getItemText` / `onChooseItem`. Source: https://docs.obsidian.md/Plugins/User+interface/Modals. The settings docs also say to move complex multi-field input into a modal. Source: https://docs.obsidian.md/Plugins/User+interface/Settings

[I] **Fit.** Modals are transient and block the workspace, so they suit the *editing* phase, for example "edit this element definition" or "pick an element type". A `FuzzySuggestModal` over element types or notes is a cheap navigation aid. A modal is not a host for the persistent model dump.

## 4. Rendering

| Option | API | Notes |
|---|---|---|
| Plain DOM | `createEl<K>(tag, o?: DomElementInfo \| string, cb?)`, `createDiv`, `el.empty()` (d.ts 812, 824, 243); `setIcon(parent, iconId)` (8202) | [D] The guidelines say to avoid `innerHTML` / `outerHTML` / `insertAdjacentHTML` and to "use the DOM API or the Obsidian helper functions, such as createEl()". Source: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines |
| Markdown | `MarkdownRenderer.render(app, markdown, el, sourcePath, component): Promise<void>` (d.ts 6079). `renderMarkdown` is `@deprecated` (6069) | [D] `component` is "A parent component to manage the lifecycle of the rendered child components". `sourcePath` resolves relative internal links |
| React | `createRoot(this.contentEl)` in `onOpen`, `root.unmount()` in `onClose`, `AppContext` for `app` | [D] "you don't need to use a separate framework to build a plugin". Source: https://docs.obsidian.md/Plugins/Getting+started/Use+React+in+your+plugin |
| Svelte | `mount(Component, {target: this.contentEl, props})` in `onOpen`, `unmount` in `onClose` | [D] "a light-weight alternative … outputs optimized vanilla JavaScript", with no virtual DOM. No bundle figures are given. Source: https://docs.obsidian.md/Plugins/Getting+started/Use+Svelte+in+your+plugin |

### Inferences [I]

- **`MarkdownRenderer` component lifetime.** Passing the view (an `ItemView` is a `Component`) ties the rendered children (embeds, hover links, post-processors) to the view's lifetime. On a re-render, the old children stay loaded until the view closes. The safe pattern is to create a fresh `Component` per render, `addChild` it to the view, and `removeChild` / `unload` the previous one before calling `el.empty()`.
- **Markdown buys real Obsidian links.** Rendering `[[Note]]` through `MarkdownRenderer` yields clickable internal links and hover previews for free. Plain `createEl("a")` needs a manual `app.workspace.openLinkText(...)` click handler.
- **A framework is not needed for a read-only dump.** The dump is a few nested lists and tables, so plain `createEl` adds 0 KB. React adds roughly 40–50 KB min+gz to `main.js`; Svelte 5 adds a smaller runtime of a few KB. These sizes are general knowledge, not from Obsidian docs. Revisit a framework when editing arrives.

## 5. Refresh: events and cleanup

### Event sources [D]

| Event | Signature | Notes | d.ts |
|---|---|---|---|
| `metadataCache "changed"` | `(file: TFile, data: string, cache: CachedMetadata)` | "Called when a file has been indexed … Note: This is not called when a file is renamed … You must hook Vault.on('rename')" | 6508–6515 |
| `metadataCache "deleted"` | `(file: TFile, prevCache: CachedMetadata \| null)` | | ~6521 |
| `metadataCache "resolve"` | `(file: TFile)` | Fires after a file's links resolve | ~6527 |
| `metadataCache "resolved"` | `() => any` | "Called when all files have been resolved. This will be fired each time files get modified after the initial load." | 6533 |
| `vault "create"` | `(file: TAbstractFile)` | Fires for every existing file at vault load: "register your event handler inside Workspace.onLayoutReady" | 10429–10433 |
| `vault "modify"` / `"delete"` / `"rename"` | `(file)`; `rename(file, oldPath)` | | 10439–10451 |
| `workspace "active-leaf-change"` / `"file-open"` / `"layout-change"` | | Useful for a "current note" panel | 11034–11048 |
| Cleanup | `Component.registerEvent(eventRef)`, `register(cb)`, `registerDomEvent`, `registerInterval` | All detach on `unload()` | 3038–3083 |
| Debounce | `debounce(cb, timeout?, resetTimer?): Debouncer<T,V>`, where `Debouncer` has `cancel()` and `run()` | | 3451–3475 |

[D] Guidelines: "use methods like registerEvent() … to automatically clean up resources". Source: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines. Register `create` listeners inside `onLayoutReady`. Source: https://docs.obsidian.md/plugins/guides/load-time

### The recommended refresh design for Taleform [I]

- **The view should not listen to the vault itself.** Everything it shows already comes out of `run()`: the model config, member notes, derived values and `problems`. The cleanest trigger is "a build finished". Have the plugin hold the last `BuildResult` (plus the index or model it built from) and fire a plugin-level event. `Events` (d.ts 4264) can be subclassed or composed, or a simple listener set can be used.
- **The view subscribes in `onOpen`** through `this.registerEvent(...)` (a `View` is a `Component`), so the subscription detaches on close. There is one source of truth and no second debounce, and the view never shows a model that differs from what was built.
- **A gap: with `autoBuild` off, no build fires.** The view then needs either its own trigger (a read-only `run({}, false)` check pass on the same 1500 ms debounce of `metadataCache "changed"`) or a "Refresh" `addAction` button. A check pass changes nothing, so it is safe.
- **Renames.** `"changed"` skips renames, so the current auto-build misses a pure rename. Taleform membership is by link, not by folder, and Obsidian rewrites the links in other files on rename, which fires `"changed"` on those files. A refresh trigger should still add `vault.on("rename")`. This also affects today's auto-build.
- **`"resolved"` as a coarser trigger.** It fires once per settle after modifications, which could replace the hand-rolled debounce. Its timing relative to `"changed"` is a [P].
- **Re-render cost.** A full `empty()` and rebuild per update is fine for the test vault and for The Ashfall Seam (33 beats). The Bases guide recommends reusing DOM for large sets (section 6).

## 6. Bases as a host

### API [D]

| API | Signature / note | d.ts |
|---|---|---|
| Register | `registerBasesView(viewId: string, registration: BasesViewRegistration): boolean`, which "returns false if bases are not enabled in this vault" (since 1.10.0) | 7283 |
| Registration | `{name, icon, factory: BasesViewFactory, options?: (config) => BasesAllOptions[]}` | 2203 |
| Factory | `(controller: QueryController, containerEl: HTMLElement) => BasesView` | 2196 |
| View | `abstract class BasesView extends Component`, with `type`, `app`, `config: BasesViewConfig`, `allProperties`, `data: BasesQueryResult`, `abstract onDataUpdated(): void`, and `createFileForView(...)` (1.10.2) | 2054–2105 |
| `data` | "replaced with a new result set when changes to the vault or Bases config occur, so views should not keep a reference to it" | 2085–2091 |
| Result | `BasesQueryResult.data: BasesEntry[]`, `groupedData: BasesEntryGroup[]`, `properties` | 1920–1945 |
| Entry | `BasesEntry.file: TFile`, `getValue(propertyId): Value \| null` | 1636 |
| Config | `get(key)`, `getAsPropertyId`, `getEvaluatedFormula(view, key)`, `set`, `getOrder`, `getSort`, `getDisplayName` | 2115–2185 |
| `QueryController` | `export class QueryController extends Component { }`, an **empty public surface**. The `setQuery` / `runQuery` that `CLAUDE.md` lists are not in the typings | 7643 |

[D] Sources: https://docs.obsidian.md/plugins/guides/bases-view and https://docs.obsidian.md/Reference/TypeScript+API/BasesView/onDataUpdated

- The guide's workflow: the DM creates a `.base` file and switches its layout to the plugin's view.
- `onDataUpdated` is "called by Obsidian whenever there is a configuration or data change in the vault".
- "An unfiltered Base will provide an entry for every file in the vault". The guide's `empty()` on every update is a simplification, and real views should reuse DOM.
- Views implement `HoverParent` for link previews.

### Fit for the model dump [I]

| Aspect | `ItemView` | `BasesView` |
|---|---|---|
| Who opens it | A Taleform command or ribbon icon, with no DM setup | The DM must author a `.base` file and pick the view |
| Data shape | Anything: element definitions, members, derived values, problems | Rows are *files* matching the base's filter, with properties and formulas |
| Element *definitions* (the model config) | Natural | Not rows. They would have to be injected from the plugin, which bypasses Bases |
| Build problems / derived values | From `BuildResult` | Not available. Bases formulas can recompute some sums (as `CLAUDE.md` notes for `awards`), but not Taleform's derivations |
| Refresh | Taleform drives it (section 5) | Free: `onDataUpdated` on any vault or config change |
| Availability | Always | `false` if the Bases core plugin is disabled |
| API stability | Long-standing (0.9.7) | 1.10.0+, with `QueryController` undocumented |

**Verdict [I].** Bases is not a better host for the *whole* model dump: the element definitions and build problems are not file rows. It *is* a good host for a later per-type table, such as "all notes of type Beat with their derived XP". That direction also matches the parked roadmap item "Bases is our Postgres". The two can coexist: one `ItemView` for the model, plus an optional `registerBasesView("taleform-…")` that renders Taleform-derived columns for the rows the DM's base selects.

## 7. Versions, new and deprecated APIs

| Item | Status | Source |
|---|---|---|
| `obsidian` npm | Installed `1.14.4` = latest (2026-10-08). Previous: 1.13.1 (2026-06-09), 1.13.0 (2026-05-28) | npm registry; `node_modules/obsidian/package.json` |
| `minAppVersion` | `1.10.3`: covers `registerView`, deferred views and Bases views; does *not* cover `getSettingDefinitions` / `ConfirmationModal` (1.13.0) | `manifest.json` |
| `SettingTab.display()` | `@deprecated Since 1.13.0` | d.ts 9300 |
| `MarkdownRenderer.renderMarkdown` | `@deprecated`, use `render(app, …)` | d.ts 6066 |
| `Workspace.activeLeaf` | `@deprecated`, use `getActiveViewOfType` | d.ts 10698 |
| `getLeaf` legacy overloads (`splitActiveLeaf`, `createLeafInParent` forms) | `@deprecated` | d.ts 10778–10877 |
| New in 1.7.2 | `ensureSideLeaf`, `revealLeaf` now async, `isDeferred` / `loadIfDeferred`, `onUserEnable`, `removeCommand` | `node_modules/obsidian/CHANGELOG.md` |
| New in 1.11.0 | `SettingGroup`, `SettingTab.icon` | d.ts 9011, 9218 |
| New in 1.13.x | Declarative settings (`getSettingDefinitions`, `SettingDefinition*`), `ConfirmationModal`, group search (1.13.1) | d.ts 8573–9030, 3135 |

## 8. Recommended shape for the first model view [I]

1. Add a `TaleformModelView extends ItemView` with `navigation = false`, an icon, and `getDisplayText() = "Taleform model"`, plus an `addAction("refresh-cw", …)` button.
2. Call `registerView` in `onload`. Add an "Open model view" command (no default hotkey, per the guidelines) that uses `ensureSideLeaf(TYPE, "right", {active: true})` or the documented `getLeavesOfType` → `getRightLeaf` → `revealLeaf` pattern. Do not detach the leaf in `onunload`.
3. Have the plugin keep `lastResult` and emit "built" after every `run()`. The view subscribes with `this.registerEvent` in `onOpen` and re-renders. If no build has run yet, the view triggers a `run({}, false)` check.
4. Render with plain `createEl`. Use `MarkdownRenderer.render` only for note links, with a per-render child `Component`.
5. Leave the settings tab and modals for the editing phase. Bases is a separate, optional view later.

## 9. Needs a live probe [P]

| # | Behaviour | Why it matters |
|---|---|---|
| P1 | Event order and counts for one frontmatter edit: `vault "modify"` → `metadataCache "changed"` → `"resolve"` → `"resolved"` | Choosing the refresh trigger, and whether `"resolved"` can replace the 1500 ms debounce |
| P2 | Whether Taleform's own build writes re-fire `"changed"` / `"resolved"` and cause a second view render (and whether one extra render is harmless) | Avoiding refresh loops or flicker |
| P3 | Whether a sidebar model view restored at startup is a `DeferredView` until it is revealed, and when `onOpen` / `setState` run | Avoids rendering against a deferred leaf, and controls startup cost |
| P4 | Whether a rename fires `"changed"` on the files whose links Obsidian rewrote, and on the renamed file itself | Validates the rename gap in section 5 |
| P5 | Whether `.canvas` files fire `metadataCache "changed"` (the current filter is `.md` only) | Whether a canvas-only edit should refresh the view |
| P6 | `MarkdownRenderer.render` child leak: count the components or hover handlers after N re-renders with and without a per-render child `Component` | Validates the lifetime pattern in section 4 |
| P7 | `registerBasesView` when Bases is disabled (returns `false`), and `onDataUpdated` frequency during typing in a property | Bases-host viability and cost |
| P8 | The `QueryController` undocumented `setQuery` / `runQuery` (listed in `CLAUDE.md`) still exist at runtime in 1.14.x | The typings show an empty class (d.ts 7643) |
| P9 | `getSettingDefinitions` with overridden `getControlValue` / `setControlValue` bound to `prefs`, under `minAppVersion` < 1.13 with a `display()` fallback | The settings-tab path |
| P10 | Mobile: a right-sidebar `ItemView` renders and refreshes (the manifest has `isDesktopOnly: false`; the status bar does not exist on mobile, per d.ts ~7170) | The view may be the only status surface on mobile |
