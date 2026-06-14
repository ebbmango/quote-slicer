# Toolbar maps/json toggle for single-aside viewports

> Commits: `8febec5`, `194dc09`
> Date: 2026-06-13

## Overview

On narrow viewports (below the 1200px breakpoint where only one `<aside>` is
visible), two new toolbar buttons ("maps" and "json") let the user switch the
single visible aside between the mapping list and the JSON export — content
that on wide viewports occupies the left and right asides respectively.

## Motivation

`+page.svelte`'s layout shows both `.sidebar-left` (mapping list) and
`.sidebar-right` (JSON export) only at `min-width: 1200px`; below that, only
`.sidebar-left` is rendered/visible. The JSON export had no way to be viewed
on smaller screens. `8febec5` added placeholder "maps"/"json" icon buttons to
the toolbar's `.subtools` row (itself hidden at >=1200px); this work wires
them up.

## Implementation Details

`+page.svelte` tracks two new pieces of state:

- `asideView: 'maps' | 'json'` — which content the single visible aside shows.
- `wide: boolean` — whether the viewport is >=1200px, tracked via
  `window.matchMedia('(min-width: 1200px)')` in `onMount`, updated on the
  query's `change` event.

The mapping list and JSON export markup were each extracted into a
`{#snippet}` (`mappingsList()`, `jsonExport()`) so they can be rendered from
either aside without duplication.

- `.sidebar-left` renders `mappingsList()` when `wide || asideView === 'maps'`,
  otherwise `jsonExport()`.
- `.sidebar-right` always renders `jsonExport()` (it's only visible when
  `wide`, via existing CSS).

The "maps"/"json" buttons in `.subtools` set `asideView` on click and
highlight via `class:opacity-20={asideView !== '<name>'}` (inactive = dimmed).

## Design Decisions

- `wide` is tracked in JS (matchMedia) rather than handled purely in CSS,
  because the *same* `.sidebar-left` slot needs to render different content
  depending on both the toggle state and the breakpoint — a CSS-only
  show/hide of two pre-rendered blocks would double-render `HighlightedCode`
  (which does async Shiki tokenization) unnecessarily on narrow screens.
- `asideView` is ignored entirely at `wide` — the toggle only affects the
  single-aside layout, matching the `.subtools` row itself being hidden at
  >=1200px.

## Areas to Be Careful

- The `1200px` breakpoint is duplicated: once in `+page.svelte`'s
  `matchMedia` call and once in the `<style>` block's `@media (min-width:
  1200px)` rules (`.sidebar-right` display, `.subtools` display). These must
  be kept in sync — if the CSS breakpoint changes, update the `matchMedia`
  query too, or `wide` and the actual layout will disagree.
