# Seamless Text→Token Handoff

> Commits: `4921932`, `62c5de3`
> Date: 2026-06-17

## Overview

The transition from text-entry mode to token mode no longer has a visible snap. Instead of
crossfading two DOM trees, each textarea pre-matches its token-mode appearance during the 450ms
arrow launch animation, so the DOM swap at 450ms lands on a screen that already looks like the
destination.

## Motivation

When the user clicks the arrow button to advance from text mode to link mode, Svelte replaces the
textarea block with the token grid at 450ms. Previously that swap was a hard cut — the textarea
disappeared and the tokens appeared with slightly different colours, sizes, or spacing, creating a
perceptible flash even though the text itself hadn't changed.

A crossfade overlay was considered but rejected: it requires keeping two DOM trees alive
simultaneously, coordinating their timings, and hiding whichever one is "behind." It also risks
flicker if the trees paint at different times. Pre-matching the textareas instead costs nothing
at mount and requires no extra DOM.

## Implementation Details

The technique has two parts: **geometry matching** and **colour matching**.

### Geometry

The source textarea carries `tracking-[2px]` (letter-spacing: 2px) and `translate-x-[1px]`.
The token row's effective per-pair gap is `gap-px` (1px), but each pair has a zero-width divisor
button between them, so the inter-glyph distance counts twice — net 2px per pair. The 1px
translate corrects for trailing letter-spacing, which would otherwise center the glyph block 1px
left of the trailing-free token row. Font size was also unified to `1.75rem` across all rendering
contexts (`4921932`) so textareas, token spans, and sidebar Mapping cards all share the same
baseline before the morph begins.

### Colour

Each textarea gets a `.morph-*` class and an `.exiting` modifier when `arrowExiting` becomes true
(bound from `+page.svelte`'s `arrowExiting` state). The CSS animates over 400ms ease-out — just
under the 450ms swap — so the animation settles flat before the DOM changes.

Three fields, three strategies:

- **Source** (`morph-source`): element stays at `opacity-30`, matching the token row's resting
  opacity. Only the *placeholder* colour rises to `currentColor` — typed text is already at the
  right level.
- **Authorship** (`morph-author`): same as source; element stays at `opacity-40`.
- **Target** (`morph-target`): element opacity stays at 1, so the dimming is carried by the *text
  colour* fading to `currentColor @ 30%`. The placeholder uses a fixed `rgb(0 0 0 / 0.5)` →
  `rgb(0 0 0 / 0.3)` path rather than `currentColor`, because the element's own colour is
  animating and referencing it from the placeholder would compound the two multipliers and produce
  a non-monotonic dip before settling.

`prefers-reduced-motion` keeps the pre-match (so the DOM swap is still seamless) but sets
`transition: none`, applying the `.exiting` state instantly on click rather than animating it.

## Areas to Be Careful

The geometry match is exact only because the divisor buttons between tokens are zero-width. If
divisor sizing ever changes, `tracking-[2px]` and `translate-x-[1px]` on the source textarea
will need to be recalculated. The comment in `QuoteWorkbench.svelte` calls this out.

The colour morph relies on each field's element opacity being stable during the animation — the
strategy breaks down if something else transitions `opacity` on the same element simultaneously.
