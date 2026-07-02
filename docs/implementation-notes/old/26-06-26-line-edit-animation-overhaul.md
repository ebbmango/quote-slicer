# Line-edit animation overhaul

> Commits: `a2e434e`
> Date: 2026-06-26

## Overview

Two separate bodies of work landed together: (1) the split/merge divisor markup
was extracted from both `Interactive*Text.svelte` panels into a new shared
`LineDivisor.svelte` component, removing ~505 lines of duplication; (2) the
line-edit animation in `tokenStore.svelte.ts` was overhauled from a manual
height-tween approach to a single nested GSAP Flip over the whole vertical layout,
then extended with a `clearProps` fix for a double-counting bug that caused the
authorship field and the opposite panel to jump on the first frame in unconstrained
viewports.

## LineDivisor extraction

Before this commit both `InteractiveSourceText.svelte` and
`InteractiveTargetText.svelte` maintained parallel copies of:

- All split/merge button markup (`.split-zone`, `.ws-split`, `.merge-zone`)
- A touch state machine (first-tap highlight, second-tap activate, clear-touch
  binding)
- All associated CSS

`LineDivisor.svelte` owns all of this now. Props: `kind` (`'split'|'merge'`),
`surface` (`'zone'|'whitespace'`), `divisorIndex`, `color`, `text`, `flipId`,
`container`, `spread`, `touchedDivisorIndex`, `onActivate`, `onTouch`,
`onClearTouch`. The two Interactive\*Text components simply loop over their token
arrays and emit `<LineDivisor>` between tokens.

The source and target panels use different DOM affordances (source uses zero-width
`.split-zone` buttons between CJK characters; target uses `.ws-split` whitespace
spans between English words). `LineDivisor` renders the correct variant based on
`surface`.

## Animation architecture

### Previous approach

`animate()` locked the edited panel's scroll box height with
`flex-shrink:0` / explicit `style.height`, measured the settled target layout
(with a release-and-reflow loop), ran a GSAP Flip on the edited panel's tokens
only, then tweened the scroll box height to the settled value. Problems:

- The panel _boundary_ snapped to its post-edit position on the first frame (only
  tokens were Flipped; the wrapper itself wasn't)
- Required a multi-step release-and-measure loop whose termination condition was
  unreliable

### Current approach

`animate()` is now a single nested GSAP Flip over the entire vertical layout:

```typescript
const state = Flip.getState([sourceWrapper, targetWrapper, auth, ...editedTokens]);
animating = true;
mutate();
await tick();
void wrapper.offsetHeight; // force synchronous reflow to settle flex

Flip.from(state, {
	duration: 0.35,
	ease: 'power2.inOut',
	absolute: false,
	nested: true,
	onComplete: () => {
		animating = false;
	}
});
```

`absolute: false` keeps both wrappers in document flow so their height change
drives the surrounding layout naturally. `nested: true` makes each token's Flip
transform account for its parent wrapper's concurrent animation. One forced
synchronous reflow after `tick()` is sufficient — flex settles in a single
reflow (the apparent multi-frame drift under the old code was GSAP contamination,
not flex settling slowly).

### The double-counting bug

GSAP Flip with `absolute: false` does not animate wrapper size with a CSS
transform — it tweens the edited wrapper's `style.height` inline property at each
frame, which drives layout recomputation. The sequence is:

1. `Flip.getState()` records true before-positions for all targets.
2. `Flip.from()` immediately reverts the layout to "before" by setting the edited
   wrapper's height back to its before value. Auth and the other wrapper are now
   already at their before-flow positions — the layout is back to before.
3. Flip's computed transforms for auth and the other wrapper are based on the full
   before→after delta. Applied on top of elements already at before-position, they
   double-count: the element ends up displaced twice the expected amount.

This only manifests in the **unconstrained regime** (short text, tall viewport)
where `justify-content: safe center` re-centers the outer stack when the stack
grows. In the constrained/overflow regime the outer stack is capped, the other
wrapper shrinks via flex redistribution, and the Flip transform on the other
wrapper is genuinely load-bearing.

Fix: immediately after `Flip.from()`, unconditionally clear auth's transform (it
was 0 in the constrained regime anyway), and clear the other wrapper's transform
only if its height didn't change — a changed height signals constrained flex
redistribution, where the transform must be preserved:

```typescript
const otherHeightChanged =
	otherBeforeH !== null && otherAfterH !== null && Math.abs(otherBeforeH - otherAfterH) > 1;
if (auth) gsap.set(auth, { clearProps: 'transform' });
if (otherWrapper && !otherHeightChanged) gsap.set(otherWrapper, { clearProps: 'transform' });
```

The other-wrapper height is measured before and after the mutation (before `Flip.getState`
and after `tick()`) so the regime check uses fully settled values.

### Regime detection

Detecting constrained vs unconstrained by stack-top movement was tried and
rejected: during the transition from unconstrained to constrained (when the text
just barely fills the viewport), the stack does move, causing false positives that
broke the overflow regression test. The other wrapper's height is a clean signal —
it changes in constrained (flex redistribution) and doesn't change in unconstrained.

## Regression test

`src/routes/line-split-overflow.e2e.ts` guards the constrained/overflow regime
(viewport 390×480). It measures frame-by-frame during the 600ms animation window
and asserts: panels clip (`overflow:clip`), no source-into-target overlap
(`worstSrcIntoTgt ≤ 2`), no ballooning scroll box, and smooth other-panel motion
(`maxTgtJump ≤ 8px per frame`).

## Areas to be careful

`overflow-clip` on both panel wrappers in `QuoteWorkbench.svelte` is load-bearing.
Without it, the reflowing / Flip-animating tokens paint outside their wrapper into
the adjacent panel. The Flip tween on the wrapper height and the token reflow
inside it only compose cleanly because the wrapper clips its overflow.

The `clearProps` calls must fire **after** `Flip.from()` and synchronously in the
same microtask — `Flip.from()` applies its initial transforms in the same call, so
clearing before it would have no effect. GSAP `Flip.from()` is synchronous up to
the point of applying the initial state; the tween runs asynchronously after.

Do not write to any Svelte `$state` variable from inside a GSAP callback
(`onComplete`, `onUpdate`, etc.). Svelte 5's reactive scheduler re-enters a flush
from inside GSAP's rAF and silently kills reactivity. The `animating = false` in
`onComplete` above is the one exception: it was verified safe because it fires
after all Flip frames complete and no pending flush is in progress.
