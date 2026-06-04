# Mode Toolbar and Join/Part Sub-Modes

> Commits: `e52a1be`, `47b13d1`
> Date: 2026-06-04

## Overview

The workbench toolbar was wired up and the `line` mode concept was resolved into two flat sibling states — `join` and `part` — each representing a distinct line-editing operation. The toolbar now fully drives `ModeContext` and provides appropriate visual and keyboard feedback.

## Motivation

Prior to this work the toolbar buttons were stubs: they rendered but changed nothing. The `Mode` type included a `line` state that was never quite right — "line editing" is actually two operations (splitting a line into two, merging two lines into one) that are active one at a time. The question was whether to model this as a parent `line` mode with nested sub-states, or flatten everything to five top-level modes.

## Design Decisions

**Flat mode type over nested state.** `Mode` is now `'text' | 'link' | 'part' | 'join' | 'view'`. A nested model (`line` with children) would have required every consumer of `ModeContext` to deal with two layers. The flat model keeps the context trivial to consume while the toolbar's visual hierarchy (sub-row above main row) still communicates the grouping to the user.

**`line` button as group activator, not a mode itself.** The paragraph icon button enters `part` by default and shows as active whenever `current` is `join` or `part`. Once in line-editing territory, the sub-row takes over switching between the two. Clicking the group button when already in a sub-mode is a no-op.

**Reserved layout space for the sub-row.** Rather than conditionally rendering the `part`/`join` buttons with `{#if}`, the sub-row is always in the DOM and toggled with `opacity-0` + `pointer-events-none`. This prevents the main button row from shifting vertically when sub-buttons appear. The opacity transition runs at 300ms.

**Dynamic `tabindex` instead of DOM reorder.** The sub-buttons sit above the main row in the DOM (visual order matches), which means natural tab order would visit them first. Explicit numeric `tabindex` values are assigned conditionally: when not in line mode, `part` and `join` get `tabindex="-1"` and the sequence is link→line→view; when in line mode, `line` gets `-1` and the sequence becomes link→part→join→view.

**Active/hover opacity via scoped PostCSS.** Inactive buttons carry Tailwind's `opacity-20` class. The hover rule in the scoped `<style>` block is deliberately narrowed to `button.opacity-20:hover` — this means hovering an already-active button has no visual effect, avoiding the jarring dimming of a selected control on mouseover.

## Areas to Be Careful

The `tabindex` scheme uses positive integers (1–4), which puts these buttons in a separate tab sequence from the rest of the page. This is intentional for now but will need revisiting if focusable elements are added elsewhere in the layout that should interleave with the toolbar.

The `panels-open` class on the root layout element was inverted as part of this work (`=== 'text'` → `!== 'text'`): side panels now expand in workbench modes, not the text-input phase.
