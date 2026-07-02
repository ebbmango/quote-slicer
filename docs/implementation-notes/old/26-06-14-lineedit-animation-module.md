# lineEdit module: unifying split/merge animation across panels

> Commits: `ca27ef4` (documented further in `ebe1e26`)
> Date: 2026-06-14

## Overview

Replaces two separate, competing animation mechanisms for line-mode split/merge — a
per-component Flip (`flipTransition`) and `QuoteWorkbench`'s cross-panel `withShiftAnimation` —
with a single module, `createLineEdit()` in `src/lib/animation/lineEdit.svelte.ts`, that owns
both the text-keyed token cache and one unified GSAP Flip per edit.

## Motivation

Before this change, a split or merge in one panel triggered two independent animations: a Flip
on the edited panel's own tokens, and a separate `withShiftAnimation` Y-shift on the _other_
panel plus the authorship field to absorb the height change. Each had its own height-lock,
and the two could race — `withShiftAnimation`'s `lockEl.style.height` lock and the Flip's
`absolute: true` could fight over the same element's box during a single edit.

## Architecture

`createLineEdit()` returns an object exposing `sourceTokens(text)`, `targetTokens(text)`,
`split(...)`, `merge(...)`, and an `animating` flag. It internally holds:

- `sourceCache` / `targetCache` — the text-keyed `{ text, tokens }` cache previously kept as
  `$state` directly in `QuoteWorkbench`. If the cached text matches the current text, the cached
  (possibly split/merged) token array is returned; otherwise the text is retokenized fresh. This
  is what lets pinyin (attached to source tokens after the first split) survive subsequent
  split/merges within the same editing session.
- Lazily-loaded `gsap` and `Flip` (via dynamic import in `onMount`, consistent with the project's
  GSAP lazy-loading convention).

`QuoteWorkbench.svelte` now calls `lineEdit.split('source'|'target', text, tokens, index,
editScope())` / `lineEdit.merge(...)` instead of doing the cache-write and animation inline.

## Implementation Details

`EditScope` is the set of DOM refs a single edit animates over: the source/target panel
wrappers (now tagged `data-flip-id="source-panel"` / `"target-panel"`), the authorship element
(`data-flip-id="authorship"`), and each panel's scroll box (`[data-scrollbox]`, queried from the
wrapper).

`animate(zone, scope, mutate)` does the actual work:

1. Captures `Flip.getState()` over `flipTargets(zone, scope)` — the _edited_ panel's individual
   tokens (`[data-flip-id]` elements inside its scroll box, which reflow) plus the _other_
   panel's wrapper and authorship as whole units (which only reposition).
2. Locks the edited scroll box to its current pixel height and sets `animating = true` (so the
   panel's own instant-fit `$effect` doesn't snap the height mid-flight).
3. Runs `mutate()` (the split/merge + cache write) and awaits `tick()`.
4. Measures the settled height (`scrollHeight` after temporarily setting `height: auto`), then
   GSAP-tweens the scroll box from the locked height to the new one, releasing back to `height:
''` (auto) on complete.
5. Runs `Flip.from(state, { absolute: false, ... })` over the captured elements — `absolute:
false` so the boxes keep their layout space while transforms resolve, with the height tween
   supplying the room.

A single Flip call now covers both "this panel's tokens reflow" and "the other panel +
authorship reposition as units" — there is no second animation to coordinate with.

## Design Decisions

- `absolute: false` (vs. the old `withShiftAnimation`'s manual `getBoundingClientRect` diffing)
  relies on the height tween already running in lockstep to make room, so Flip doesn't need to
  rip elements out of flow.
- The cache lives inside `lineEdit` rather than as `$state` in `QuoteWorkbench` — this couples
  cache invalidation (text-keyed) to the same module that performs the mutation, removing one
  source of the old race (cache write and animation start were two separate call sites before).

## Future Considerations

`ebe1e26` (docs-only, immediately following) documents this module and the **edit-scope** term in
CLAUDE.md / `docs/line-mode.md` — see those for the canonical reference if this module evolves
further.
