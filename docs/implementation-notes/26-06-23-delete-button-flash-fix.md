# Delete Button Color Flash Fix

> Commits: `296de30`  
> Date: 2026-06-23

## Overview

The delete button on mapping cards flashed the wrong color in two distinct situations: briefly while clicking an inactive card, and on the first click after a theme switch. Three separate bugs combined to produce these symptoms; the fix addresses each layer independently.

## The Bugs

**Bug 1 — Transition on SVG fill.**  
The two `<path>` elements inside the delete SVG had `class="duration-100"`. Tailwind's `duration-100` sets only `transition-duration`; it leaves `transition-property` at its default, which is `all`. This meant `fill` transitions over 100ms instead of snapping. Any time the fill value changed while the button was becoming visible, the intermediate colors were painted. Fix: remove the class from both paths.

**Bug 2 — Delete colors coupled to `isActive`, but focus fires before click.**  
The delete button is revealed when `isFocused` is true (set by the `<li>`'s `onfocus` handler, which fires at **mousedown**). But `isActive` is set by `onclick`, which fires at **mouseup**. From mousedown to mouseup, the button is visible in its inactive-card color palette (`botInactive` as the icon background). When the click lands, `isActive` flips and the colors snap to the active palette. With Bug 1 present this was a 100ms animated transition; without it, it's a single-frame snap — still a flash on slower hardware or when the mouse is held.

The root fix: the delete button is an action affordance, not a state indicator. It doesn't need to reflect whether the card is active. Its colors are now derived directly from `colorVariant` (always the active palette) regardless of `isActive`. This removes the entire inactive→active color change on click, so there is nothing left to flash.

**Bug 3 — Stale GPU texture on hidden element.**  
When a button is `opacity-0`, Chrome paint-culls its subtree. A theme switch updates the `fill` attributes in the DOM, but Chrome does not re-rasterize a culled element. On first reveal after the switch, Chrome composites the cached pre-switch texture for one frame before issuing a repaint. This produced the "first click after theme switch flashes the previous theme's color" symptom — exactly `botInactive` in the old scheme (light `#edf1dc` ≈ white, dark `#34352F` ≈ near-black).

Fix: `{#key isDark}` on the `<svg>`. Svelte destroys and recreates the node when `isDark` changes, forcing a fresh raster with the current colors. The remount is invisible because toggling the theme moves focus to the theme toggle button, blurring every mapping card and hiding all delete buttons during the swap.

## Design Decisions

- **Why `{#key isDark}` on the SVG and not the button?** Re-keying the button would reset the `isButtonHovered` / `isFocused` state, which controls the opacity. Re-keying just the SVG is surgical: the containing button survives with its state intact, only the painted content is replaced.
- **Active palette always:** In the previous design the delete button used `theme.botBg` (which resolves to either `botActive` or `botInactive` depending on `isActive`). Using `colorVariant.botActive` unconditionally means an inactive card's delete button shows slightly different icon colors than before — but the button is hidden at rest and only visible on hover/focus, so the visual impact is negligible.

## Areas to Be Careful

The `{#key isDark}` trick relies on the assumption that delete buttons are always hidden when the theme changes. This is currently true because the theme toggle steals focus. If that ever changes (e.g. a keyboard shortcut toggles the theme while a mapping is focused), the SVG will briefly remount visibly. The correct fix in that case would be to force a reflow/repaint rather than a DOM remount, but for now the assumption holds.
