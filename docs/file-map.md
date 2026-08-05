# File Map

Quick reference: every source file and its responsibility. Deeper explanations are
linked per area.

## Routes

| File                        | Responsibility                                                                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app.html`              | HTML shell + the no-flash theme **prepaint script** (runs before CSS/JS) ([Themes](themes.md#the-no-flash-prepaint-script-srcapphtml))                                                                                                               |
| `src/routes/+layout.svelte` | Registers GSAP plugins (lazy, `onMount`); starts the interaction-medium sensor (sync `onMount`)                                                                                                                                                      |
| `src/routes/+layout.ts`     | `export const prerender = true` — static output, no SSR                                                                                                                                                                                              |
| `src/routes/+page.svelte`   | Root shell: sets all 4 contexts, publishes `layoutMode` for its CSS grid + sidebar slide, owns the text→link arrow launch, `initAlignmentShortcuts`                                                                                                  |
| `src/routes/layout.css`     | Tailwind import, fonts, theme tokens (`--mapping-gap`, `--line-tool-*`), custom variants (`hocus`, `bottom-layout`, `modal-wide`, …), the shared `.fade-y` scroll fade (parameterized by `--fade-pad`), `--default-transition-timing-function: ease` |
| `src/routes/*.e2e.ts`       | Playwright e2e specs                                                                                                                                                                                                                                 |

## Tokenization & data (framework-free)

| File                           | Responsibility                                                                                                                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/tokenize.ts`          | `SourceToken` / `TargetToken` types; `tokenizeSource()`, `tokenizeTarget()`; `SOURCE_INPUT_RE` ([Tokenization](tokenization.md))                                                                                                                  |
| `src/lib/line.ts`              | `splitAfterToken()`, `mergeLines()` — pure generics over `T extends { line: number }` ([Line Tool](line-tool.md))                                                                                                                                 |
| `src/lib/tokenState.ts`        | `Mapping`, `MappingId`, `TokenState`, `QuoteExport*` types; `buildMappingIndex()`, `deriveSourceTokenState()`, `deriveTargetTokenState()`, `buildTargetText()` (+ `MAX_BRIDGE_GAP`); internal `findBridgeMapping()` ([Data Model](data-model.md)) |
| `src/lib/tokenPresentation.ts` | `tokenPresentation()` — shared per-token colour/opacity/weight → `{ style, opacityClass }` ([Tool Transitions](tool-transitions.md))                                                                                                              |
| `src/lib/pinyinConvert.ts`     | `toCanonical()` / `toDisplay()` + the 407-syllable table — numbered↔diacritic pinyin ([Link Tool](link-tool.md#pinyin-auto-fill-and-canonical-storage))                                                                                           |
| `src/lib/exportFormat.ts`      | `formatExport()` — column-aligned JSON pretty-printer ([Export](export.md))                                                                                                                                                                       |
| `src/lib/constants/colors.ts`  | `MAPPING_COLORS` (9 `{light,dark}` palettes), `MAPPING_COLOR_NAMES`, `colors` name-lookup, `HIGHLIGHT_COLOR`, `divisorColor()`, `MappingColor`/`MappingColorVariant` types                                                                        |
| `src/lib/types.ts`             | shared leaf types (`ThemeName`)                                                                                                                                                                                                                   |
| `src/lib/assets/icons.json`    | SVG icon path data — **proprietary, gitignored** ([Build & Deploy](build-and-deploy.md))                                                                                                                                                          |

## Contexts & stores

| File                                          | Responsibility                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/context/tool.svelte.ts`              | `ToolContext` — `current: 'text' \| 'link' \| 'line' \| 'view'`                                                                                                                                                                                                                  |
| `src/lib/context/breakpoints.svelte.ts`       | `BreakpointContext` — sole macro-layout classifier; reduces reactive wide / narrow / tall `MediaQuery` facts to `layoutMode: 'double' \| 'single' \| 'bottom' \| 'drawer'` ([UI Architecture](ui-architecture.md#responsive-layout))                                             |
| `src/lib/context/alignment.svelte.ts`         | `Alignment` — owns `mappings[]` + `activeMappingId` + `listAnimating`; derives tokens from the store; toggle handlers, canonical pinyin, `sortedMappingViews`, `exportData`; delegates view-tool highlight to `ViewHighlight`; exports `MappingView` ([Link Tool](link-tool.md)) |
| `src/lib/context/viewHighlight.svelte.ts`     | `ViewHighlight` — view-tool hover/tap highlight timer machine (cold/warm/grace) ([View Tool](view-tool.md))                                                                                                                                                                      |
| `src/lib/context/interactionMedium.svelte.ts` | Global `interactionMedium` singleton + `initInteractionMediumTracking()`; writes `html[data-interaction-medium]` ([Keyboard & Navigation](mediums-and-keyboard-navigation.md))                                                                                                   |
| `src/lib/context/tokenStore.svelte.ts`        | The **token store** — single owner of tokens, text-keyed cache, pinyin overlay, the line-edit animation; `TokenStore` / `TokenAccess` / `EditScope` types ([Token Store](token-store.md))                                                                                        |
| `src/lib/theme/themeState.ts`                 | Pure theme logic — storage shape, keys, `resolveStoredTheme()`/`resolveExternalThemeState()`/registry helpers ([Themes](themes.md))                                                                                                                                              |
| `src/lib/theme/systemTheme.ts`                | `adaptiveTheme()` — browser-connected theme runtime (localStorage, `BroadcastChannel`, heartbeat, `flashThemeTransition()`) ([Themes](themes.md))                                                                                                                                |
| `src/lib/theme/index.ts`                      | `theme` — the single shared `adaptiveTheme()` instance (consumers alias it `appTheme`) ([Themes](themes.md))                                                                                                                                                                     |

## Components

| File                                              | Responsibility                                                                                                                                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/QuoteWorkbench.svelte`        | The workbench: textareas (text tool), token grid (link/line/view), IME-filtered source input, builds `editScope()`, owns the nav instance                                                                        |
| `src/lib/components/InteractiveSourceText.svelte` | Source tokens; one DOM tree per tool; link-tool click; renders a `LineDivisor` between groups                                                                                                                    |
| `src/lib/components/InteractiveTargetText.svelte` | Target tokens; same structure; renders a `LineDivisor` for each whitespace/boundary token                                                                                                                        |
| `src/lib/components/LineDivisor.svelte`           | The **line divisor** — single owner of the split/merge affordance (split-zone · ws-split · merge-zone), its touch state machine, hover-spread wiring, and CSS; shared by both panels ([Line Tool](line-tool.md)) |
| `src/lib/components/Mapping.svelte`               | One mapping card (reads `MappingView` only); quantized grid sizing; light/dark `colorVariant` + `theme` object; delete button ([Themes](themes.md))                                                              |
| `src/lib/components/PinyinInput.svelte`           | Buffered pinyin editor — holds canonical input while focused, commits on blur ([Link Tool](link-tool.md#pinyin-auto-fill-and-canonical-storage))                                                                 |
| `src/lib/components/MappingsList.svelte`          | The `<ol>` of cards; GSAP Flip add/delete animations; `swipeToDelete`; `listAnimating`; responsive grid; active-card scroll; `handleListTab`; `use:listRef`; empty state ([Mappings List](mappings-list.md))     |
| `src/lib/components/JsonExportPanel.svelte`       | Derives `formatExport(exportData)`; feeds `HighlightedCode` the theme-aware palette `colorMap`                                                                                                                   |
| `src/lib/components/HighlightedCode.svelte`       | Generic Shiki highlighter; lazy-imports `shiki`; render-time `colorMap` prop                                                                                                                                     |
| `src/lib/components/DataPanel.svelte`             | Shared maps/json surface; picks `MappingsList` vs `JsonExportPanel`; `.fade-edges` mask                                                                                                                          |
| `src/lib/components/DataModal.svelte`             | Drawer-layout slide-in over the workbench; history/back integration; force-close on breakpoint exit                                                                                                              |
| `src/lib/components/ToolToolbar.svelte`           | Bottom toolbar: link/line/view switch + a maps/json pair outside `double`, routed to the modal only in `drawer`                                                                                                  |
| `src/lib/components/IconToggleButton.svelte`      | One reusable icon toggle button (collapses the former 6 near-duplicates); touch blur + `@media (hover:hover)`                                                                                                    |
| `src/lib/components/ThemeToggle.svelte`           | Orbiting moon/sun light–dark switch; reads/writes `theme.current`; Firefox repaint + hydration guards ([Themes](themes.md))                                                                                      |

## Actions

| File                                 | Responsibility                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/actions/autosize.ts`        | Svelte action keeping a textarea's height matched to its content (input + resize)                                                                                              |
| `src/lib/actions/longpress.ts`       | Svelte action firing `onlongpress` after N ms; mobile force-add on source tokens                                                                                               |
| `src/lib/actions/swipeToDelete.ts`   | Swipe-to-delete gesture state machine for mapping cards on touch ([Mappings List](mappings-list.md#swipe-to-delete-touch))                                                     |
| `src/lib/actions/redistribute.ts`    | `redistributeRow()` / `clearRedistribute()` — hover-spread of line-tool divisors via `--rd-x`; `computeRowOffsets()` is its pure, unit-tested core ([Line Tool](line-tool.md)) |
| `src/lib/actions/globalShortcuts.ts` | `initAlignmentShortcuts()` — document-level Delete/Backspace + click-to-deselect (panels matched by `data-zone`)                                                               |

## Navigation

| File                                        | Responsibility                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/navigation/gridDom.ts`             | The **token-grid DOM contract** — selector constants, `zoneSelector`/`tokenSelector`/`divisorSelector` builders, `getZone`, `tokenIndexOf`/`divisorIndexOf`; the single source readers import instead of hand-writing DOM strings (absorbed `constants/lineDivisor.ts`) |
| `src/lib/navigation/tokenGridNav.ts`        | `createTokenGridNav()` — token-grid keyboard contract for link + line tool (reads the DOM via `gridDom`)                                                                                                                                                                |
| `src/lib/navigation/visualNeighbor.ts`      | `pickVisualNeighbor()` — pure rect-based row/column math                                                                                                                                                                                                                |
| `src/lib/navigation/visualNeighbor.spec.ts` | Unit tests for `pickVisualNeighbor()`                                                                                                                                                                                                                                   |

## Tests

Unit specs run in one of two vitest projects, routed by filename —
`*.svelte.spec.ts` in the **client** project (jsdom, client Svelte runtime),
plain `*.spec.ts` in the **server** project (node). See [Testing](testing.md).

| File                                           | Project | Covers                                                                                                                   |
| ---------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/tokenize.spec.ts`                     | server  | Target tokenizer punctuation rules; source tokenizer; `groupSourceTokens` grouping                                       |
| `src/lib/line.spec.ts`                         | server  | `splitAfterToken`/`mergeLines` — immutability, line math, out-of-range throw                                             |
| `src/lib/pinyinConvert.spec.ts`                | server  | Canonical↔diacritic pinyin conversion                                                                                    |
| `src/lib/tokenState.spec.ts`                   | server  | Token-state derivation                                                                                                   |
| `src/lib/tokenPresentation.spec.ts`            | server  | Per-token colour/opacity/weight output                                                                                   |
| `src/lib/exportFormat.spec.ts`                 | server  | JSON pretty-printer                                                                                                      |
| `src/lib/theme/themeState.spec.ts`             | server  | Theme resolution / continuity logic                                                                                      |
| `src/lib/actions/redistribute.spec.ts`         | server  | Hover-spread offset math (`computeRowOffsets`)                                                                           |
| `src/lib/navigation/visualNeighbor.spec.ts`    | server  | Visual-neighbour math                                                                                                    |
| `src/lib/context/tokenStore.spec.ts`           | server  | Token store: text-keyed cache, pinyin overlay (`onMount` is a no-op under node)                                          |
| `src/lib/context/alignment.svelte.spec.ts`     | client  | `Alignment`: mapping lifecycle, toggle semantics, pinyin commit, export, highlight                                       |
| `src/lib/context/viewHighlight.svelte.spec.ts` | client  | `ViewHighlight` cold/warm/grace timers (fake timers)                                                                     |
| `src/routes/**/*.e2e.ts`                       | —       | Playwright end-to-end flows (incl. line-split overflow, rapid-click, theme lockstep, data-modal transition interruption) |
