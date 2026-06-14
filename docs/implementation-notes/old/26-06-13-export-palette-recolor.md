# Export panel: recolor Shiki JSON with mapping palette

> Commits: `e679881`
> Date: 2026-06-13

## Overview

The sidebar's JSON export (`exportJson` in `+page.svelte`, rendered by
`HighlightedCode.svelte`) now uses the app's mapping color palette instead of
Shiki's default theme colors, so the export panel feels visually consistent
with the rest of the UI rather than like a generic code preview.

## Implementation Details

`HighlightedCode` gains an optional `colorReplacements` prop, forwarded
directly to Shiki's `codeToTokens({ lang, theme, colorReplacements })`. The
base theme switched from `github-light` to `dracula` — dracula's token colors
are well-known hex values, which makes them easy to target with replacements.

`+page.svelte` passes a `colorReplacements.dracula` map that swaps dracula's
hardcoded hex codes for the app's palette:

- string color (`#f1fa8c`/`#e9f284`) → `colors.compostella.base`
- property/key colors (`#8be9fe`/`#8be9fd`), punctuation (`#ff79c6`/`#f8f8f2`)
  → flat `#A8A8A8`
- number color (`#bd93f9`) → `colors.azure.base`
- the `undefined` literal color (`#ff5555`, used for unannotated pinyin) →
  `colors.sugar.base`

`src/lib/constants/colors.ts` gains `MAPPING_COLOR_NAMES` (an ordered tuple of
palette names) and a `colors` lookup object (`Record<MappingColorName,
MappingColor>`) built from it, so palette entries can be referenced by name
(`colors.azure.base`) instead of by index into `MAPPING_COLORS`.

## Design Decisions

- Replacement is done by literal hex-string matching against a fixed theme
  (dracula), not by re-deriving a custom Shiki theme. Simple, but brittle —
  see below.

## Areas to Be Careful

- The `colorReplacements.dracula` map is keyed on dracula's exact token hex
  values. If Shiki updates the dracula theme's palette, or the base theme is
  changed, these replacements silently stop matching and the export reverts
  to dracula's raw colors.
- Two hex variants are listed for some roles (`#f1fa8c`/`#e9f284`,
  `#8be9fe`/`#8be9fd`) — Shiki appears to use slightly different shades for
  different token types that read as the same color; both must be kept in
  sync if the palette mapping changes.
