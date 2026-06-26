# Interactive panel structural asymmetry is intentional

`InteractiveSourceText` and `InteractiveTargetText` have two structural differences that
look like accidental divergence but are load-bearing. Do not flatten them.

## Decision

Keep the two DOM layout differences as-is. They are not duplication — they are the minimum
adaptation of the shared `LineDivisor` interface to structurally different token streams.

## Asymmetry 1: scroll box vs row container are separate in source, merged in target

**Source** has two nested refs:

- `container` — the scrollbox (`data-scrollbox`, `overflow-y-auto`). Passed to the
  token store so it can tween the panel height during a split/merge.
- `lineContainer` — the inner flex row. Passed to `LineDivisor` (as `container`) so
  `redistribute.ts` can write `--rd-x` to `.tok` / `.split-zone` / `.ws-split` nodes.

**Target** has one ref (`lineContainer`) that serves both roles.

**Why they differ:** source tokens are wrapped inside a punctuation-grouping `<span>`
(`.tok-group`) so glued punctuation never wraps off its base character. That wrapper is an
extra DOM layer between the scrollbox and the token row, so the scrollbox and the flex row
must be separate elements. Target tokens are a flat list with no grouping wrappers — the
flex row that redistributes tokens is the same element that the store height-tweens.

## Asymmetry 2: ordinal assignment (sequential index vs dense whitespace map)

**Source** computes divisor ordinals as `group[group.length - 1]` — the last token index
of each group. This is monotonically increasing and directly usable as a palette ordinal
because every group boundary is a valid divisor.

**Target** builds `divisorOrdinal: Map<number, number>` — mapping each whitespace token's
flat array index to a dense running counter offset by `divisorOffset`.

**Why they differ:** in the source panel, divisors fall between token groups, so their
indices naturally form a dense sequence. In the target panel, whitespace tokens are sparse
in the flat array (non-whitespace tokens sit between them); using their raw indices as
ordinals would leave large gaps in the palette and misalign the color sweep across both
panels. The map is the correct data structure.

## Consequence

Architecture reviews should not flag these as duplication or propose unifying the two panel
implementations further than the current `LineDivisor` extraction. The shared interface
(`LineDivisor` + the `onSplit`/`onMerge` prop contract) already captures everything that is
genuinely common. What remains differs because the underlying token structures differ.
