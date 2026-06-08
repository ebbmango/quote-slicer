# Mapping Card Theme Lookup Object

> Commits: `480abac`
> Date: 2026-06-08

## Overview

The `~12` inline `isActive ? color.A : color.B` ternaries scattered across `Mapping.svelte`'s style attributes were collapsed into a single `$derived` object called `theme`. Markup now reads `theme.cardBg`, `theme.botBg`, etc., rather than repeating the active/inactive branch everywhere.

## Implementation Details

`theme` is a `$derived` that returns one of two plain objects depending on `isActive`. Every named field (e.g. `cardBg`, `separator`, `tagBg`, `botText`) maps to the correct active or inactive color value from the `MappingColor` palette. Small derived values that depend on both `isActive` and `isEmpty` (`hanziOpacity`, `pinyinOpacity`, `deleteIconFill`, `deleteGlyphFill`) are kept as separate named deriveds rather than folded into `theme`, since they aren't pure active/inactive switches.

A `toggleActive()` helper was also extracted here to avoid repeating the `if (link.activeMappingId === mapping.id) link.deselect(); else link.activeMappingId = mapping.id` pattern in two event handlers.

## Areas to Be Careful

The `theme` object is the single source of truth for all card colors. Adding a new card element that needs active/inactive styling requires adding a field here — forgetting to do so means the element silently uses a hardcoded or incorrect color without a compiler error.
