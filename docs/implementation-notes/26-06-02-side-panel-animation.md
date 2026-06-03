# Mode-Driven Side Panel Animation

> Commits: `da50015`
> Date: 2026-06-02

## Overview

The main layout transitions between a focused single-column input mode and an expanded panel mode with side tooling areas. The transition is animated entirely in CSS — panels slide in from their respective edges while the grid reallocates space — triggered by a single `mode` state variable in Svelte.

## Motivation

The workbench needs side panels for future tooling (token alignment, link editing, line view). These panels should be invisible and take up no space while the user is entering text, then slide in smoothly when the user advances past the text input step. The challenge was making the panels occupy zero layout space in text mode while still being part of the DOM, so the slide animation could work without elements suddenly appearing from nowhere.

## Architecture

`+page.svelte` holds the `mode` state (`'text' | 'link' | 'line' | 'view'`). When `mode !== 'text'`, the `.panels-open` class is added to the `.layout` grid container.

The quote inputs were extracted into `src/lib/components/QuoteWorkbench.svelte` during this commit. `QuoteWorkbench` receives `sourceText`, `targetText`, `authorship`, and the `autosize` action as props. This keeps the growing layout logic in `+page.svelte` separate from the input surface.

## Implementation Details

**Zero-space panel tracks:** In CSS grid, `minmax(0, 0fr)` collapses a track to zero width without removing the element from the DOM. When `.panels-open` is applied, the column definitions switch to `minmax(0, 1fr)`. Because CSS grid track sizes are animatable, the transition between `0fr` and `1fr` produces the expand/collapse effect.

**Slide transforms:** Each sidebar starts translated fully off-screen (`translateX(-100% - spacing)` for left, `translateX(100% + spacing)` for right). When `.panels-open` is active, transform resets to `translate(0)`. The transform transition runs in parallel with the grid track expansion, so the panel appears to slide in from behind the edge while space opens for it.

**`pointer-events` gating:** Sidebars have `pointer-events: none` by default, switched to `auto` when panels are open. This prevents invisible panels from capturing clicks in text mode.

**`aria-hidden`:** Sidebars receive `aria-hidden={mode === 'text'}` so screen readers skip them when collapsed.

**Portrait tablet:** On tall portrait screens (≥1000px height, <900px width), the left sidebar appears below the content rather than beside it — the grid switches to two rows, and the sidebar slides up from below (`translateY(100% + spacing)`).

**`prefers-reduced-motion`:** All transitions on `.layout` and `.sidebar` are disabled when the user has requested reduced motion.

## Data Flow

1. User clicks the nav button in the Tools Area
2. `mode` flips from `'text'` to `'line'`
3. `class:panels-open` activates on `.layout`
4. CSS transitions animate grid column widths and sidebar transforms simultaneously

## Design Decisions

**CSS-only animation, no JS:** The panel expansion is purely CSS transitions on grid tracks and transforms. No JS measures widths, no `requestAnimationFrame`, no spring libraries. This works because CSS grid track sizes (`fr` units) are natively animatable in modern browsers.

**`minmax(0, Nfr)` over bare `Nfr`:** Without `minmax(0, ...)`, grid items can overflow their tracks when content is wider than the available fraction. The `minmax(0, fr)` form prevents content from inflating the track beyond its intended size.

**`autosize` passed as prop:** The `autosize` Svelte action is defined in `+page.svelte` and passed down to `QuoteWorkbench` as a prop. This is unconventional (actions are usually defined where they're used) and is a known temporary arrangement — see Future Considerations.

## Areas to Be Careful

The grid track animation depends on transitioning between `minmax(0, 0fr)` and `minmax(0, 1fr)`. If a sidebar's content forces a minimum width that overrides the `0fr` collapse (e.g., a non-wrapping element wider than the panel), the panel will not fully collapse in text mode. Keep sidebar content width-constrained.

## Future Considerations

- The `autosize` action should move into `QuoteWorkbench.svelte` once it no longer needs to be defined at the page level.
- The `mode` type includes `'link'` and `'view'` states that are not yet implemented — only `'text'` ↔ `'line'` is wired up.
- The nav button is only rendered in `text` mode (`{#if mode === 'text'}`). A reverse transition back to text mode will need its own trigger.
