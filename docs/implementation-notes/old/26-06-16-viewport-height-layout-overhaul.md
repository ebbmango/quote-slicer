# Viewport-Height Layout Overhaul

> Commits: `e501cb5`, `6841fe1`, `38386ff`  
> Date: 2026-06-16

## Overview

Three successive commits replaced the app's brittle `max-h-[40vh]` / `max-h-[25vh]` height caps with a proper flex `min-h-0` chain, a single safe-center scroll layer, and CSS `mask-image` fades. The result: panels shrink to fit the available band at any viewport height, scroll only when they genuinely overflow, and never show a hard clip edge.

## Motivation

The old layout used fixed viewport-percentage caps (`max-h-[40vh]` on the source panel, `max-h-[25vh]` on target, `max-h-[10vh]` on authorship). At large viewports these caps kicked in before the content needed them, forcing scrollbars on panels that had room to spare. At small viewports the caps were too generous relative to the actual band height, so content could spill outside the layout. Neither case was predictable without measuring the viewport explicitly.

## Architecture

The fix is a flex `min-h-0` chain that lets each layer shrink to the height it actually has rather than a viewport fraction:

- `+page.svelte` → `<main>` flex column → workbench band (`flex-1 min-h-0`)
- Band → `<div class="absolute inset-0 flex flex-col items-center overflow-y-auto [justify-content:safe_center]">` (the scroll layer)
- Scroll layer → `QuoteWorkbench` outer wrapper (`flex flex-col min-h-0 max-h-full`)
- Wrapper → each panel (`flex min-h-0 w-full`) → `InteractiveSourceText` / `InteractiveTargetText` (`min-h-0 overflow-y-auto`)

`min-h-0` is required at every level because flex items default to `min-height: auto` (content size), which prevents shrinking below the content and breaks the chain.

## Implementation Details

### Safe-center scroll layer

The scroll layer uses `justify-content: safe center` (via Tailwind's `[justify-content:safe_center]`). When the quote fits in the band it is centered vertically. When even the floored panels overflow (very small viewports, ~400 px tall or less), `safe center` falls back to `flex-start` so the top of the quote stays reachable — without `safe`, a centered overflowing flex child can become unreachable because the overflow is split symmetrically above and below the viewport.

### DataModal as sibling, not child

`DataModal` is an `absolute`-positioned sibling of the scroll layer inside the band `<div>`, not a child inside the scroll layer. This means the modal stays fixed relative to the band regardless of scroll position. Previously it used `inset: var(--layout-spacing) 0` for vertical separation; after this refactor the parent flex column already provides a `gap-6` gap between the band and the toolbar/sun-icon rows, so the modal's inset changed to `inset: 0` — it fills the entire band.

The band container itself got `overflow-hidden rounded-[20px]` so that when the scroll layer's content extends into the corners, it is clipped to the same rounded rect as the modal. Without this, the quote text bleeds through the modal's rounded corners.

### CSS fade-y instead of hard overflow cutoff

Source panel, target panel, and authorship textarea each gain a `fade-y` class that applies a `mask-image` linear gradient — transparent at the top and bottom edges, opaque in the middle. The fade depth (0.75 rem on panels, 0.5 rem on authorship) matches the element's `py-3` / `py-2` padding, so at the scroll extremes the first and last lines sit past the fade at full opacity. Only content that is mid-scroll dims at the edge. Because `mask-image` is transparency-based it works over any background (the page's white and the modal's `#f9f9f9`).

### Text-mode textarea alignment

A follow-up commit wrapped the text-mode textareas in a shared `flex flex-col min-h-0 w-full px-1` container and applied the same `fade-y`, `px-2 py-3`, `no-scrollbar`, and `leading-10` classes used by the view-mode token panels. The textareas are direct flex-column children (not wrapped like the token panels) because `autosize` applies an inline `height` style; they must sit on the column's main axis for `flex-shrink + min-h-0 + overflow-y-auto` to cap and scroll them rather than push siblings out of the way.

The tools area at the bottom received `min-h-14` so the text-mode "next" arrow and the view-mode `ModeToolbar` occupy the same footprint, keeping the flex-1 band height constant across the mode switch.

## Design Decisions

- **One scroll layer in `+page`, not per-panel**: per-panel scroll was the old model (each panel capped at a vh fraction and scrolled independently). The new model scrolls the entire quote as a unit only when the panels bottom out — a much less common case. Individual panels still scroll internally, but only relative to the quote block, not the page.
- **`safe center` over `center`**: plain `center` on an overflowing flex container clips the start of the content irrecoverably. `safe center` is the correct primitive here; without it, short-viewport layout becomes unusable.
- **`overflow-hidden` on the band, not the scroll layer**: clipping on the scroll layer would clip scroll content. The band container clips only the visual corners; the scroll layer inside it still scrolls unimpeded.
- **Fade depth tied to padding**: matching `mask-image` fade size to `py-*` padding means the fade is invisible at scroll extremes. If padding changes, the fade depth should change with it.
