# Alignment: setPinyin keyed by tokenId, freed color slots reused

> Commits: `f096bbc`, `2aafb71`
> Date: 2026-07-02

## Overview

Two small behavioral corrections in `Alignment`
(`src/lib/context/alignment.svelte.ts`), both enabled by the new client-project
unit tests: pinyin edits are now addressed by stable token ID instead of
positional index, and new mappings take the lowest *free* palette slot instead
of burning a fresh one on every create.

## Motivation

**setPinyin.** The method took a `position` that indexed into the mapping's
`sourceTokenIds`. A comment left in the code had already flagged the fragility
("if pinyin edits ever commit to the wrong token, look here first"): after a
reorder, split, or merge, the position could resolve to a different token than
the one the user edited. The caller — the pinyin field in `Mapping.svelte` —
already holds the stable `entry.tokenId`, so the indirection bought nothing.

**Color assignment.** `createMapping` drew from a monotonic `nextColorIndex`
counter. Deleting a mapping never released its palette slot, so a
delete-then-recreate workflow drifted the colors forward through the palette
instead of giving the new mapping the color the deleted one freed.

## Design Decisions

- `setPinyin(id, tokenId, value)` ignores a `tokenId` not present in the
  mapping's `sourceTokenIds` — a silent no-op rather than a throw, matching the
  method's role as a UI commit handler. This closes out the fragility comment
  and brings the method in line with the repo-wide invariant that `Mapping`
  stores stable IDs, never indices.
- The new color assignment scans current mappings for the lowest unused
  `colorIndex`. This removed the `nextColorIndex` `$state` field entirely —
  color choice is now derived from the mappings array rather than tracked as
  separate persistent state, so there is nothing extra to keep consistent.
  Wraparound semantics downstream (palette lookup modulo palette size) are
  unchanged.
- The scan builds a plain `Set` per call (with an eslint-disable for
  `svelte/prefer-svelte-reactivity`) — it is never mutated after construction
  and never observed reactively, so a reactive `SvelteSet` would be waste.
