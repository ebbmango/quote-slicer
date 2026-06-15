# Cross-zone keyboard navigation: scoping fix and unification

> Commits: `5271beb`
> Date: 2026-06-15

## Overview

Fixes a bug where `tokenGridNav`'s "find a default element to focus" fallback could
match an element in the *wrong* zone in line mode, and removes the mode restriction
on Alt+Enter / edge-Arrow cross-zone jumps so they work the same in every mode.

## Motivation

`tokenGridNav`'s `findDefaultEl` fallback builds a selector by string-prefixing
`config.itemSelector()` with the zone (e.g. `[data-zone="target"] .split-zone`). In
line mode `itemSelector()` is a comma-separated list (`.split-zone, .merge-zone,
.ws-split`), and string-prefixing only scopes the *first* branch — `.merge-zone`
and `.ws-split` were left unscoped and could match the other zone's elements.

Separately, `crossZoneJump()` gated Alt+Enter and edge-of-row Arrow jumps to
link mode only, for no clear reason — line mode users couldn't jump between
source and target with the keyboard.

## Implementation Details

- `tokenGridNav.ts`: `findDefaultEl` now queries the zone's container element
  first (`[data-zone="${zone}"]`), then runs `itemSelector()` *inside* that
  scoped element — correct regardless of how many comma branches the selector
  has.
- Removed `crossZoneJump` from `TokenGridNavConfig` entirely; Alt+Enter and
  edge Arrow-jumps now always cross zones.
- Plain (non-Alt) Enter/Space on a navigable element is now suppressed inside
  `tokenGridNav`'s `handleKeydown` itself, replacing four duplicated inline
  `onkeydown` handlers across `InteractiveSourceText.svelte` and
  `InteractiveTargetText.svelte`.
- `QuoteWorkbench.svelte`: in line mode, `onActivate` now re-focuses the same
  divisor after a split/merge — it reads `data-divisor-index` before calling
  `el.click()`, then after a `tick()` re-queries
  `[data-zone="${zone}"] [data-divisor-index="${divisorIndex}"]` and focuses
  it. Without this, activating a divisor via keyboard lost focus when the DOM
  re-rendered.
- Dropped the dead `.ws-boundary` class from `LINE_ITEM_SELECTOR` (no longer
  rendered).

## Areas to Be Careful

`findDefaultEl`'s two-step lookup (zone container, then `itemSelector()` inside
it) is the only thing preventing comma-separated selectors from leaking across
zones. If `itemSelector()` grows more comma branches, this scoping still holds —
but a regression here would silently put keyboard focus in the wrong zone with
no error, so it's easy to miss in review.
