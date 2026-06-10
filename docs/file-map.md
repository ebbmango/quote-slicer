# File Map

Quick reference: every source file and its responsibility.

## Routes

| File | Responsibility |
|------|---------------|
| `src/routes/+layout.svelte` | GSAP plugin registration (lazy, inside `onMount`) |
| `src/routes/+layout.ts` | `export const prerender = true` — static output, no SSR |
| `src/routes/+page.svelte` | Root layout: three-column grid, context setup, mode toolbar, sidebar scroll, document-level keyboard/click handlers |

## Library

| File | Responsibility |
|------|---------------|
| `src/lib/tokenize.ts` | `SourceToken` / `TargetToken` types; `tokenizeSource()`, `tokenizeTargetSeparate()`, `tokenizeTargetCombined()`; `SOURCE_INPUT_RE` |
| `src/lib/line.ts` | `splitAfterToken()`, `mergeLines()`, `groupByLine()` — pure generics over `T extends { line: number }` |
| `src/lib/tokenState.ts` | `Mapping` / `MappingId` / `TokenState` types; `deriveSourceTokenState()`, `deriveTargetTokenState()`, `buildTargetText()`, `findBridgeMappingId()` — framework-free, vitest-safe |
| `src/lib/constants/colors.ts` | `MAPPING_COLORS` array — 9 named palettes (`applesour`, `lush`, `seabreeze`, `azure`, `compostella`, `sugar`, `strawberry`, `maple`, `beeswax`); `MappingColor` type |
| `src/lib/assets/icons.json` | SVG icon path data |

## Context

| File | Responsibility |
|------|---------------|
| `src/lib/context/mode.svelte.ts` | `ModeContext` — `current: Mode` (`'text'` \| `'link'` \| `'line'` \| `'view'`); `setModeContext()` / `getModeContext()` |
| `src/lib/context/alignment.svelte.ts` | `Alignment` — owns `mappings[]`, shadow token arrays, derived index maps, `sortedMappingViews`, toggle handlers; `setAlignmentContext()` / `getAlignmentContext()`; exports `MappingView` type |

## Components

| File | Responsibility |
|------|---------------|
| `src/lib/components/QuoteWorkbench.svelte` | Text-keyed token caches; source/target textarea (text mode); `role="grid"` navigation container (link/line mode); `withShiftAnimation()` for cross-panel Y-shift; instantiates `createTokenGridNav()`; IME-aware Han input filtering |
| `src/lib/components/InteractiveSourceText.svelte` | Source token display; link mode click interaction; line mode split/merge with GSAP Flip; container height lock via `$effect` |
| `src/lib/components/InteractiveTargetText.svelte` | Target token display; link mode click; line mode split/merge using whitespace tokens as the split/merge affordance; GSAP Flip |
| `src/lib/components/Mapping.svelte` | Single mapping card; reads `MappingView` only; quantized grid-row sizing; `theme` derived object; pinyin inputs; delete button |

## Actions

| File | Responsibility |
|------|---------------|
| `src/lib/actions/longpress.ts` | Svelte action: fires `onlongpress` callback after N ms; used for mobile multi-add on source tokens |

## Animation

| File | Responsibility |
|------|---------------|
| `src/lib/animation/flipTransition.svelte.ts` | `createFlipTransition()` — lazy-loads GSAP's `Flip` plugin and runs a `[data-flip-id]` Flip animation around a mutation; shared by `InteractiveSourceText` and `InteractiveTargetText` |

## Navigation

| File | Responsibility |
|------|---------------|
| `src/lib/navigation/tokenGridNav.ts` | `createTokenGridNav()` — single owner of token-grid keyboard contract for link and line mode; exports `getZone()` |
| `src/lib/navigation/visualNeighbor.ts` | `pickVisualNeighbor()` — pure rect-based row/column math, extracted for testing |
| `src/lib/navigation/visualNeighbor.spec.ts` | Unit tests for `pickVisualNeighbor()` |
