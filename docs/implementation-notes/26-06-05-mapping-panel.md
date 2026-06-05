# Mapping Panel: Sidebar List and Card Component

> Commits: `dca306b`, `f36868a`, `addb47d`
> Date: 2026-06-05

## Overview

This work brought the left sidebar to life as a scrollable list of mapping cards. Each card shows
the source hanzi characters, an editable pinyin field for each, the mapping's sequential number,
and the selected translation text in a bottom bar. Cards are ordered and colored by the position
of their first source token in the text, and the active card highlights and gains a delete button.

## Motivation

Before this work, `LinkContext` was only consumed by the two interactive token views. The user
could create mappings by clicking tokens, see those tokens highlighted, and switch between
mappings — but there was no panel showing what they had actually built. The left sidebar existed
in the layout but was empty HTML. Mappings also had no pinyin data slot, and their colors were
assigned at creation time, which meant deleting a mapping and creating a new one could produce
two adjacent cards with the same color.

## Context Wiring — The Hoist

The key prerequisite for a sidebar mapping list is that the sidebar and the workbench share the
same `LinkContext` instance. Previously, `QuoteWorkbench` called `setLinkContext()` itself, making
the context available only to its own subtree. The sidebar lives in `+page.svelte` as a sibling
of `QuoteWorkbench`, not a descendant — so it had no access.

The fix was to hoist `setLinkContext()` one level up to `+page.svelte`, where it now runs once
during page script initialization and returns the context instance:

```svelte
<!-- +page.svelte -->
const link = setLinkContext();
```

`QuoteWorkbench` then switches to `getLinkContext()` to read the context that its parent has
already established. Both the sidebar and the workbench now operate on the same `LinkContext`
instance, meaning mappings created by clicking tokens in the workbench appear immediately in
the sidebar, and clicking a card in the sidebar updates the active state seen by the token views.

## Token Sync into Context

The `Mapping` card needs to render token text and translation snippets, but the tokenized arrays
(`sourceTokens`, `targetTokens`) were previously local `$derived` state inside `QuoteWorkbench`
and not accessible to the sidebar. Rather than threading them as props through the layout,
`LinkContext` gained two new `$state` fields:

```ts
sourceTokens: RawSourceToken[] = $state([]);
targetTokens: RawTargetToken[] = $state([]);
```

`QuoteWorkbench` writes to these via a `$effect` that runs whenever its locally-derived arrays
change:

```svelte
$effect(() => {
    link.sourceTokens = sourceTokens;
    link.targetTokens = targetTokens;
});
```

This keeps the tokenization logic (and the text filtering, IME handling, etc.) inside
`QuoteWorkbench` where it belongs, while making the current token arrays available to any
context consumer. `Mapping.svelte` reads `link.sourceTokens[srcIdx]` to render the hanzi
character for each source slot, and walks `link.targetTokens` to build the translation preview
in the bottom bar.

## Text-Order Color Assignment

The original model assigned a `colorIndex` to each mapping at creation time
(`mappings.length % 9`). This caused a subtle annoyance: after deleting an early mapping and
creating a new one, the new mapping could get the same color as its neighbor, since the count
had already cycled.

The fix drops `colorIndex` from the `Mapping` type entirely. Instead, `LinkContext` derives a
`sortedMappings` array:

```ts
sortedMappings: Mapping[] = $derived(
    [...this.mappings].sort((a, b) => {
        const aMin = a.sourceIndices.length ? Math.min(...a.sourceIndices) : Infinity;
        const bMin = b.sourceIndices.length ? Math.min(...b.sourceIndices) : Infinity;
        return aMin - bMin;
    })
);
```

Color is then derived from a mapping's position in this sorted list — the first mapping by text
position gets color 0, the second gets color 1, and so on. `colorFor(m)` does
`sortedMappings.indexOf(m) % 9`, so both `getSourceTokenState` / `getTargetTokenState` (which
color the token views) and `Mapping.svelte` (which colors the cards) use the same rank. Adding,
removing, or reordering mappings causes all colors to update reactively and stay consistent
between the sidebar and the workbench.

Mappings with no source tokens (created by clicking target tokens first) sort last, using
`Infinity` as their sort key.

## Pinyin Slots

Each mapping now carries a `pinyin: string[]` array, parallel to `sourceIndices`. Each slot
corresponds to one source character and holds the user's typed transliteration. When a source
index is added to a mapping, an empty string is pushed; when removed, the corresponding entry
is filtered out by position. This is intentionally a separate array rather than an object to
keep mapping data flat and serializable.

The transliteration is currently a free-text input — the data structure is in place for when
automatic pinyin lookup is wired in.

## The Mapping Card Component

`Mapping.svelte` is a `<li role="option">` inside a `<ol role="listbox">` in the sidebar,
following the ARIA selection pattern established for the token views. Clicking the card (or
pressing Enter/Space) sets it as the active mapping; clicking the active card deselects it.

### Three-Column Grid

The card's top section is a CSS grid with three equal columns (`1fr 1fr 1fr`): hanzi, pinyin
input, and the badge/delete column. For multi-character mappings, the `{#each}` over
`sourceIndices` produces multiple hanzi and pinyin cells that auto-fill rows 1…N in columns 1
and 2. The badge cell is explicitly placed at `grid-column: 3` and `grid-row: 1 / span N`,
making it span all source rows in the third column.

The explicit column placement on the badge is load-bearing. The CSS grid auto-placement
algorithm processes items with an explicit `grid-row` (but auto column) *before* fully-auto
items, which means a badge with only `grid-row` set would be placed in column 1, pushing the
hanzi and pinyin cells to the right. Adding `grid-column: 3` forces it to the correct position.

### Row Separator Trick

Each row in the top section is separated by a 1px horizontal line. The naive approach —
`border-top` on each cell — would stop at column 2, leaving a gap in the badge column. Instead,
separator lines are `position: absolute` divs inside the `position: relative` top-section
container, spanning the full card width via `left: 0; right: 0`. Their vertical position is
computed as `top: i * ROW_H` where `ROW_H = 68` (the pixel equivalent of `h-17` at default
font size).

The badge cell has `position: relative; z-index: 1`, placing it above the absolute separators
in the stacking order. Critically, the badge cell itself has *no background* — this is what
allows the separator line to remain visible through the column. Only the badge pill (the colored
rounded chip) has a solid background, and because it is centered in its cell, it covers the
1px line exactly where the line meets the pill. The line is visible on both sides of the pill.

For two source rows, the single separator falls exactly at the midpoint of the badge cell, and
the centered pill covers it. For three or more rows, separators above and below the pill remain
visible in column 3, which is the intended behavior — they mark the row boundaries without
implying the line cuts through the number.

### Translation Preview

The bottom bar shows the mapping's selected target text as a quoted string. The computation in
`targetText()` handles the case where selected tokens are not contiguous: it sorts the
`targetIndices`, then groups them by adjacency — two indices are bridged into one group if the
gap between them contains only whitespace or punctuation tokens (and the gap is at most 5 tokens
wide). Each group is rendered as a contiguous text slice from `link.targetTokens` (from the
lowest index to the highest, inclusive, so the whitespace between selected words is included
naturally). Non-adjacent groups are joined with `", "`.

### Active vs. Idle Theming

Inactive cards have a white top section and a translucent tint of `color.base` for the bottom
bar. When a card is active, the top section background switches to `color.source` (the
mid-saturation variant) with white text, the badge pill uses `color.target` (the deepest
variant), and the bottom bar uses the full opacity `color.base`. A delete button (×) appears
in the badge column only when the card is active; it calls `link.deleteActive()` and stops
event propagation to avoid toggling the selection.

## Design Decisions

**Colors tied to text position, not creation order.** The old creation-order model made it easy
to get duplicate adjacent colors after deletions. The sorted-position model guarantees that
a card's color reflects where its source characters appear in the text — the first character in
the passage always has color 0 regardless of when it was mapped.

**Tokens in context, not props.** `sourceTokens` and `targetTokens` are written into
`LinkContext` rather than passed down as props. The token arrays need to be available to any
`Mapping` card anywhere in the context tree, and prop-threading through the layout would be
fragile as the component hierarchy grows.

**Pinyin as a parallel array.** Pinyin slots are stored as `string[]` rather than a map
keyed by source index. This keeps the data structure simple and avoids the need to clean up
stale keys when source indices change. The tradeoff is that the add/remove logic in
`clickSource` must maintain the parallel array carefully — inserting or removing at the correct
position — rather than just keying by index.

## Areas to Be Careful

**`ROW_H = 68` is a hardcoded constant.** The separator position calculation (`top: i * ROW_H`)
assumes each source row is exactly 68px tall, which is `h-17` at the browser's default 16px
root font size. If `h-17` is ever changed, or if the user's browser has a non-default root
font size, separator lines will misalign with row boundaries. A future improvement would be to
measure row height at runtime or use CSS-only separators instead.

**Color consistency depends on `sortedMappings.indexOf(m)`.** `indexOf` uses object identity.
Since `sortedMappings` is derived from `this.mappings` by spreading and sorting, the references
point to the same objects, so identity is stable. If the `mappings` array were ever replaced
with a deep copy (e.g., deserialized from storage), `indexOf` would return `-1` for every
mapping and all colors would collapse to index 0.

## Future Considerations

The `pinyin` field is wired and maintained but all inputs are currently free-text. The data
model is ready to be driven by an automatic lookup (e.g., from the `Transliteration` field
on `SourceToken` in `quote.tsx`) or to allow per-mapping overrides for polyphonic characters
once that data path is built.
