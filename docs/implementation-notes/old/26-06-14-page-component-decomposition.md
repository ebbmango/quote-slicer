# +page.svelte decomposition: extracting layout pieces into components

> Commits: `8d9053d`, `fa16ae5`, `008e956`, `0242b66`, `a9800cb`, `e855e21`, `e6e6bd9`, `2682473`
> Date: 2026-06-14

## Overview

A sequence of pure extractions shrinks `src/routes/+page.svelte` from 447 lines of mixed
layout, state, and markup down to a thin shell that wires up contexts and composes
extracted components. No behavior changes — each commit moves a self-contained piece of
state/markup/CSS into its own file.

## Motivation

`+page.svelte` had accumulated breakpoint-tracking state, the mappings list, JSON export
view, maps/json aside panels, a slide-in modal for minimal viewports, the bottom toolbar
(with six near-duplicate toggle buttons), and global keyboard/click shortcuts — all in one
file. Each piece is independently reusable or testable, and the file's size made it hard to
see which state belonged to which concern.

## Architecture

The extraction landed in dependency order:

1. **`BreakpointContext`** (`src/lib/context/breakpoints.svelte.ts`) — `wide`,
   `belowMedium`, `tabletPortrait`, and derived `minimal`, backed by `matchMedia` listeners.
   Replaces inline `$state` + listeners in `+page.svelte`.
2. **`MappingsList.svelte`** — the mappings snippet, including the `listRef` action that
   prevents a stale aside/modal copy's teardown from nulling the surviving copy's scroll
   ref, plus scroll-into-view and Tab-handling logic.
3. **`JsonExportPanel.svelte`** — the JSON export view (new file, no `+page.svelte` diff in
   this commit — it's wired in by `DataPanel` next).
4. **`DataPanel.svelte`** — renders `MappingsList` or `JsonExportPanel` based on a `view:
'maps' | 'json'` prop, with the `fade-edges` mask CSS for scroll panels. Used by both the
   aside and the modal.
5. **`DataModal.svelte`** — the slide-in panel for minimal viewports: `modalOpen`/
   `forceClose`/`flyX` state, `openModal`/`closeModal`, the `popstate` listener for Android
   back, and the modal markup/CSS. Exposes `openModal`/`closeModal` via `bind:this`.
6. **`IconToggleButton.svelte`** + **`ToolToolbar.svelte`** — collapses six near-duplicate
   maps/json toggle buttons (aside vs. modal variant, times two views) into one
   `IconToggleButton`, and moves the link/line/view tool switcher and its CSS into
   `ToolToolbar`.
7. **`globalShortcuts.ts`** (`src/lib/actions/`) — `initAlignmentShortcuts(alignment)` moves
   the document-level Delete/Backspace and click-to-deselect handlers out of `+page.svelte`,
   called once from `onMount`.
8. Final cleanup commit removes leftover dead commented-out code.

## Implementation Details

`+page.svelte` now: sets up contexts (`tool`, `breakpoints`, `tokenStore`, `alignment` — see
[[26-06-14-token-store-consolidation]]), owns `sourceText`/`targetText`/`authorship` and the
`asideView`/`modalOpen` state that's threaded into `DataModal` and `ToolToolbar`, and keeps
the text→link tool "arrow launch" animation (the one piece of bespoke interaction left
in-file). Everything else is composition: `<DataPanel>` for the two asides, `<DataModal
bind:this={dataModal}>` for the minimal-viewport slide-in, and `<ToolToolbar>` for the bottom
toolbar, with `openModal`/`closeModal` passed through as closures over `dataModal`.

`DataPanel` is the shared rendering surface for "maps or json" — both `+page.svelte`'s
sidebars and `DataModal` render through it, so the `fade-edges` mask and the
`MappingsList`/`JsonExportPanel` choice live in one place.

`ToolToolbar` renders two sibling button groups (`.subtools-aside` and `.subtools-modal`),
each built from `IconToggleButton`, switching visibility via CSS rather than conditional
markup — `IconToggleButton` itself is a single `<button>` wrapping an SVG path from
`icons.json`, taking `icon`/`label`/`active`/`onclick`/`testid`.

## Design Decisions

- **Extract by ownership boundary, not by file size.** Each extracted piece (breakpoints,
  modal lifecycle, toolbar buttons, shortcuts) was already a self-contained unit of state
  inside `+page.svelte`; the commits just gave each one its own file and, where useful, a
  context (`BreakpointContext`) or exported function (`initAlignmentShortcuts`).
- **`DataPanel` as a shared view, not duplicated markup.** Both the aside and modal render
  the same maps/json content; factoring it once avoids the aside/modal copies drifting.
- **`IconToggleButton` collapses near-duplicates rather than parameterizing in place.** Six
  near-identical buttons became one component with a small prop surface (`icon`, `label`,
  `active`, `onclick`, `testid`), used by both `ToolToolbar` button groups.

## Future Considerations

- `+page.svelte` still owns the text→link "arrow launch" transition and its CSS — this is
  the last significant chunk of bespoke per-page behavior, and a natural next extraction if
  the file needs to shrink further.
