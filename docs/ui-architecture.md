# UI Architecture

## Component tree

```
+page.svelte                      root; sets ModeContext, TokenStore, Alignment
├── <ol> mapping list             sidebar left; iterates sortedMappingViews
│   └── Mapping.svelte (×N)       one card per mapping
└── QuoteWorkbench.svelte         centre workbench; consumes the token store
    ├── <textarea> source         text mode only
    ├── <textarea> target         text mode only
    ├── <div role="grid">         link + line mode: keyboard navigation container
    │   ├── InteractiveSourceText.svelte
    │   └── InteractiveTargetText.svelte
    └── <textarea> authorship     always present
```

## Component responsibilities

### `+page.svelte`

- Instantiates `ModeContext`, the **token store**, and `Alignment` via `setModeContext()` / `setTokenStoreContext()` / `setAlignmentContext(store)` (in that order — `Alignment` takes the store)
- Owns the three-column responsive grid layout and sidebar open/close animation
- Manages the advance button (text → link) and mode toolbar (link / line / view)
- Handles document-level keyboard shortcuts: Backspace/Delete to remove the focused or active mapping
- Handles document-level click to deselect when clicking outside token and card zones
- Manages sidebar scroll: `$effect` watches `activeMappingId` and calls `scrollCardIntoView`
- Handles Tab navigation within the mapping list (`handleListTab`)

### `QuoteWorkbench.svelte`

- Consumes the **token store** via `getTokenStoreContext()` (`src/lib/animation/tokenStore.svelte.ts`) — derives `sourceTokens`/`targetTokens` from it for rendering. It does **not** push tokens into `Alignment`; `Alignment` reads the same store itself (see [Context wiring](#context-wiring)). The only push is `setMeta({sourceText,targetText,authorship})` via `$effect`
- In text mode: renders source and target textareas with real-time Han-character filtering on the source field (including IME composition handling)
- In link/line mode: renders the `role="grid"` keyboard navigation container
- Builds the `editScope()` (DOM refs for the unified Flip — both wrappers, authorship, and each panel's `[data-scrollbox]`) and passes it to `store.split`/`store.merge`
- Delegates split/merge operations to `InteractiveSourceText` and `InteractiveTargetText` via `onSplit`/`onMerge` callbacks, passing `store.animating` down as a prop
- Instantiates `createTokenGridNav()` and wires its `handleKeydown`/`handleFocusIn` to the `role="grid"` container; supplies the mode-dependent config (see [TokenGridNav](#tokengridnav))
- Marks `sourceWrapperEl`/`targetWrapperEl` with `data-zone="source"`/`data-zone="target"` and `data-flip-id="source-panel"`/`"target-panel"` so `TokenGridNav` can resolve panels and the token store's unified Flip can reposition them as units

### `InteractiveSourceText.svelte`

- Renders source tokens as a flat flex-wrap layout in both link and line mode
- **Link mode**: renders interactive `role="option"` spans for non-punctuation tokens; calls `alignment.toggleSource(i, { force })` on click (Cmd/Ctrl); `TokenGridNav` calls it on Alt+Space; uses `longpress` action for mobile multi-add
- **Line mode**: renders the flat token list with zero-width split buttons between same-line tokens and merge buttons at line boundaries; `onSplit`/`onMerge` call straight into the token store (see [line-mode.md](line-mode.md#animation))
- Marks its outer container `data-scrollbox`; leaves its height to the token store while `animating` is true (via `$effect`)
- No longer owns Alt+Space or Escape handling — both route through `TokenGridNav`

### `InteractiveTargetText.svelte`

- Same structure as `InteractiveSourceText` but for target tokens
- **Link mode**: whitespace tokens are non-interactive (`toggleTarget` is a no-op for them)
- **Line mode**: whitespace tokens are the split/merge affordance — interior whitespace → split button, boundary whitespace → merge button (the boundary token itself plus a full-width merge-zone below it)
- Marks `lineContainer` `data-scrollbox`; same `animating`-gated height `$effect` as the source panel
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

All three contexts are set once at the root (`+page.svelte`) and accessed via `getContext` anywhere in the tree:

- `ModeContext` — `setModeContext()` / `getModeContext()` (`src/lib/context/mode.svelte.ts`)
- **token store** — `setTokenStoreContext()` / `getTokenStoreContext()` (`src/lib/animation/tokenStore.svelte.ts`)
- `Alignment` — `setAlignmentContext(store)` / `getAlignmentContext()` (`src/lib/context/alignment.svelte.ts`)

The token store is the single owner of the token arrays. `QuoteWorkbench` no longer pushes tokens into `Alignment`; it only pushes the raw text via `setMeta`. `Alignment` derives its own token view from the store keyed by `meta` (getters `sourceTokens`/`targetTokens`), so there is exactly one token owner — no two-way `$effect` sync, and split/merge can't be handed a pinyin-less array.

## GSAP patterns

GSAP and its plugins are **lazy-loaded inside `onMount`** to avoid import-time browser API calls (the app is statically prerendered). `+layout.svelte` registers GSAP plugins; `tokenStore.svelte.ts` lazy-loads `Flip` itself.

### Unified Flip (tokenStore.svelte.ts)

A split or merge runs **one** `Flip` over an **edit scope** (see [line-mode.md](line-mode.md#animation) and [CONTEXT.md](../CONTEXT.md) for both terms) — the edited panel's tokens (per-token reflow) plus the other panel's wrapper and the authorship textarea (whole-unit repositioning):

1. `Flip.getState(...)` over the scope's flip targets, before mutation
2. Lock the edited panel's `[data-scrollbox]` to its current pixel height, set `animating = true`
3. `mutate()` (writes the text-keyed cache) + `await tick()`
4. Tween the scroll box height to its settled `scrollHeight`, then release to `auto`
5. `Flip.from(state, { duration: 0.35, ease: 'power2.inOut', absolute: false })`; `onComplete` clears `animating`

If `Flip`/`gsap` haven't loaded yet, `mutate()` runs with no animation.

Every token span carries `data-flip-id`, as do `sourceWrapperEl`/`targetWrapperEl` (`data-flip-id="source-panel"`/`"target-panel"`) and the authorship textarea (`data-flip-id="authorship"`) — together these are the flip targets. The `{#each tokens (i)}` loop is keyed by index (not token object) to keep spans alive across mutations — required for Flip tracking. `Interactive*Text` read `store.animating` (passed as a prop) to gate their own height-reset `$effect` while the tween is in flight.
