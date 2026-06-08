# Mapping Card Template Unification and Delete Button Redesign

> Commits: `307d1d3`, `e8c6e6f`, `c8852f0`, `aa6b5ce`, `7b7e4df`
> Date: 2026-06-07

## Overview

A cluster of cosmetic and structural tidying on `Mapping.svelte`: the empty and populated card states were merged into one `{#each}` loop, the delete button was replaced with a backspace icon, the separator was simplified to a single full-width line, and two hover-flash bugs on the delete button were fixed.

## Implementation Details

**Template unification (`307d1d3`).** The card previously had two separate rendering branches — one for empty state, one for populated. Both rendered the same three-column grid structure. They were collapsed into a single `{#each}` loop driven by an `isEmpty` derived value (`EMPTY_ROW = [null]` when no source indices). Empty state shows 未定 as the hanzi placeholder and a disabled, greyed pinyin input; the badge is hidden rather than faked.

**Delete button (`e8c6e6f`).** Replaced a generic icon with the `delete-left` (⌫ backspace) icon from the icon set. Two SVG paths with separate fill values handle the outer icon shape and inner glyph independently, allowing the hover state to light up the glyph distinctly.

**Separator (`c8852f0`).** The divider between hanzi rows was simplified to a single absolutely positioned 1px `<div>` spanning the full card width, replacing a more elaborate previous approach.

**Ghost-hover flash (`aa6b5ce`, `7b7e4df`).** Two independent bugs caused a brief flash of the delete button during card deletion or hover. The fixes decouple `isButtonHovered` from Svelte's focus/blur events on the button and restore the native CSS `hover:opacity-100` approach so the transition has a clean baseline to animate from.
