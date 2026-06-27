# Line-mode divisor hover: gap redistribution instead of width-grow

> Commits: `df21f7a`, `8f0ef55`, `13184c3`, `dba9d7f`
> Date: 2026-06-15

## Overview

Reworks the hover feedback on line-mode split/merge divisors from a
layout-affecting width animation to a pure-transform gap redistribution, then
fixes the interaction between that redistribution and GSAP Flip during
split/merge.

## Motivation

Hovering a split/merge divisor animated the divisor's `width` — a layout
property. This reflowed every token to its right, so rapidly hovering across
several divisors made the whole line visibly pulse wider and narrower.
Separately, the divisor buttons were reachable via plain Tab, cluttering the
tab order (`df21f7a` removed them from it; activation is Alt+Space only via
`tokenGridNav`).

## Architecture

New module `src/lib/actions/redistribute.ts` exports two functions:

- **`redistributeRow(container, divisorIndex, { max, perGap })`** — on hover,
  opens the gap at `divisorIndex` by writing `transform: translateX(...)` (via
  a `--rd-x` custom property) to every token on that visual row, with all
  non-hovered gaps on the row shrinking by an equal share so the row's outer
  width stays constant (ends anchored). Divisor buttons themselves also get a
  `--rd-x` offset — the mean of their two flanking tokens' offsets — so their
  indicator stays centered in the resized gap.
- **`clearRedistribute(container, { instant? })`** — removes `--rd-x` from
  every `.tok`, `.split-zone`, `.ws-split`. `instant: true` suppresses the
  `transform` transition for one reflow (used right before a split/merge —
  see Design Decisions).

`InteractiveSourceText.svelte` and `InteractiveTargetText.svelte` wire
`onmouseenter`/`onmouseleave`/`onblur` on each divisor to
`redistributeRow`/`clearRedistribute`, and call `clearRedistribute(...,
{ instant: true })` in the merge/split click handlers before invoking
`handleMerge`/`handleSplit`.

## Implementation Details

The row is measured lazily on each hover-enter: all `.tok` elements are read
for `offsetTop` in one batch (no interleaved writes, so at most one reflow),
grouped into "the divisor's row" by matching `offsetTop` within 4px of the
divisor's left-flank token. Because measurement happens fresh on every hover,
resize/font-load/edits need no cache invalidation.

The redistribution math (`redistributeRow`): for a row of `m` tokens with the
hovered gap at local position `p`, the hovered gap opens by `delta` (capped at
`max`, scaled by `perGap` per borrowable neighbor gap) while each of the
`m - 2` other gaps shrinks by `delta / (m - 2)`. Per-token offsets are a
running sum of gap-deltas to their left; because the deltas sum to zero, both
row ends land back at offset 0 — only the interior shifts.

A divisor's `data-divisor-index` is the token index it sits *after* — for
source split-zones that's the left token's own index, but for target
`ws-split` it's the whitespace token's index strictly between two words. The
divisor's centering offset is computed by finding its flanking row tokens by
index comparison (not exact key match) to handle both cases uniformly.

`13184c3` additionally switched the keyboard-gated hover-indicator selectors
from `:focus-visible` to `:focus`, and made Alt+Arrow token navigation set
`interactionMode` to `'keyboard'` — without this, focusing a divisor via
keyboard didn't light up its indicator because `:focus-visible` wasn't
considered "keyboard interaction" by the existing CSS gating (see
`interactionMode` in `docs/file-map.md`).

## Design Decisions

**FLIP wobble (`dba9d7f`)**: giving `.tok`/`.ws-split`/`.split-zone` a
`transition: transform` rule (needed for the redistribution to animate
smoothly) collided with GSAP Flip, which also drives `transform` on those same
elements during split/merge. The CSS transition eased toward each intermediate
Flip frame, so the row visibly "danced" instead of sliding cleanly. Fixed two
ways:

1. A `.flipping` class (driven by `tokenStore`'s `animating` state, exposed as
   `store.animating` and passed down as the `animating` prop) drops the
   `transform` transition on `.tok`/`.split-zone` for the duration of the Flip
   — color/opacity transitions remain.
2. Before a split/merge fires, `clearRedistribute(lineContainer, { instant:
   true })` removes any live `--rd-x` hover offset *without* easing, so it
   isn't baked into Flip's "from" state and doesn't fight the Flip animation
   mid-flight.

**Pure transform, no reflow**: chosen specifically so hovering across many
divisors in quick succession can never trigger layout or change line wrapping
— the original bug this whole sequence fixes.

## Areas to Be Careful

- The `.flipping` / `animating` wiring is the only thing preventing the
  redistribution's CSS transition from fighting GSAP Flip. If a future change
  adds another `transform`-driven animation to `.tok`/`.split-zone`/`.ws-split`,
  it likely needs the same `.flipping` exclusion.
- `clearRedistribute(..., { instant: true })` must run *before* `handleSplit`/
  `handleMerge` — if a future refactor reorders these, the wobble can return.
- The row-grouping heuristic (`offsetTop` within 4px) assumes all tokens on a
  visual row share the same top within a few pixels; unusual font metrics or
  mixed line-heights could misgroup a row.
