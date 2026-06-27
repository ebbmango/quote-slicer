# Line-Mode Two-Tap Touch Interaction

> Commits: `a35bf6e`  
> Date: 2026-06-16

## Overview

Touch devices had no way to trigger line-mode split/merge zones: the split indicators are zero-width and invisible without hover, and there is no hover on touch. This commit introduces a two-tap model — first tap highlights a divisor, second tap on the same one activates — mirroring the UX pattern already used elsewhere for touch-unfriendly precision targets.

## Motivation

Mouse/keyboard users hover or Tab to a divisor and click/Enter to activate. On touch, the pointer goes straight to `click` with no hover step, so the split indicator never appears and the hit zone is effectively invisible. The two-tap model substitutes for hover: tap once to "preview" the zone, tap again to commit.

## Architecture

`QuoteWorkbench` owns a single `touchedDivisor: { panel, index } | null` state. It passes `touchedDivisorIndex` (panel-scoped — `null` if the other panel holds the highlight) and `onTouchDivisor` / `onClearTouchDivisor` callbacks to each panel. This ensures only one divisor across both panels is highlighted at a time; switching panels automatically clears the previous one.

Each panel's `handleDivisorClick` branches on `isTouch` (from `interactionMode.svelte.ts`):

- **Mouse/keyboard**: activate immediately, no staging step.
- **Touch, different divisor**: call `onTouchDivisor(index)` to highlight; for split zones also call `redistributeRow()` to spread the row and widen the visual gap.
- **Touch, same divisor**: call `onClearTouchDivisor()` + activate.

A `$effect` in each panel collapses any spread left by a first-tap when `touchedDivisorIndex` drops back to `null` (tap-elsewhere, panel switch, or post-activate) — but only when `!animating`, so it never fights the Flip that runs during the actual edit.

## Design Decisions

- **Spread only for split zones**: merge zones already span the full inter-line gap; they don't need a visual spread to be tappable. Split zones are zero-width by default and need the `redistributeRow()` call to open up space.
- **State in QuoteWorkbench, not the panels**: both panels need to agree on what's highlighted so tapping a target divisor implicitly clears any source divisor highlight. A per-panel state would require cross-panel communication; lifting to the workbench is simpler.
- **`activate()` runs `clearRedistribute({ instant: true })` internally**: the spread snaps back exactly as the edit lands, so there's no visual jump between the spread state and the post-Flip layout.
- **Mode-exit reset**: a `$effect` in QuoteWorkbench clears `touchedDivisor` on leaving line mode, so stale highlights don't persist if the user switches modes.
