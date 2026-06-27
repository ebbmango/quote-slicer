# Pure Module and Action Extraction Wave

> Commits: `7af4805`, `bedc35a`, `d6c5181`
> Date: 2026-06-27

## Overview

Three separate pieces of in-component logic were extracted into standalone, testable units on the same day. Each extraction followed the same pattern: logic that had been duplicated or buried inside a component was pulled out into a pure module (for pure computation) or a Svelte action (for gesture/DOM side-effects), then covered by unit specs.

## The Three Extractions

### tokenPresentation.ts (`7af4805`)

`InteractiveSourceText` and `InteractiveTargetText` each computed per-token color, opacity class, and font weight with ~25 lines of near-identical inline logic. That logic is now in `src/lib/tokenPresentation.ts` as a single exported function `tokenPresentation(o)`.

The function is pure (no DOM access, no imports of Svelte reactivity) and takes an options object covering the current mode, the token's `TokenState`, focus/highlight flags, and the two per-panel differences (source and target use slightly different default opacities and weight rules). It returns `{ style, opacityClass }`. The two panels now call it and bind the result.

A spec (`tokenPresentation.spec.ts`) asserts all output strings match the originals exactly.

### swipeToDelete action (`bedc35a`)

The gesture state machine for swipe-to-delete in `MappingsList` — pointer tracking, deadzone enforcement, direction clamping (two-column cards may only swipe outward), threshold detection, the `justSwiped` latch that suppresses the synthesised click after a flyoff — was ~146 lines of imperative code inside the component. It is now a Svelte action in `src/lib/actions/swipeToDelete.ts`.

The split boundary: the action owns the gesture lifecycle (pointer events, recognition, rejection, `data-swipeFlyoff` stamping, calling `onDelete`). The component retains the GSAP springback and flyoff animations, since those own the GSAP instance and run inside `onMount`. The action borrows column geometry (`columnDir`, `twoColumn`) from the component via options, matching the existing pattern for the `longpress` action.

### rowSpread.ts (`d6c5181`)

`redistribute.ts` (the hover-spread action that fans tokens apart on hover) contained its spread-math inline. That math — given a set of token rects and a hovered token index, compute an array of `{ x, scale }` per token — is now in `src/lib/actions/rowSpread.ts`, covered by `rowSpread.spec.ts`.

## Design Decisions

All three extractions were driven by the same principle: logic that can be tested without a browser should be in a module that can be tested without a browser. The Svelte action split for swipeToDelete deliberately stops short of moving the GSAP calls — those require `onMount` and own an animation instance, so they stay in the component.

The action options pattern (borrowing geometry/predicates from the host rather than re-deriving them) keeps the action thin and avoids duplicating state that the component already tracks for its own animation math.
