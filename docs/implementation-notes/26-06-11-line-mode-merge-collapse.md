# Line Mode: Animating Container Height Through Merge

> Commits: `c67b8f0`
> Date: 2026-06-11

## Overview

Fixes a visual glitch in line mode where merging two lines caused the source/target
panel to instantly snap to its new (shorter) height, clipping the still-animating
tokens until GSAP's Flip transition caught up.

## Motivation

Both `InteractiveSourceText` and `InteractiveTargetText` use a flat, index-keyed
`{#each}` loop so every token span survives split/merge mutations, letting GSAP's
`Flip` plugin animate each token from its old position to its new one
(`createFlipTransition()` in [`flipTransition.svelte.ts`](../../src/lib/animation/flipTransition.svelte.ts)).

Each panel also has an `$effect` that pins the scroll container's pixel height to
`scrollHeight` after every token change, so `overflow-y-auto` doesn't collapse mid-flip.

The two mechanisms ran out of sync:

- **Split** (1 line → 2 lines): `$effect` instantly grows the container to fit the new
  taller content. Tokens animate into the now-larger space — no visible problem.
- **Merge** (2 lines → 1 line): `$effect` instantly shrinks the container to the new,
  shorter height *before* Flip's transform-based animation (`absolute: false`) has
  moved the displaced tokens into place. For ~0.35s, the second line's tokens are
  still rendered at their old (now out-of-bounds) position and get clipped by
  `overflow-y-auto`, only fading into view as the transform settles.

## Implementation Details

`createFlipTransition().run()` previously took a single container and only handled
the Flip animation. It now takes two parameters: `flipContainer` (holds the
`[data-flip-id]` tokens) and `heightEl` (the scroll container whose height should
track the layout change — often the same element).

Sequence inside `run()`:

1. Capture `Flip.getState()` on the tokens, and `oldHeight = heightEl.offsetHeight`.
2. Lock `heightEl.style.height` to `oldHeight` and set `animating = true` — this tells
   the component's `$effect` to back off (see below).
3. Run `mutate()` (the actual split/merge) and `await tick()`.
4. Measure the settled height by briefly setting `height: auto` and reading
   `scrollHeight`, then immediately restore `oldHeight` so nothing visibly jumps.
5. `gsap.to(heightEl, { height: target, duration: 0.35, ease: 'power2.inOut' })` —
   same duration/easing as `Flip.from()`, so the container resize and the token
   slide happen in lockstep.
6. On tween completion, set the final pixel height and `animating = false`.

Both components' `$effect` blocks now check `flip.animating` and skip their
instant resize while a transition is in flight:

```ts
if (!container || flip.animating) return;
```

`gsap` itself is now lazy-loaded alongside `Flip` (`Promise.all([import('gsap/Flip'), import('gsap')])`)
since the height tween needs the core `gsap` object, not just the plugin.

## Design Decisions

- **Height tween mirrors the Flip duration/easing exactly** (`DURATION = 0.35`,
  `EASE = 'power2.inOut'`, both extracted as module constants) so the container
  boundary and the token positions move as one continuous motion rather than two
  visually distinct animations.
- **Split was left alone** — growing the container before tokens move in doesn't clip
  anything, so no height tween is *needed* there, but the same `run()` path now
  handles it uniformly (the tween from old→new height is a no-op direction-wise but
  harmless).
- **`heightEl` is optional** (`null` skips height animation entirely), preserving the
  original fallback path when `Flip`/`gsap` haven't loaded yet (`mutate()` runs
  synchronously with no animation).

## Areas to Be Careful

- The `animating` flag is the only thing preventing the `$effect` and the GSAP tween
  from fighting over `heightEl.style.height`. If a new split/merge is triggered while
  one is still animating, the interaction between the in-flight `gsap.to` and a fresh
  `run()` call (which immediately re-locks `heightEl.style.height` to its current
  `offsetHeight`) hasn't been stress-tested — rapid repeated clicks could produce
  visible height jitter.
- `heightEl.style.height` is left as an inline style after the tween completes
  (`target + 'px'`), not cleared back to `auto`. The next `$effect` run (on the next
  token change, once `animating` is false again) will reset it via `'auto'` →
  `scrollHeight`, so this is self-correcting but worth knowing if debugging stale
  inline styles.
