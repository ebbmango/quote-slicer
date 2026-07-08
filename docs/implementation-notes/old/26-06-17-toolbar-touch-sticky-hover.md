# Toolbar Touch Sticky Hover/Focus Fix

> Commits: `3c5412f`
> Date: 2026-06-17

## Overview

Modal toolbar buttons on iOS stayed visually "lit" after a tap closed the modal — iOS applies a sticky `:hover` state on the first tap and a sticky `:focus-visible` on any focused element. Two small fixes in `ToolToolbar.svelte` and `IconToggleButton.svelte` prevent both.

## Fix

**Sticky `:focus-visible`**: `IconToggleButton.svelte` calls `e.currentTarget.blur()` on `pointerup` for touch events. This clears the browser's focus ring before the modal closes, so the button doesn't retain `:focus-visible` styling on the next render.

**Sticky `:hover` (iOS)**: iOS fires a synthetic hover on the first tap and holds it until the next tap elsewhere. Gating the `:hover` selector with `@media (hover: hover)` restricts it to devices that have a real pointing device (mouse, trackpad), so iOS never applies the hover style at all.

## Areas to Be Careful

`@media (hover: hover)` is the correct media query for "true hover device" — `@media (pointer: fine)` is not equivalent (stylus devices have fine pointer but no hover). The two queries can be combined (`@media (hover: hover) and (pointer: fine)`) but `hover: hover` alone is sufficient here.
