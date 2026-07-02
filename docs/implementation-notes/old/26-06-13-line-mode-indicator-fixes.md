# Line mode: indicator cleanup and pinyin-preserving split/merge

> Commits: `d0bf212`, `dd63b53`, `b63ecbb`
> Date: 2026-06-13

## Overview

Three related fixes to line mode: a visual rework of the split/merge
indicator lines, removal of a redundant merge affordance in the target panel,
and a fix for pinyin annotations getting dropped on the first source
split/merge.

## Motivation

The split/merge hairlines used `border-style: dashed`, which renders uneven
dash segments at the line ends. The target panel's boundary-whitespace token
also rendered two overlapping buttons that both triggered merge — one visible
text button (`.ws-boundary`) and one indicator zone (`.merge-zone`),
duplicating the same action. Separately, splitting or merging the _source_
text for the first time silently stripped pinyin from the affected tokens.

## Implementation Details

**Indicator dashing** (`d0bf212`): hairlines are now drawn with
`repeating-linear-gradient` instead of `border-style: dashed`, giving evenly
sized dash/gap segments. All tuning values — color, width, dash size, gap
size, idle/hover opacities — are centralized as CSS custom properties in
`src/routes/layout.css` (`--line-tool-*`), referenced from
`InteractiveSourceText.svelte` and `InteractiveTargetText.svelte`.

**Duplicate merge button** (`dd63b53`): `InteractiveTargetText.svelte`'s
boundary-whitespace branch rendered both a `.ws-boundary` button (text +
horizontal-line affordance) and a `.merge-zone` button. The `.ws-boundary`
button and its CSS were removed; the `.merge-zone` button's `data-flip-id`
was moved onto it (`tgt-{i}`) so the FLIP animation keeps tracking the
boundary token correctly.

**Pinyin preservation** (`b63ecbb`): `QuoteWorkbench.svelte`'s `splitSource`
and `mergeSource` previously called `splitAfterToken`/`mergeLines` on a local
derived `sourceTokens` array. On the very first split/merge, that array is
fresh `tokenize()` output with no pinyin — pinyin only exists in
`Alignment`'s reactive `sourceTokens` state (set via
`setSourceTokenPinyin`). Subsequent operations happened to read from a cached
array that shared Alignment's proxy, masking the bug. Both functions now
operate on a new `alignment.sourceTokenList` getter (`Alignment` in
`alignment.svelte.ts`), which returns the live, pinyin-bearing array.

## Areas to Be Careful

- `alignment.sourceTokenList` must stay the array that pinyin writes land on
  (`setSourceTokenPinyin`). If `Alignment`'s internal `sourceTokens` storage
  is ever restructured, `splitSource`/`mergeSource` need to be re-pointed at
  whatever holds live pinyin, or the original bug returns.
- Target-side split/merge wasn't affected (no pinyin on target tokens), so it
  still reads from the local derived array — don't assume source and target
  split/merge share the same data source.
