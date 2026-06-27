# Swipe-to-delete for mapping cards on touch

> Commits: `31e080c`  
> Date: 2026-06-20

## Overview

On touch (coarse-pointer) devices the mapping card delete button was invisible until
the card was selected or hovered — but it was still hittable, so a user just trying
to select a card could accidentally delete it. This commit replaces the button with a
horizontal swipe gesture and hides the button entirely on touch.

## Gesture design

- **Detection:** pointer events on the `<ol>` (delegated). A swipe is recognized only
  after 10 px of horizontal movement that also exceeds vertical movement (angle check).
  This lets the browser resolve vertical scroll vs. horizontal swipe without conflict.
- **Tracking:** once recognized, the card follows the finger 1:1 horizontally via
  inline `transform: translateX(...)`. `touch-action: pan-y` on each `<li>` tells the
  browser to cede horizontal pointer events to JS once the gesture commits.
- **Threshold:** releasing past 40 % of the card's own width triggers delete; below
  that the card springs back via GSAP (`power2.out`, 300 ms).
- **Direction constraint:** in two-column layouts each card may only swipe toward its
  outer edge (right card → right, left card → left). The wrong direction produces no
  movement at all. Rubber-band resistance in the wrong direction is a deferred TODO
  (see comment in `clampSwipe`).
- **Clipping:** `overflow-x-hidden` on the `<ol>` clips the translating card at the
  panel edge so it disappears into the void rather than overlapping adjacent UI.

## Exit path

On a past-threshold release the card's current translate is stamped onto the node as
`dataset.swipeFlyoff = String(tx)`, then `alignment.deleteById` is called. The Svelte
`exit()` transition reads the stamp and, if present, flies the card off the rest of
the way from the finger's position (no fade — it's already at the panel edge) before
`onExitEnd` runs the same GSAP Flip gap-close that a button delete would use.

The stamp approach matters: `exit()` runs asynchronously and the node may carry a GSAP
transform from an in-flight Flip (e.g. a survivor mid gap-close). Inferring "this was
a swipe" from the computed transform would be ambiguous; the explicit marker is
unambiguous and dies with the node.

## Bug fixes applied during the same commit

A code review of the initial implementation surfaced several issues that were fixed
before the commit landed:

**`exit()` wrong-direction fly-off (confirmed bug):** the original version read the
node's computed translate (`Math.abs(currentTranslateX(node)) > 1`) to detect a swipe.
A button-deleted card carrying a GSAP survivor transform would pass that test and fly
off in the wrong direction instead of doing its normal column-aware slide. Fixed by
switching to the explicit `dataset.swipeFlyoff` stamp.

**`onSwipeUp` threshold disagreement (plausible bug):** the original used
`clampSwipe(e.clientX - swipeStartX)` for the threshold check. On touch, `pointerup`
can report a coordinate that differs from the last `pointermove`, so the threshold
could disagree with what the user saw on screen (spring-back when they expected delete,
or vice versa). Fixed by reading `currentTranslateX(card)` — the actual painted value —
as ground truth.

**`justSwiped` stranded flag (plausible bug):** after a recognized swipe, `justSwiped`
is raised to swallow the synthesized click that follows `pointerup`. If the fly-off
animation removed the click's target node before the click dispatched, the browser
dropped the click silently and the flag stayed `true`, causing the next genuine click to
be swallowed too. Fixed with a `setTimeout(clearJustSwiped, 0)` fallback — ordered
after the synchronous click dispatch, so it's a no-op in the normal path but clears the
flag if the click never arrives. The fallback is also cleared on the next `pointerdown`
and in `onDestroy`.

**`MediaQueryList` created per touch (efficiency):** the original called
`window.matchMedia('(pointer: coarse)')` on every `pointerdown`. Fixed by lazy-caching
a single `MediaQueryList` instance (`coarsePointerMQL ??= window.matchMedia(...)`).
Lazy init is required because `prerender = true` forbids `window` access at module load.

## Interaction with `listAnimating` guard

`deleteById` bails out early while `alignment.listAnimating` is true (see
`26-06-20-mappings-list-animation-polish.md`). If a past-threshold swipe lands while
another card is animating, `deleteById` no-ops and the card springs back instead of
being stranded off-screen. The user can retry once the animation settles.

## Deferred items

Three findings from the code review were intentionally left open:

1. `listAnimating` lives on the domain `Alignment` class (altitude issue — see
   animation polish note). Correct but architecturally impure.
2. No disabled-state feedback on the delete button / keyboard shortcut while
   `listAnimating` is true. Silent no-op is functional; adding feedback is a UX
   decision, not a correctness issue.
3. `swipeRejected` could be collapsed by nulling `swipeCard` on wrong-direction
   rejection. Harmless as-is; the three-state encoding is arguably clearer and touching
   gesture state risks subtle regressions.

## Areas to be careful

- `exit()`, `currentTranslateX`, `columnDir`, `isTwoCol`, and `canAnimate` all touch
  DOM APIs. They are only safe inside Svelte transition fns and event handlers (never
  called during prerender). Do not promote them into `$derived` or module-level
  initializers.
- The `closeTweens` array is a plain `let` (not `$state`) because GSAP timelines must
  not be wrapped in a Svelte proxy. `closing` is the `$state` mirror. Do not merge them.
- Never write Svelte `$state` synchronously from a GSAP `onComplete` — it re-enters the
  flush and silently kills reactivity with no error. The gap-close already defers its
  `closing` write via `queueMicrotask`; preserve that pattern if touching `onExitEnd`.
