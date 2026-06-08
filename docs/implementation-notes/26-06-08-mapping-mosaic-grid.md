# Mapping List: Quantized Card Sizing and Tablet Mosaic Grid

> Commits: `15c61a9`
> Date: 2026-06-08

## Overview

The mapping sidebar list switches from a single-column flexbox to a CSS grid layout. Cards are assigned quantized heights based on their hanzi count, enabling perfect mosaic packing on tablet: a card with more hanzi spans more grid rows, and any combination of cards tiles without gaps. On narrow screens the layout remains a single column; the mosaic only activates when the aside is wide enough to fit two 200px-minimum columns.

## Motivation

The previous `flex-col` layout scaled card height linearly with hanzi count — every additional character added another 68px row. This was fine for a single column, but any two-column layout would produce jagged bottom edges because cards of different heights leave empty space in the shorter column. A mosaic (masonry-like) layout would avoid this, but CSS-native masonry (`grid-template-rows: masonry`) is Firefox-only behind a flag, and JavaScript-driven height measurement adds reactivity complexity and SSR/hydration complications.

The solution is to quantize card heights into a discrete set of sizes that are all integer multiples of a base track unit. Cards with 1 hanzi span 1 track; 2–3 hanzi span 2 tracks; 4–5 span 3; and so on. Within each bracket, cards are the same height regardless of exact hanzi count. This makes perfect tiling achievable with plain CSS grid and no JS measurement.

## Architecture

**The quantization formula.** A card containing `H` hanzi spans `r = floor(H/2) + 1` grid rows. Cards with 2 and 3 hanzi are both `r=2`; cards with 4 and 5 are both `r=3`. The bracket pairs consecutive odd/even counts, so any adjacent pair of cards with the same bracket can stack in two columns without leaving a gap.

**The tiling identity.** Let `B` be the height of a single-hanzi card's top section, `b` the fixed bottom-bar height, and `g` the gap between cards. A card spanning `r` grid rows must occupy exactly:

```
r*(B+b) + (r-1)*g
```

This is precisely what CSS grid produces natively for `grid-row: span r` when `grid-auto-rows` is set to `(B+b)` and `gap` is `g` — no explicit `height: calc(...)` needed on the card. The outer grid's stretch alignment forces each card to exactly that height automatically.

Inside the card, the top section is now `flex-1` (fills the stretch height minus the fixed bottom bar) and uses `grid-template-rows: repeat(rowCount, 1fr)` to distribute the actual `H` hanzi rows evenly within the quantized height. This is why two cards with different hanzi counts in the same bracket look slightly different internally (row spacing differs) but are identical in total height.

**The two-column rule.** The `<ol>` uses `grid-template-columns: 1fr` on all breakpoints and adds a `tablet:` override:

```
repeat(auto-fill, minmax(clamp(200px, calc(50% - gap/2), 100%), 1fr))
```

The `clamp` forces a maximum of two columns: when the aside is ≥ 412px (2 × 200px + 12px gap), each column is `~50%` wide and two fit; below 412px, the minimum of 200px exceeds 50% of the container, so only one column fits. `auto-fill` handles the transition without container queries or JavaScript.

**Breakpoint scoping.** The `tablet` variant was added to `layout.css` as a `@custom-variant` mirroring the existing `@media (orientation: portrait) and (min-height: 1000px) and (max-width: 899px)` rule already used for the stacked panel layout. This makes `tablet:` available as a Tailwind prefix alongside the existing `touch:` and `mouse:` variants.

**No breakpoint logic in the card.** `Mapping.svelte` has zero knowledge of the current breakpoint. Card sizing — the `grid-row: span r`, the `flex-1` top section, the `1fr` internal rows — applies at all screen sizes. Only the `<ol>` column count changes at the tablet breakpoint.

## Design Decisions

**Quantization over exact sizing.** Exact-height masonry would require measuring each card's rendered height in JS and recomputing placement on every resize and content change. Quantization eliminates measurement entirely: the formula is computed from `rowCount`, which is already available as a reactive derived value. The tradeoff is that cards within the same bracket have slightly variable internal row spacing — acceptable given the visual consistency of the card structure.

**`grid-auto-flow: row` (default), not `dense`.** CSS `grid-auto-flow: dense` would backfill earlier gaps with later items, potentially reordering cards visually relative to their source order. Since keyboard navigation (Tab, Delete) follows source order, visual reordering would create a mismatch. Source-order placement may leave occasional one-cell gaps at the bottom of the grid, but these are rare and less harmful than nav/visual mismatches.

**Separator positioning updated to percentages.** The divisor lines between hanzi rows inside the top section were previously positioned at `i * ROW_H px` (a pixel constant tied to the old fixed `h-17` row height). With variable row heights driven by `grid-template-rows: 1fr`, they now use `calc(i / rowCount * 100%)` — percentage of the top section's actual rendered height.

## Future Considerations

The `r = floor(H/2) + 1` computation is a one-liner JS `$derived`. The CSS `sibling-count()` function (CSS Values 5, shipped Chrome/Edge 137+, Safari 26.2, not yet Firefox) would eventually allow deriving `r` entirely in CSS from the number of hanzi cells, eliminating the JS side. This is not a priority but worth tracking.
