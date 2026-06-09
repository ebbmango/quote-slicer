# Line-Mode Split/Merge Animation

> Commits: `a3c0958`, `947dfe8`, `b357ba5`
> Date: 2026-06-09

## Overview

When a user splits or merges a line in line-editing mode, three areas of the UI respond: the source text panel, the target text panel, and the authorship textarea below. This work introduces smooth position-based animation so that all three areas glide to their new positions rather than snapping. The final architecture uses two separate animation mechanisms operating in concert: GSAP Flip inside each interactive component for the internal token shuffle, and a parent-level sibling-shift coordinator in `QuoteWorkbench` for cross-panel layout displacement.

## Motivation

Line splits and merges cause the two interactive panels to change height. Because the workbench container is vertically centered (`justify-center`) in the page, a height change shifts the entire workbench upward or downward. Without animation, every panel that wasn't the source of the edit — including the opposite text panel and the authorship field — would snap to their new positions, making the UI feel discontinuous.

The naive fix of animating the mutating panel in isolation is insufficient: adjacent panels still jump. The correct framing is *the problem is the siblings*, not the element being mutated.

## Architecture

**Within each interactive component** (`InteractiveSourceText`, `InteractiveTargetText`): GSAP Flip animates the token elements as they reflow inside the panel. Each token span carries a `data-flip-id` attribute. Before calling `onSplit`/`onMerge`, the component snapshots the current DOM state with `Flip.getState`; after `tick()` lets Svelte commit the new token layout, `Flip.from` plays the tokens from their old positions to their new ones.

**At the workbench level** (`QuoteWorkbench`): `withShiftAnimation` coordinates the siblings. It records the viewport Y positions of the elements that *don't* change their own layout — the opposite panel and the authorship textarea — before the mutation fires. After `tick()` it computes the displacement for each element and runs a `gsap.fromTo` tween (Y-axis only, no scale) for each element that actually moved. The two animation layers are independent and run concurrently.

## Implementation Details

**GSAP plugin registration** (`src/routes/+layout.svelte`): Flip and Draggable are registered inside `onMount` via dynamic imports. This avoids importing GSAP during SSR/prerender, which would fail because the plugins call browser APIs at import time. The layout route has `export const prerender = true`, making this non-negotiable.

**Flat token loop**: the first Flip implementation replaced a nested `{#each lineGroups}` structure with a single `{#each tokens as token, i (i)}`. Svelte destroys and recreates child elements when items move between keyed `{#each}` groups; a flat loop with stable token-index keys keeps every `<span>` alive across split/merge, which is required for Flip to track elements across states.

**`withShiftAnimation`** (`QuoteWorkbench.svelte`) snapshots `getBoundingClientRect()` for each sibling element before calling the state mutation, then waits for the DOM update (`await tick()`), recomputes positions, and animates any element where `|dy| ≥ 0.5px`. `clearProps: 'y'` ensures the GSAP transform is removed after each animation completes so subsequent operations start from a clean state.

**The `lockEl` parameter**: when the target panel changes, the internal Flip animation uses `absolute: true`, which temporarily makes the target's token elements position-absolute, collapsing the `lineContainer`. Without a countermeasure, `targetWrapperEl` also collapses, shifts `authorshipEl` up mid-animation, and creates a double-flicker. The fix: after `tick()` and before starting the GSAP tweens, `lockEl.style.height` is set to the measured post-mutation pixel height of `targetWrapperEl`. This gives the collapsing Flip animation a stable containing box. The lock is released via `await Promise.all(animations)` once all tweens complete.

**Why source mutations don't need `lockEl`**: `InteractiveSourceText` has a `$effect` that sets an explicit pixel height on its outer `container` element whenever `tokens` changes. This effect runs as part of the same DOM-update flush as the split/merge, so by the time Flip runs `absolute: true` on the source tokens, the source container already has a fixed height and cannot collapse. `targetWrapperEl` is therefore unaffected by source Flip, and no locking is needed.

## Design Decisions

**Why not animate at the line-container level using Flip for siblings?** Using Flip on line-wrapper `<div>` elements for cross-panel animation was explored first. Flip uses `scaleY` to animate height changes, producing a squish/stretch artifact on the line whose content was mutated. Pure Y-translation via `gsap.fromTo` avoids this entirely — sibling panels only need positional shift, never resize.

**Why not lift Flip entirely to the workbench level?** Keeping Flip inside each interactive component preserves encapsulation of token-level animation logic. The components already own `lineContainer` refs, `data-flip-id` assignment, and the async `handleSplit`/`handleMerge` pattern. Adding a separate coordinator at the workbench level for the cross-panel concern, rather than centralising everything, follows the separation already established in the codebase.

**Asymmetric sibling sets**: source mutations animate `[targetWrapperEl, authorshipEl]`; target mutations animate `[sourceWrapperEl, authorshipEl]` with `lockEl = targetWrapperEl`. The authorship textarea is always a sibling to be shifted. The opposite panel is included because `justify-center` on the workbench container causes the whole workbench to shift when total height changes, displacing panels that aren't part of the edit.

## Areas to Be Careful

The ordering guarantee between `withShiftAnimation`'s `await tick()` and `handleSplit/handleMerge`'s `await tick()` matters. `withShiftAnimation`'s tick is registered first (it's called synchronously inside `onSplit`/`onMerge` before `handleSplit` reaches its own `await tick()`). JavaScript resolves same-cycle Promise continuations in subscription order, so `withShiftAnimation` always sets the `lockEl` height before the component's `Flip.from` executes. Changing this call ordering would reintroduce the double-flicker.

If the workbench container's CSS alignment changes (e.g., from `justify-center` to `justify-start`), the `sourceWrapperEl` displacement when the target panel changes would become zero, and that element would simply be skipped by the `|dy| < 0.5` guard. No code change needed, but the guard's purpose should be understood as accommodating layout-dependent displacement.
