# File Map

Quick reference: every source file and its responsibility. Deeper explanations are
linked per area.

## Routes

| File                        | Responsibility                                                                                                                               |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app.html`              | HTML shell + the no-flash theme **prepaint script** (runs before CSS/JS) ([Dark Mode](dark-mode.md#the-no-flash-prepaint-script-srcapphtml)) |
| `src/routes/+layout.svelte` | Registers GSAP plugins (lazy, `onMount`); starts the interaction-mode sensor (sync `onMount`)                                                |
| `src/routes/+layout.ts`     | `export const prerender = true` — static output, no SSR                                                                                      |
| `src/routes/+page.svelte`   | Root shell: sets all 4 contexts, the responsive grid + sidebar slide, the text→link arrow launch, `initAlignmentShortcuts`                   |
| `src/routes/layout.css`     | Tailwind import, fonts, theme tokens (`--mapping-gap`, `--line-tool-*`), custom variants (`hocus`, `tablet`, `modal-wide`, …)                |
| `src/routes/*.e2e.ts`       | Playwright e2e specs                                                                                                                         |

## Tokenization & data (framework-free)

| File                           | Responsibility                                                                                                                                                                                                               |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/tokenize.ts`          | `SourceToken` / `TargetToken` types; `tokenizeSource()`, `tokenizeTarget()`; `SOURCE_INPUT_RE` ([Tokenization](tokenization.md))                                                                                             |
| `src/lib/line.ts`              | `splitAfterToken()`, `mergeLines()` — pure generics over `T extends { line: number }` ([Line Mode](line-mode.md))                                                                                                            |
| `src/lib/tokenState.ts`        | `Mapping`, `MappingId`, `TokenState`, `QuoteExport*` types; `buildMappingIndex()`, `deriveSourceTokenState()`, `deriveTargetTokenState()`, `buildTargetText()`; internal `findBridgeMapping()` ([Data Model](data-model.md)) |
| `src/lib/tokenPresentation.ts` | `tokenPresentation()` — shared per-token colour/opacity/weight → `{ style, opacityClass }` ([Mode Transitions](mode-transitions.md))                                                                                         |
| `src/lib/pinyinConvert.ts`     | `toCanonical()` / `toDisplay()` + the 407-syllable table — numbered↔diacritic pinyin ([Link Mode](link-mode.md#pinyin-auto-fill-and-canonical-storage))                                                                      |
| `src/lib/exportFormat.ts`      | `formatExport()` — column-aligned JSON pretty-printer ([Export](export.md))                                                                                                                                                  |
| `src/lib/constants/colors.ts`  | `MAPPING_COLORS` (9 `{light,dark}` palettes), `MAPPING_COLOR_NAMES`, `colors` name-lookup, `HIGHLIGHT_COLOR`, `divisorColor()`, `MappingColor`/`MappingColorVariant` types                                                   |
| `src/lib/types.ts`             | shared leaf types (`ThemeMode`)                                                                                                                                                                                              |
| `src/lib/assets/icons.json`    | SVG icon path data — **proprietary, gitignored** ([Build & Deploy](build-and-deploy.md))                                                                                                                                     |

## Contexts & stores

| File                                        | Responsibility                                                                                                                                                                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/context/mode.svelte.ts`            | `ModeContext` — `current: 'text' \| 'link' \| 'line' \| 'view'`                                                                                                                                                                                                                  |
| `src/lib/context/breakpoints.svelte.ts`     | `BreakpointContext` — `wide` / `belowMedium` / `tabletPortrait` / derived `minimal`, via `matchMedia` ([UI Architecture](ui-architecture.md#responsive-layout))                                                                                                                  |
| `src/lib/context/alignment.svelte.ts`       | `Alignment` — owns `mappings[]` + `activeMappingId` + `listAnimating`; derives tokens from the store; toggle handlers, canonical pinyin, `sortedMappingViews`, `exportData`; delegates view-mode highlight to `ViewHighlight`; exports `MappingView` ([Link Mode](link-mode.md)) |
| `src/lib/context/viewHighlight.svelte.ts`   | `ViewHighlight` — view-mode hover/tap highlight timer machine (cold/warm/grace) ([View Mode](view-mode.md))                                                                                                                                                                      |
| `src/lib/context/interactionMode.svelte.ts` | Global `interactionMode` singleton + `initModeTracking()`; writes `html[data-interaction]` ([Keyboard & Navigation](keyboard-navigation.md))                                                                                                                                     |
| `src/lib/animation/tokenStore.svelte.ts`    | The **token store** — single owner of tokens, text-keyed cache, pinyin overlay, the line-edit animation; `TokenStore` / `TokenAccess` / `EditScope` types ([Token Store](token-store.md))                                                                                        |
| `src/lib/themeState.ts`                     | Pure theme logic — storage shape, keys, `resolveStoredTheme()`/`resolveExternalThemeState()`/registry helpers ([Dark Mode](dark-mode.md))                                                                                                                                        |
| `src/lib/systemTheme.ts`                    | `adaptiveTheme()` — browser-connected theme runtime (localStorage, `BroadcastChannel`, heartbeat, `flashThemeTransition()`) ([Dark Mode](dark-mode.md))                                                                                                                          |
| `src/lib/theme.ts`                          | `theme` — the single shared `adaptiveTheme()` instance (consumers alias it `appTheme`) ([Dark Mode](dark-mode.md))                                                                                                                                                               |

## Components

| File                                              | Responsibility                                                                                                                                                                                                   |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/QuoteWorkbench.svelte`        | The workbench: textareas (text mode), token grid (link/line/view), IME-filtered source input, builds `editScope()`, owns the nav instance                                                                        |
| `src/lib/components/InteractiveSourceText.svelte` | Source tokens; one DOM tree per mode; link-mode click; renders a `LineDivisor` between groups                                                                                                                    |
| `src/lib/components/InteractiveTargetText.svelte` | Target tokens; same structure; renders a `LineDivisor` for each whitespace/boundary token                                                                                                                        |
| `src/lib/components/LineDivisor.svelte`           | The **line divisor** — single owner of the split/merge affordance (split-zone · ws-split · merge-zone), its touch state machine, hover-spread wiring, and CSS; shared by both panels ([Line Mode](line-mode.md)) |
| `src/lib/components/Mapping.svelte`               | One mapping card (reads `MappingView` only); quantized grid sizing; light/dark `colorVariant` + `theme` object; delete button ([Dark Mode](dark-mode.md))                                                        |
| `src/lib/components/PinyinInput.svelte`           | Buffered pinyin editor — holds canonical input while focused, commits on blur ([Link Mode](link-mode.md#pinyin-auto-fill-and-canonical-storage))                                                                 |
| `src/lib/components/MappingsList.svelte`          | The `<ol>` of cards; GSAP Flip add/delete animations; `swipeToDelete`; `listAnimating`; responsive grid; active-card scroll; `handleListTab`; `use:listRef`; empty state ([Mappings List](mappings-list.md))     |
| `src/lib/components/JsonExportPanel.svelte`       | Derives `formatExport(exportData)`; feeds `HighlightedCode` the palette `colorReplacements`                                                                                                                      |
| `src/lib/components/HighlightedCode.svelte`       | Generic Shiki highlighter; lazy-imports `shiki`; `colorReplacements` prop                                                                                                                                        |
| `src/lib/components/DataPanel.svelte`             | Shared maps/json surface; picks `MappingsList` vs `JsonExportPanel`; `.fade-edges` mask                                                                                                                          |
| `src/lib/components/DataModal.svelte`             | Minimal-viewport slide-in over the workbench; history/back integration; force-close on breakpoint exit                                                                                                           |
| `src/lib/components/ModeToolbar.svelte`           | Bottom toolbar: link/line/view switch + two CSS-gated maps/json toggle pairs (aside vs modal)                                                                                                                    |
| `src/lib/components/IconToggleButton.svelte`      | One reusable icon toggle button (collapses the former 6 near-duplicates); touch blur + `@media (hover:hover)`                                                                                                    |
| `src/lib/components/ThemeToggle.svelte`           | Orbiting moon/sun light–dark switch; reads/writes `theme.current`; Firefox repaint + hydration guards ([Dark Mode](dark-mode.md))                                                                                |

## Actions

| File                                 | Responsibility                                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/actions/longpress.ts`       | Svelte action firing `onlongpress` after N ms; mobile force-add on source tokens                                                                                               |
| `src/lib/actions/swipeToDelete.ts`   | Swipe-to-delete gesture state machine for mapping cards on touch ([Mappings List](mappings-list.md#swipe-to-delete-touch))                                                     |
| `src/lib/actions/redistribute.ts`    | `redistributeRow()` / `clearRedistribute()` — hover-spread of line-mode divisors via `--rd-x`; `computeRowOffsets()` is its pure, unit-tested core ([Line Mode](line-mode.md)) |
| `src/lib/actions/globalShortcuts.ts` | `initAlignmentShortcuts()` — document-level Delete/Backspace + click-to-deselect (panels matched by `data-zone`)                                                               |

## Navigation

| File                                        | Responsibility                                                                                                                                                                                                                                                          |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/navigation/gridDom.ts`             | The **token-grid DOM contract** — selector constants, `zoneSelector`/`tokenSelector`/`divisorSelector` builders, `getZone`, `tokenIndexOf`/`divisorIndexOf`; the single source readers import instead of hand-writing DOM strings (absorbed `constants/lineDivisor.ts`) |
| `src/lib/navigation/tokenGridNav.ts`        | `createTokenGridNav()` — token-grid keyboard contract for link + line mode (reads the DOM via `gridDom`)                                                                                                                                                                |
| `src/lib/navigation/visualNeighbor.ts`      | `pickVisualNeighbor()` — pure rect-based row/column math                                                                                                                                                                                                                |
| `src/lib/navigation/visualNeighbor.spec.ts` | Unit tests for `pickVisualNeighbor()`                                                                                                                                                                                                                                   |

## Tests

| File                                            | Covers                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `src/lib/vitest-examples/tokenize.spec.ts`      | Target tokenizer punctuation rules                                   |
| `src/lib/vitest-examples/pinyinConvert.spec.ts` | Canonical↔diacritic pinyin conversion                                |
| `src/lib/tokenState.spec.ts`                    | Token-state derivation                                               |
| `src/lib/tokenPresentation.spec.ts`             | Per-token colour/opacity/weight output                               |
| `src/lib/exportFormat.spec.ts`                  | JSON pretty-printer                                                  |
| `src/lib/themeState.spec.ts`                    | Theme resolution / continuity logic                                  |
| `src/lib/actions/redistribute.spec.ts`          | Hover-spread offset math (`computeRowOffsets`)                       |
| `src/lib/navigation/visualNeighbor.spec.ts`     | Visual-neighbour math                                                |
| `src/routes/**/*.e2e.ts`                        | Playwright end-to-end flows (incl. line-split overflow, rapid-click) |
