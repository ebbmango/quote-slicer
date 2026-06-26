# File Map

Quick reference: every source file and its responsibility. Deeper explanations are
linked per area.

## Routes

| File | Responsibility |
|------|----------------|
| `src/routes/+layout.svelte` | Registers GSAP plugins (lazy, `onMount`); starts the interaction-mode sensor (sync `onMount`) |
| `src/routes/+layout.ts` | `export const prerender = true` — static output, no SSR |
| `src/routes/+page.svelte` | Root shell: sets all 4 contexts, the responsive grid + sidebar slide, the text→link arrow launch, `initAlignmentShortcuts` |
| `src/routes/layout.css` | Tailwind import, fonts, theme tokens (`--mapping-gap`, `--line-tool-*`), custom variants (`hocus`, `tablet`, `modal-wide`, …) |
| `src/routes/demo/**`, `src/routes/*.e2e.ts` | Playwright demo routes + e2e specs |

## Tokenization & data (framework-free)

| File | Responsibility |
|------|----------------|
| `src/lib/tokenize.ts` | `SourceToken` / `TargetToken` types; `tokenizeSource()`, `tokenizeTarget()`; `SOURCE_INPUT_RE` ([Tokenization](tokenization.md)) |
| `src/lib/line.ts` | `splitAfterToken()`, `mergeLines()`, `groupByLine()` — pure generics over `T extends { line: number }` ([Line Mode](line-mode.md)) |
| `src/lib/tokenState.ts` | `Mapping`, `MappingId`, `TokenState`, `QuoteExport*` types; `deriveSourceTokenState()`, `deriveTargetTokenState()`, `buildTargetText()`, `findBridgeMappingId()` ([Data Model](data-model.md)) |
| `src/lib/exportFormat.ts` | `formatExport()` — column-aligned JSON pretty-printer ([Export](export.md)) |
| `src/lib/constants/colors.ts` | `MAPPING_COLORS` (9 named palettes), `MAPPING_COLOR_NAMES`, `colors` name-lookup, `MappingColor` type |
| `src/lib/assets/icons.json` | SVG icon path data — **proprietary, gitignored** ([Build & Deploy](build-and-deploy.md)) |

## Contexts & stores

| File | Responsibility |
|------|----------------|
| `src/lib/context/mode.svelte.ts` | `ModeContext` — `current: 'text' \| 'link' \| 'line' \| 'view'` |
| `src/lib/context/breakpoints.svelte.ts` | `BreakpointContext` — `wide` / `belowMedium` / `tabletPortrait` / derived `minimal`, via `matchMedia` ([UI Architecture](ui-architecture.md#responsive-layout)) |
| `src/lib/context/alignment.svelte.ts` | `Alignment` — owns `mappings[]` + `activeMappingId`; derives tokens from the store; toggle handlers, `sortedMappingViews`, `exportData`; exports `MappingView` ([Link Mode](link-mode.md)) |
| `src/lib/context/interactionMode.svelte.ts` | Global `interactionMode` singleton + `initModeTracking()`; writes `html[data-interaction]` ([Keyboard & Navigation](keyboard-navigation.md)) |
| `src/lib/animation/tokenStore.svelte.ts` | The **token store** — single owner of tokens, text-keyed cache, pinyin overlay, unified Flip; `TokenStore` / `TokenAccess` types ([Token Store](token-store.md)) |

## Components

| File | Responsibility |
|------|----------------|
| `src/lib/components/QuoteWorkbench.svelte` | The workbench: textareas (text mode), token grid (link/line/view), IME-filtered source input, builds `editScope()`, owns the nav instance |
| `src/lib/components/InteractiveSourceText.svelte` | Source tokens; one DOM tree per mode; link-mode click; renders a `LineDivisor` between groups |
| `src/lib/components/InteractiveTargetText.svelte` | Target tokens; same structure; renders a `LineDivisor` for each whitespace/boundary token |
| `src/lib/components/LineDivisor.svelte` | The **line divisor** — single owner of the split/merge affordance (split-zone · ws-split · merge-zone), its touch state machine, hover-spread wiring, and CSS; shared by both panels ([Line Mode](line-mode.md)) |
| `src/lib/components/Mapping.svelte` | One mapping card (reads `MappingView` only); quantized grid sizing; `theme` object; pinyin inputs; delete button |
| `src/lib/components/MappingsList.svelte` | The `<ol>` of cards; responsive grid; active-card scroll; `handleListTab`; `use:listRef`; empty state |
| `src/lib/components/JsonExportPanel.svelte` | Derives `formatExport(exportData)`; feeds `HighlightedCode` the palette `colorReplacements` |
| `src/lib/components/HighlightedCode.svelte` | Generic Shiki highlighter; lazy-imports `shiki`; `colorReplacements` prop |
| `src/lib/components/DataPanel.svelte` | Shared maps/json surface; picks `MappingsList` vs `JsonExportPanel`; `.fade-edges` mask |
| `src/lib/components/DataModal.svelte` | Minimal-viewport slide-in over the workbench; history/back integration; force-close on breakpoint exit |
| `src/lib/components/ModeToolbar.svelte` | Bottom toolbar: link/line/view switch + two CSS-gated maps/json toggle pairs (aside vs modal) |
| `src/lib/components/IconToggleButton.svelte` | One reusable icon toggle button (collapses the former 6 near-duplicates) |

## Actions

| File | Responsibility |
|------|----------------|
| `src/lib/actions/longpress.ts` | Svelte action firing `onlongpress` after N ms; mobile force-add on source tokens |
| `src/lib/actions/globalShortcuts.ts` | `initAlignmentShortcuts()` — document-level Delete/Backspace + click-to-deselect |

## Navigation

| File | Responsibility |
|------|----------------|
| `src/lib/navigation/tokenGridNav.ts` | `createTokenGridNav()` — token-grid keyboard contract for link + line mode; exports `getZone()` |
| `src/lib/navigation/visualNeighbor.ts` | `pickVisualNeighbor()` — pure rect-based row/column math |
| `src/lib/navigation/visualNeighbor.spec.ts` | Unit tests for `pickVisualNeighbor()` |

## Tests

| File | Covers |
|------|--------|
| `src/lib/vitest-examples/tokenize.spec.ts` | Target tokenizer punctuation rules |
| `src/lib/tokenState.spec.ts` | Token-state derivation |
| `src/lib/exportFormat.spec.ts` | JSON pretty-printer |
| `src/lib/navigation/visualNeighbor.spec.ts` | Visual-neighbour math |
| `src/routes/**/*.e2e.ts` | Playwright end-to-end flows |
