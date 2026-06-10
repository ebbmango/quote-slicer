# UI Architecture

## Component tree

```
+page.svelte                      root; sets ModeContext and Alignment
├── <ol> mapping list             sidebar left; iterates sortedMappingViews
│   └── Mapping.svelte (×N)       one card per mapping
└── QuoteWorkbench.svelte         centre workbench; owns token caches
    ├── <textarea> source         text mode only
    ├── <textarea> target         text mode only
    ├── <div role="grid">         link + line mode: keyboard navigation container
    │   ├── InteractiveSourceText.svelte
    │   └── InteractiveTargetText.svelte
    └── <textarea> authorship     always present
```

## Component responsibilities

### `+page.svelte`

- Instantiates `ModeContext` and `Alignment` via `setModeContext()` / `setAlignmentContext()`
- Owns the three-column responsive grid layout and sidebar open/close animation
- Manages the advance button (text → link) and mode toolbar (link / line / view)
- Handles document-level keyboard shortcuts: Backspace/Delete to remove the focused or active mapping
- Handles document-level click to deselect when clicking outside token and card zones
- Manages sidebar scroll: `$effect` watches `activeMappingId` and calls `scrollCardIntoView`
- Handles Tab navigation within the mapping list (`handleListTab`)

### `QuoteWorkbench.svelte`

- Owns `sourceTokensCache` and `targetTokensCache` (text-keyed cache pattern)
- Derives `sourceTokens` and `targetTokens`; pushes them into `Alignment` via `$effect`
- In text mode: renders source and target textareas with real-time Han-character filtering on the source field (including IME composition handling)
- In link/line mode: renders the `role="grid"` keyboard navigation container
- Implements `withShiftAnimation()` for cross-panel sibling Y-shift when a split/merge changes the height of one panel
- Delegates split/merge operations to `InteractiveSourceText` and `InteractiveTargetText` via `onSplit`/`onMerge` callbacks
- Instantiates `createTokenGridNav()` and wires its `handleKeydown`/`handleFocusIn` to the `role="grid"` container; supplies the mode-dependent config (see [TokenGridNav](#tokengridnav))
- Marks `sourceWrapperEl`/`targetWrapperEl` with `data-zone="source"`/`data-zone="target"` so `TokenGridNav` can resolve which panel an element belongs to in either mode

### `InteractiveSourceText.svelte`

- Renders source tokens as a flat flex-wrap layout in both link and line mode
- **Link mode**: renders interactive `role="option"` spans for non-punctuation tokens; calls `alignment.toggleSource(i, { force })` on click (Cmd/Ctrl); `TokenGridNav` calls it on Alt+Space; uses `longpress` action for mobile multi-add
- **Line mode**: renders the flat token list with zero-width split buttons between same-line tokens and merge buttons at line boundaries; applies GSAP Flip for per-panel token shuffle animation
- Sets an explicit pixel height on its container after every token change (via `$effect`) to prevent Flip's `absolute: true` from collapsing the container
- No longer owns Alt+Space or Escape handling — both route through `TokenGridNav`

### `InteractiveTargetText.svelte`

- Same structure as `InteractiveSourceText` but for target tokens
- **Link mode**: whitespace tokens are non-interactive (`toggleTarget` is a no-op for them)
- **Line mode**: whitespace tokens are the split/merge affordance — interior whitespace → split button, boundary whitespace → merge button (the boundary token itself plus a full-width merge-zone below it)
- No container height lock needed; `QuoteWorkbench` provides `lockEl` to `withShiftAnimation` instead
- No longer owns Alt+Space or Escape handling — both route through `TokenGridNav`

## TokenGridNav

`createTokenGridNav()` (`src/lib/navigation/tokenGridNav.ts`) is the single owner of the token-grid keyboard contract for **both** link and line mode. `QuoteWorkbench` creates one instance and wires `handleKeydown`/`handleFocusIn` to the `role="grid"` container's `onkeydown`/`onfocusin`.

It takes a `getContainer()` accessor and a config object whose fields are getters/callbacks re-evaluated on every keystroke, so a single instance can serve both modes:

- `itemSelector()` — CSS selector for the currently navigable elements: `[role="option"]` in link mode, `.split-zone, .merge-zone, .ws-split, .ws-boundary` in line mode
- `crossZoneJump()` — `true` in link mode (enables Alt+Enter and the source↔target row-boundary jump), `false` in line mode
- `getDefaultIndex(zone)` — link mode delegates to `alignment.findDefaultTokenIndex(zone)`; unused in line mode (`crossZoneJump` is `false`, so `jumpTo` never runs)
- `onActivate(el, e)` — Alt+Space/Alt+Shift+Space: link mode resolves `el`'s zone via `data-zone` and `data-token-index` and calls `alignment.toggleSource`/`toggleTarget`; line mode calls `el.click()` to trigger the button's existing split/merge handler
- `onEscape()` — link mode calls `alignment.deselect()`; line mode is a no-op (Escape still blurs the focused element first, in both modes)

`getZone(el)` (exported alongside `createTokenGridNav`) resolves a zone by walking up to the nearest `[data-zone="source"|"target"]` ancestor — the wrapper divs `QuoteWorkbench` renders around each panel, present in both modes.

The visual row/column math (`findVisualNeighbor`) delegates to the pure function `pickVisualNeighbor()` in `src/lib/navigation/visualNeighbor.ts`, which operates on plain `{ top, bottom, left, width }` rects and is unit-tested in `visualNeighbor.spec.ts`.

### `Mapping.svelte`

- Reads only `MappingView` — never touches raw `Mapping` state or token arrays
- Renders a three-column card: hanzi column, pinyin input column, number badge + delete button column
- Card height spans `r = floor(sourceEntries.length / 2) + 1` grid rows (quantized sizing that tiles cleanly in the CSS grid)
- All colors resolved through a single `theme` derived object keyed by `isActive`; avoids repeating `isActive ? a : b` ternaries throughout the markup
- Pinyin inputs are editable only when the card is active and not empty; calls `alignment.setPinyin(id, i, value)`
- Delete button appears on hover or focus; calls `alignment.deleteById(id)`

## Context wiring

Both contexts are set once at the root (`+page.svelte`) and accessed via `getContext` anywhere in the tree:

- `ModeContext` — `setModeContext()` / `getModeContext()` (`src/lib/context/mode.svelte.ts`)
- `Alignment` — `setAlignmentContext()` / `getAlignmentContext()` (`src/lib/context/alignment.svelte.ts`)

`QuoteWorkbench` syncs the derived token arrays into `Alignment` via two `$effect` calls (one per panel). This keeps `Alignment` as the single source of truth for mappings while token ownership stays in `QuoteWorkbench`.

## GSAP patterns

GSAP and its plugins are **lazy-loaded inside `onMount`** to avoid import-time browser API calls (the app is statically prerendered). `+layout.svelte` registers GSAP plugins; individual components import `Flip` themselves.

### Internal Flip (InteractiveSourceText / InteractiveTargetText)

Used for per-panel token shuffle when a line splits or merges. Both components share `createFlipTransition()` (`src/lib/animation/flipTransition.svelte.ts`), which owns the lazy `Flip` import and exposes `run(container, mutate)`:

1. `Flip.getState(container.querySelectorAll('[data-flip-id]'))` before mutation
2. `mutate()` + `await tick()`
3. `Flip.from(state, { duration: 0.35, ease: 'power2.inOut', absolute: true })`

If `Flip` hasn't loaded yet (or `container` is null), `run()` just calls `mutate()` with no animation.

Every token span carries `data-flip-id` so Flip can track it across DOM moves. The `{#each tokens (i)}` loop is keyed by index (not token object) to keep spans alive across mutations — required for Flip tracking.

### Sibling shift (QuoteWorkbench.withShiftAnimation)

Used for cross-panel Y-displacement when one panel's height changes.

1. Snapshot `getBoundingClientRect()` for each sibling
2. `mutate()` + `await tick()`
3. Optionally lock `lockEl.style.height` to prevent Flip's `absolute: true` from collapsing `targetWrapperEl` during concurrent Flip animation
4. `gsap.fromTo(el, { y: dy }, { y: 0, duration: 0.35, ease: 'power2.inOut', clearProps: 'y' })` per displaced sibling
5. `await Promise.all(animations)`, then release height lock
