# Line-edit animation: one nested Flip over the whole layout

The quote stack sits in a `flex-col max-h-full` container inside a `justify: safe center`
scroll layer. A split/merge changes the edited panel's content height, which moves the
panel boundary and (when the stack grows) re-centers the whole block. The animation has to
move all of that smoothly while the tokens reflow inside the panels.

## Decision

`animate()` is a **single nested GSAP Flip** over the whole vertical layout: both panel
wrappers, the provenance field, and the edited panel's tokens.

```
state = Flip.getState([sourceWrapper, targetWrapper, provenanceEl, ...editedTokens])
mutate(); await tick(); void wrapper.offsetHeight   // settle flex
Flip.from(state, { absolute: false, nested: true, ... })
```

No manual height locking, measuring, or tweening — Flip captures the before-layout, the
DOM settles to the after-layout, and Flip animates everything between. `absolute: false`
keeps the boxes in flow so wrapper height changes drive the surrounding layout; `nested:
true` lets the token flip ride inside the wrapper flip.

## Why flip the layout boxes, not just the tokens

With only the tokens flipped, the token reflow animated smoothly but the **panel boundary
snapped to its post-edit position on the first frame** — an abrupt layout shift on click,
followed by the smooth token animation. Flipping the wrappers + provenance makes the
boundary animate from its pre-edit position too.

This is only possible because the tokens **already overflow** their wrapper (which has
`overflow-clip`). The wrapper can animate its own height without the clipped token slide
inside it fighting back, so the two motions compose in one nested Flip.

## Required invariant

`overflow-clip` on each panel wrapper (in `QuoteWorkbench`) is load-bearing — it keeps the
reflowing/animating content from painting outside the panel into its neighbour. Removing it
re-introduces the cross-panel overlap bug.

## Double-counting fix (unconstrained regime)

GSAP Flip with `absolute: false` tweens the **edited wrapper's inline `height`** at each
frame, which drives the flex layout to recompute. In the unconstrained regime this causes
the outer-stack to re-center via `justify-content: safe center` as a side-effect of the
height tween. Provenance and the "other" (non-edited) wrapper follow this layout change
naturally — but Flip had ALSO applied explicit transforms to them based on the full
before→after delta. Those transforms were computed BEFORE the height was reverted to
"before" by `Flip.from`, so the elements ended up double-displaced:
flow already at before-position + transform = 2× the correct offset.

Fix (in `animate()`): after `Flip.from`, immediately clear the GSAP transform on the provenance
(always safe — in constrained regime it was 0) and on the other wrapper **only if its
height didn't change** (height change = constrained flex redistribution, where the
transform is load-bearing for the position animation).

```js
if (provenanceEl) gsap.set(provenanceEl, { clearProps: 'transform' });
if (otherWrapper && !otherHeightChanged) gsap.set(otherWrapper, { clearProps: 'transform' });
```

This fixes the abrupt jump of the provenance field and the opposite panel on split/merge in the
unconstrained regime without affecting the constrained regime.

## Considered alternatives

- **Lock + tween the scroll box height, gated by a constrained/unconstrained branch**
  (previous implementation): worked, but the boundary snapped to its post position on the
  first frame because only the tokens were flipped — the layout boxes weren't. Replaced by
  flipping the layout boxes directly.
- **Lock the panel wrapper** (`flex-shrink:0`): distorts the outer flex allocation, shifting
  sibling panels during the mutation. Abandoned.
- **Measure the settled height with release-and-wait**: flex settles in one synchronous
  reflow (confirmed with GSAP disabled); the apparent multi-frame "drift" was the GSAP tween
  itself. So no waiting loop is needed — a single forced reflow suffices.
- **`absolute: true`**: positions flipped elements absolutely for the tween; tokens then
  escape the `overflow-clip` wrapper and paint into other panels. Abandoned.
- **CSS grid `grid-template-rows` tween** (considered, not built): would give explicit,
  independent track control and likely remove the unconstrained-regime residual. Out of
  scope for this change; revisit if the ~10px settle becomes user-visible.
