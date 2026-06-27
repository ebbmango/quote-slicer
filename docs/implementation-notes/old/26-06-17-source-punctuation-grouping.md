# Source Token Punctuation Grouping

> Commits: `1523814`
> Date: 2026-06-17

## Overview

Source tokens are now grouped so that punctuation never wraps onto its own line away from the
character it belongs to. The grouper lives in `tokenize.ts` (`groupSourceTokens`) and the
rendering adapts in `InteractiveSourceText.svelte`, wrapping each group in a single non-breaking
flex container.

## Motivation

Classical Chinese punctuation — closing brackets, terminal marks (。，！？), opening brackets
(「『《【（) — is semantically attached to an adjacent base character. When the source panel wraps
across lines, punctuation that follows the last character on a line can orphan onto the next line,
breaking both readability and visual rhythm.

## Architecture

`groupSourceTokens(tokens)` in `tokenize.ts` returns `number[][]` — arrays of token indices,
one per group. Each group is a base token (character / number / symbol) with its glued leading
and/or trailing punctuation. Standalone punctuation with no adjacent base becomes its own
single-element group.

Classification uses Unicode property escapes: `\p{Ps}` (opening brackets) and `\p{Pi}` (initial
quotes) are **leading** punctuation that binds to the token that follows; everything else in the
`punctuation` type binds to the token that precedes it. This means the grouper derives each
punctuation mark's side from the character itself rather than a hand-maintained list.

In `InteractiveSourceText.svelte`, the flat `{#each tokens}` loop is replaced with `{#each groups}`.
Each group renders inside a `.tok-group` span (`display: inline-flex; flex-wrap: nowrap`) — an
atomic flex item of the outer wrapping row that lays its tokens out in a non-breaking inner row.
Intra-group divisors were removed in a later commit (`1898c48`); see
[`26-06-20-punctuation-atomic-line-splitting.md`](./26-06-20-punctuation-atomic-line-splitting.md).

## Design Decisions

**Divisors sit only between groups.** Each divisor is a direct child of the outer row, rendered
between group wrappers. No divisors exist inside `.tok-group` spans (intra-group divisors were
removed in `1898c48` to enforce the no-split invariant). All divisors remain `flex` items of the
outer row, so the hover/redistribution logic (`align-self: stretch`, net-zero margins) works
unchanged.

**Line boundaries stop grouping.** `groupSourceTokens` never crosses a `.line` boundary. If a
line-mode split lands between a character and its punctuation, they end up on different lines and
therefore in different groups — no re-grouping needed after a split, and no visual weirdness from a
group that spans a line boundary.

**No change to token IDs or mapping state.** Groups are a display-layer concern only. The underlying
`SourceToken[]` array is unchanged; `groupSourceTokens` returns index arrays, not new token objects.
Mapping, pinyin, and keyboard navigation all continue to operate on the flat token list.
