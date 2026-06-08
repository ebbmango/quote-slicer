# Mapping Color Stability Across Sort-Order Changes

> Commits: `831aee2`
> Date: 2026-06-07

## Overview

Card colors were reassigning whenever the sort order changed, causing a visible flash. Each mapping now carries a `colorIndex` assigned at creation that never changes, decoupling color identity from list position.

## The Bug

Color was derived as `MAPPING_COLORS[index % length]` where `index` is the card's position in `sortedMappings`. When a new mapping was inserted at a lower position, every displaced card got a new `index` in the same reactive flush that also changed its active/inactive state. Both style changes landed simultaneously, giving CSS transitions nothing clean to animate from — producing a flash rather than a smooth color shift.

## Fix

Each `Mapping` object now has a `colorIndex: number` field set once at creation via a monotonic counter (`nextColorIndex`) on `LinkContext`. `Mapping.svelte` derives color from `mapping.colorIndex` rather than the positional `index` prop. Sort order still drives the label number; color is permanently tied to the mapping's identity.
