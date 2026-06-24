# Mapping Palette Dark Variants

> Commits: `57ec2e9`, `e343e9b`, `8f4befd`, `f1665d9`, `ccebbb8`  
> Date: 2026-06-23

## Overview

`MappingColor` grew from a flat object to a `{ light, dark }` wrapper. All nine palette entries now carry separate color values for each scheme. `Mapping.svelte` selects the active variant from `appTheme.current` and passes it down as inline styles.

## Motivation

Inline styles on mapping cards can't be gated by a `.dark` CSS class (they're applied directly via `style="..."` attributes, not Tailwind utilities), so the light/dark split has to happen in script. Several color fields that were hardcoded for light mode — card background (`'white'`), inactive text (`'#555'`), active tag text (`'white'`) — also needed per-scheme values.

## Implementation Details

`MappingColorVariant` is the leaf type; `MappingColor` wraps two of them. `Mapping.svelte` derives `isDark` from `appTheme.current` and then `colorVariant = isDark ? color.dark : color.light`. The `theme` object used by the markup reads from `colorVariant` rather than `color` directly. Consumers outside Mapping.svelte (`divisorColor`, `deriveSourceTokenState`, `deriveTargetTokenState`) accept a `mode` parameter and do the same selection.

The tuning iterations (`e343e9b`, `f1665d9`, `ccebbb8`) corrected several initial values: inactive card backgrounds were too light in dark mode, `tagNoActive` was hardcoded `'white'` (broke light theme), and `botActive`/`botTextActive` values needed more saturation to read against the dark card background. `botText` opacity was also split by scheme (0.5 inactive / 0.3 empty for dark, 1.0 for light).
