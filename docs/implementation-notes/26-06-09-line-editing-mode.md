# Line Editing Mode: Interactive Split and Merge

> Commits: `abeb93e`, `22aa98b`, `d19b66e`, `314a8d0`  
> Date: 2026-06-09

## Overview

Line editing mode (`'line'`) lets users interactively reorganize how tokens are grouped into lines after text has been entered. Source text (Chinese) can be split at any character boundary; translation text can be split or merged at whitespace positions. The feature is non-destructive: all alignment mappings survive any line reorganization because only `token.line` values are updated, never token indices.

## Motivation

The earlier toolbar had two sub-modes — `'part'` (split) and `'join'` (merge) — as separate modes under a shared "line" concept. This was awkward: the toolbar showed a floating sub-row that appeared and disappeared, tabindex management was complex, and neither sub-mode had any interactive UI backing it. Collapsing them into a single `'line'` mode cleared the way for a real implementation.

The deeper design challenge was that link-mode mappings (`LinkContext`) store token references as **array indices**. Any approach that dynamically inserts or removes tokens would shift those indices and corrupt existing alignments. The solution had to work entirely by reassigning `token.line` values on an immutable-length array.

## Architecture

Three layers cooperate:

**`src/lib/line.ts`** — pure data utilities with no UI dependency. `splitAfterToken(tokens, afterIndex)` returns a new token array where all tokens after `afterIndex` on the same line advance to `line + 1`, and all tokens on higher lines also advance. `mergeLines(tokens, lineN)` is the inverse. `groupByLine` partitions a flat token array into sorted per-line groups, each entry carrying the token and its original global index (needed to call `splitAfterToken` correctly from the view).

**`QuoteWorkbench`** — owns the token arrays as `$state` (changed from `$derived`) so that split/merge mutations persist. Two separate `$effect`s handle resets: one re-tokenizes when source/target text changes, the other syncs into `LinkContext`. Split/merge handlers reassign the state variables with the utility return values and are passed down as callbacks.

**`InteractiveSourceText` / `InteractiveTargetText`** — switch rendering entirely when `mode.current === 'line'`. In link mode they use the existing flat `{#each tokens}` loop with ARIA listbox semantics. In line mode they use `lineGroups` from `groupByLine` and render per-line `<div>`s containing tokens and interactive affordances.

## Implementation Details

**Source text split zones** are zero-layout-width `<button>` elements inserted between every adjacent token pair within a line. They use `width: 8px; margin: 0 -4px` so their 8px physical width contributes 0px to flex layout — they overlap 4px into each neighboring character without displacing anything. A thin vertical line appears on `:hover` via a child `<span>`.

**Target text split/merge** leverages the existing whitespace tokens rather than adding extra elements. A whitespace token that is the *last* in its line group and a next line exists is classified as a **boundary whitespace** — it was emitted by the tokenizer to represent a `\n` in the input. Hovering it shows a horizontal line (merge affordance). Clicking calls `onMerge`. Any other whitespace token shows a vertical line and calls `onSplit`. This works because `splitAfterToken` leaves the whitespace at the end of the first new line, and `mergeLines` returns it to mid-sentence where it belongs.

**Boundary whitespace emission** (in `tokenize.ts`): after tokenizing each non-last line segment, a `{ text: ' ', line, type: 'whitespace' }` token is appended. This token is invisible in link mode (trailing space in a flex container), but is available in the array from initial tokenization, so no dynamic insertion is ever needed.

## Design Decisions

**Immutable-length token arrays.** The constraint that mapping indices must not shift ruled out any approach that inserts/removes tokens at runtime. All line reorganization is expressed as reassignments of `token.line`. The boundary whitespace trick is a direct consequence: rather than inserting a space when merging two originally-`\n`-separated lines, the space token is pre-emitted at tokenization time.

**`$state` + reset `$effect` instead of `$derived` for tokens.** `$derived` recomputes whenever its inputs change, which would erase any user-made line edits whenever the source text changed. Switching to `$state` with a dedicated reset effect preserves line edits until the user actually modifies the text. Two separate effects (one per text input) avoid creating a circular dependency.

**Split/merge as callbacks, not prop mutation.** The interactive components receive `onSplit` and `onMerge` callbacks rather than a `$bindable` token array. This keeps mutation logic in `QuoteWorkbench` where the state lives, and avoids relying on Svelte's implicit prop-mutation semantics.

**Source splits at any character boundary; target splits only at whitespace.** Classical Chinese has no spaces, so the only natural split points are between characters. For the translation, whitespace tokens are already the semantic boundaries between words, and they double as the interactive affordances — no extra UI needed.

## Areas to Be Careful

`splitAfterToken` and `mergeLines` keep line numbers contiguous starting from 0 by incrementing/decrementing all higher lines on every operation. If any future code produces non-contiguous line numbers (e.g., a bulk import or a bug), `groupByLine` will still render them in sorted order but the split/merge math will produce incorrect results.

The boundary-whitespace classification in `InteractiveTargetText` is purely positional: a whitespace token is a boundary token if it is last in its line group. This means a user-initiated split at a mid-sentence space also leaves a whitespace at line end — which correctly becomes a boundary (merge affordance) for subsequent re-merging. This self-consistency is deliberate but easy to break if the position check is ever changed.

## Future Considerations

Touch device support was deferred. The original design called for a two-step interaction: tap a line to select it (revealing split zones), then tap a split zone to act. The pointer-device path (hover-to-reveal) is implemented; touch is not.

The `line` attribute is currently the only grouping dimension. A future "stanza" or "paragraph" grouping would require an additional attribute (`stanza: number` or similar) following the same flat-attribute pattern.
