# Punctuation Made Atomic for Line Splitting

> Commits: `1898c48`  
> Date: 2026-06-20

## Overview

Intra-group split-zone divisors are removed from the source panel. A base token
and its glued punctuation now form an **unsplittable unit**: you can break a line
before the group or after it, but never inside it. The grouping that already
prevented visual wrapping now prevents editorial splitting as well.

## Motivation

`groupSourceTokens` (added in commit `1523814`) placed punctuation and its base
token inside a single non-breaking `.tok-group` flex container, so the two could
never _wrap_ onto different visual rows. But split-zone divisors still lived
**inside** the group between each token pair, which meant a user could explicitly
split the line there — orphaning `，` or `。` at the start of a new line. That
is typographically wrong for CJK: punctuation should always trail its character,
never lead the next line.

A richer approach was considered first: let users click the punctuation itself to
**toggle its inclusion** in the export (fade it rather than delete it, so the
layout stays stable and GSAP Flip can still reference the element). That path was
designed in full but dropped — the user affordance is small relative to the
data-model and export-path work it requires. See
[`docs/future-features.md`](../future-features.md) for the full design if it ever
becomes worth revisiting.

## Implementation

The change is a one-line template deletion in `InteractiveSourceText.svelte`: the
`{#if gi < group.length - 1}` block that rendered divisors between tokens within
a group is removed. Only the divisor rendered **after** the whole group (between
group wrappers, as a direct child of the outer row) remains. The data model,
token IDs, and GSAP Flip paths are untouched.

The removal is dimensionally safe: `.tok-group` has no `gap`, and the old
intra-group divisor was `width: 1em; margin: 0 -0.5em` — net-zero, no
contribution to layout. The seamless text→token morph handoff relies on
between-group divisors, which are unchanged.

## Focus-Restore Edge Case

Removing intra-group divisors introduced one keyboard regression. When a user
keyboard-merges a line break that sits between a hanzi and a **newline-orphaned**
trailing punctuation (e.g. source text `好\n。`), the merge recombines them into
one group, making the just-merged divisor's `data-divisor-index` index vanish
from the DOM (it is now intra-group and unrendered). The post-merge focus-restore
in `QuoteWorkbench.svelte` — which looked up the divisor by index after `tick()`
— found nothing and dropped focus to `<body>`.

The fix adds a fallback: when the primary lookup returns null, the code finds the
nearest rendered divisor at or before the original index and focuses that instead.
The fallback is purely additive and does not touch the normal path (where the
divisor still exists after a merge).

## Areas to Be Careful

The note in [`26-06-17-source-punctuation-grouping.md`](./26-06-17-source-punctuation-grouping.md)
states: "line boundaries stop grouping — `groupSourceTokens` never crosses a
`.line` boundary." This invariant is now more load-bearing: a split that fires at
an inter-group divisor is guaranteed to land on a group boundary (where `.line`
values differ), so `splitAfterToken` always operates correctly. If the grouping
logic ever changes to cross line boundaries, intra-group splits would need to be
re-examined.
