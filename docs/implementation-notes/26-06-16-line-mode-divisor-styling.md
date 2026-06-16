# Line-Mode Divisor Visual Affordances

> Commits: `87d3622`, `ebf4cfa`, `e0bd4f2`, `58a0e4f`, `55425cc`  
> Date: 2026-06-16

## Overview

A cluster of commits gave line-mode divisors (split indicators and merge zones) their final visual treatment: running-palette coloring across both panels, slanted source split glyphs, wider hit zones, and a fade-out when leaving line mode. Together they make the editing affordances legible and polished without disrupting the GSAP Flip animation that runs on each edit.

## What Changed

### Running-palette coloring (`87d3622`, `58a0e4f`)

`divisorColor(ordinal, field)` in `colors.ts` maps a divisor's running ordinal to one of the 9 `MAPPING_COLORS` palette entries. Source-panel divisors take ordinals `0..N-1`; the target panel receives a `divisorOffset` (equal to `sourceTokens.length - 1`) so its divisors continue the sweep — the last source divisor and first target divisor are adjacent colors in the palette.

`DIVISOR_FIELD: keyof MappingColor` in each panel selects which shade of the palette color to use: source draws from `'source'`, target from `'target'`. This separation was introduced after an earlier version used `'base'` for both panels, making their divisors visually indistinguishable.

### Slanted source split glyphs (`ebf4cfa`)

Source split indicators are rendered as diagonal slash glyphs rather than vertical bars, distinguishing them from the target panel's indicators and reinforcing the directionality of the source text.

### Wider hit zones and indicator animation (`e0bd4f2`)

Split and merge zones originally had hit zones matching only the thin visible glyph — nearly untappable. The fix spans each hit zone across the full `~1em` inter-word gap.

The indicator itself moves with `--rd-x` during hover redistribution (the gap-spreading animation that opens space around a hovered divisor). Previously the hit zone moved with it, causing the pointer to leave the element mid-hover and immediately retrigger — a leave/enter flicker loop. The fix anchors the hit zone to its original position while only the visual indicator slides.

`redistribute.ts` gained an `rd-instant` class on the container during `clearRedistribute({ instant: true })` calls. CSS-animated indicator pseudo-elements (e.g. `::after`) can't be selected from JS, so suppressing their transition requires a class the panels' CSS gates on.

Merge zones are handled differently: the dashed line is raised above the token line-boxes via `position` so click and hover land on it directly rather than on the tall inter-line gap.

### Fade-out on mode exit (`55425cc`)

Each panel had its split and merge indicators appear instantly when entering line mode but snap off when leaving, which was jarring. A CSS transition (gated on `isLineMode`) now fades the indicators out when the user switches away from line mode.

## Design Decisions

- **`divisorOffset` passed from QuoteWorkbench**: the target panel can't know how many source divisors exist; the parent passes the offset so the palette sweep is computed correctly without coupling the panels to each other.
- **`DIVISOR_FIELD` as a named constant**: left as a hook for future differentiation (e.g., giving horizontal/vertical divisors distinct hues) without changing the call sites.
- **Hit zone anchored, indicator free**: separating the clickable region from the visual indicator is the only way to avoid the hover-flicker loop while keeping the spread animation. The hit zone stays put; `--rd-x` moves only the glyph.
- **`rd-instant` class rather than inline JS on pseudo-elements**: pseudo-elements are not reachable from `querySelectorAll`, so the container class is the only lever available to suppress their transitions during a snap-back.
