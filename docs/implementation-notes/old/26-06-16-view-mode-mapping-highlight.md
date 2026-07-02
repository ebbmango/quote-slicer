# View-Mode Hover/Tap Mapping Highlight

> Commits: `793e0d6`  
> Date: 2026-06-16

## Overview

In view mode, hovering any mapped token lights up all tokens belonging to the same mapping across both panels in a flat highlight color (`rgb(255, 0, 55)`). Touch devices use a tap-to-toggle model instead. The feature sits entirely inside `Alignment` — the class that already owns the token→mapping index — so neither panel needs to duplicate lookup logic.

## Motivation

View mode is the read-only presentation layer: the user wants to see connections between source and target tokens at a glance. Without the highlight, mappings are only visible through per-token color chips; hovering a single token gives no indication of what it corresponds to in the other panel.

## Architecture

The state machine lives in `alignment.svelte.ts`. `Alignment` already held `sourceMappingIndex` and `targetMappingIndex` (O(1) maps from token index → `MappingId`) and was already injected into both panels via Svelte context. The highlight state was added there rather than in a separate store or as props, so the panels share one source of truth without prop-drilling.

Both `InteractiveSourceText` and `InteractiveTargetText` wire `onmouseenter` on each token span to `alignment.hoverSource(i)` / `alignment.hoverTarget(i)`, and `onmouseleave` on the container to `alignment.hoverOut()`. Touch taps call `alignment.tapSource(i)` / `alignment.tapTarget(i)`.

## Implementation Details

### Delayed light-up (cold / warm)

Naively firing on `mouseenter` causes the whole text to flicker as the pointer glides across tokens: each new token briefly clears the old mapping before the new one lights. The fix: **no per-token `mouseleave`**. Clearing happens only when entering an unmapped token or leaving the container. Light-up is deferred:

- **Cold** (500 ms): pointer enters a mapping from nothing lit.
- **Warm** (300 ms): pointer re-enters a mapping within 500 ms of the previous highlight clearing (a "grace window" — the user is still moving around the text).

`pointerMapping` (plain JS, not `$state`) tracks what's under the pointer right now. `hoveredMappingId` (`$state`) is what's actually lit. Moving between two spans of the _same_ mapping hits `movePointer`'s early-return (`next === this.pointerMapping`) and is a no-op.

### Touch

Touch gets no delay — tap is intentional. `tapMapping()` toggles: same mapping dismisses, different mapping switches, unmapped clears. It also resets `warm` and cancels any grace timer so a subsequent mouse hover doesn't inherit the wrong delay.

### Highlight color

`HIGHLIGHT_COLOR = 'rgb(255, 0, 55)'` in `colors.ts`. Intentionally flat — the same color for every mapping, ignoring per-mapping palette entries. The CSS `color` transition on token spans provides a gradual fade-out; light-up is instant once the timer fires.

### Cleanup ownership

`clearHighlight()` (clears both timers + all state) is called from a single `$effect` in `QuoteWorkbench`, which also returns a cleanup function. This ensures pending timers are cancelled if the component unmounts while a timeout is running, and means the reset runs exactly once per mode-exit rather than twice (one per panel).

## Design Decisions

- **No per-mapping palette color for highlights**: The user explicitly chose flat `rgb(255, 0, 55)` for now, to distinguish the hover state clearly from the selection colors used in link mode.
- **No keyboard highlight**: Keyboard navigation in view mode was deferred.
- **`pointerMapping` not `$state`**: Making it reactive would trigger unnecessary re-renders on every mouse move, since its role is internal to `movePointer`'s early-return logic, not presentation.
- **Container-level `mouseleave` for clearing, not per-token**: Per-token leave fires before the next span's enter, creating a one-frame null flash. Container leave only fires when the pointer truly exits the text block.

## Areas to Be Careful

- The flex gap between token spans is not covered by any element (split-zone buttons have `pointer-events: none` in view mode). A pointer parked in a gap keeps the highlight lit until it enters another token or leaves the container. This is a known quirk, intentional under the no-per-token-leave design.
- `tapMapping()` must reset `warm`/`clearGrace()` before computing the next state. If a grace timer from a prior hover-away is running when a tap fires, skipping this would leave `warm=true` and give the next mouse hover the shorter 300 ms delay instead of 500 ms.
