# MappingsList animation polish: mutation throttle and empty-state crossfade

> Commits: `a59c47d`, `c70f089`  
> Date: 2026-06-20

## Overview

Two small follow-ups to the GSAP Flip animation work landed in `3315995`. The first
adds a shared guard so rapid user input during a card animation can't cause re-entrant
`$state` writes. The second replaces a hard-gated empty-state overlay with a crossfade.

## Mutation throttle (`a59c47d`)

### Motivation

The root re-entrancy fix (`queueMicrotask` in the gap-close `onComplete`) stops GSAP
callbacks from writing Svelte `$state` mid-flush. But it doesn't stop the *user* from
issuing a second create or delete while the first card is still mid-slide. Rapid
click-test confirmed: overlapping 250 ms exit transitions could still trigger the
silent-reactivity-death bug the microtask was meant to contain.

### Implementation

`MappingsList.svelte` now maintains `alignment.listAnimating` (a `$state` boolean on
the `Alignment` class) via a `$effect` that mirrors `outroing > 0 || closing > 0`. On
`onDestroy` it resets to `false` so the guard is automatically inactive whenever the
maps panel is hidden.

`alignment.svelte.ts` adds early-return guards at the top of `toggleSource`,
`toggleTarget`, `deleteActive`, and `deleteById`. All mutation paths are covered.

### Design notes

`listAnimating` is intentionally on the `Alignment` class rather than handled in
the UI layer. This is an acknowledged altitude compromise: presentation state lives
in the domain object, and a hypothetical second list consumer would silently inherit
the throttle. It was accepted because fixing it (absorbing clicks in `MappingsList` /
`Mapping.svelte` instead) would touch gesture state with non-trivial regression risk.
If a second list consumer ever appears, revisit this.

## Empty-state crossfade (`c70f089`)

Previously the "No mappings" overlay was hidden behind an `outroing === 0` guard,
so it only appeared *after* the last card's 250 ms slide-out finished. The result
was a jarring pop-in after a half-second gap.

The fix imports Svelte's `fade` transition and attaches `in:fade={{ duration: EXIT_MS }}`
/ `out:fade={{ duration: 200 }}` to the overlay div, then drops the `outroing` guard.
The overlay now rises concurrently with the card's slide-out, and fades back out when
the first mapping is added. The `outroing` counter is still used by `scrollSuppressed`
to defer active-card scrolling — that dependency is unaffected.
