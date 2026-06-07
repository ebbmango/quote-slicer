# Mapping Card: Named Semantic Color Palette

> Commits: `df3e1f9`
> Date: 2026-06-05

## Overview

The `MappingColor` type gained nine named fields that cover every color need of a mapping card in
both its active and inactive states. `Mapping.svelte` now references these names directly instead
of computing colors inline with `color-mix()` calls scattered through the template.

## Motivation

Before this, the card template derived colors on the fly — things like
`color-mix(in srgb, {color.tagBgActive} 40%, transparent)` appeared directly in style attributes.
This made it hard to see what palette decisions had been made, hard to tune individual shades, and
hard to add new color-dependent UI elements without repeating the same arithmetic everywhere.

## Architecture

All nine per-color entries in `MAPPING_COLORS` (`src/lib/constants/colors.ts`) now declare:

| Field | Used for |
|---|---|
| `base` | Card background when active |
| `text` | Hanzi character color when active |
| `tagBgActive` / `tagBgInactive` | Numbered badge background |
| `tagNoInactive` | Badge text color when card is inactive |
| `botActive` / `botInactive` | Bottom translation bar background |
| `botTextActive` / `botTextInactive` | Bottom bar text |

A ninth field, `bgFocusInactive`, was also added in a subsequent commit but is currently marked
`// unused` — it was reserved for a focused-but-not-active card backdrop that was not yet wired up.

## Design Decisions

The decision to pre-compute all shades as constants rather than derive them at render time means the
palette is the single source of truth. Adjusting a color requires touching one entry in
`MAPPING_COLORS`, not hunting down `color-mix` calls across the template. The tradeoff is that the
constant file is verbose — nine fields × nine palette entries — but this is intentional: explicit
over clever.
