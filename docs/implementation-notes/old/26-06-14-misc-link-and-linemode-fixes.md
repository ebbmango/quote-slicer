# Misc fixes: export whitespace, punctuation mappings, copyable spaces, indicator style, view-mode authorship

> Commits: `90d6f2e`, `45b1ba8`, `f3f14f8`, `a190a26`, `98c0356`
> Date: 2026-06-14

## Overview

Five small, independent fixes/tweaks that landed back-to-back on 2026-06-13, grouped here as one
note since each is too small for its own.

## Export meta whitespace sanitization (`90d6f2e`)

`Alignment.exportData.meta` previously passed `sourceText` / `targetText` / `authorship` through
unchanged, so newlines from the textareas leaked into the exported JSON's `meta` block. Now:
`sourceText.replace(/\n+/g, '')`, and `targetText` / `authorship` get
`.replace(/\n+/g, ' ').trim()` — source text drops newlines entirely (Han text has no
inter-word spaces), target/authorship collapse them to a single space and trim.

## Block mapping creation from punctuation/whitespace tokens (`45b1ba8`)

`Alignment.toggleTarget` already guarded against `type === 'whitespace'`, but
`toggleSource` had no equivalent guard — clicking a punctuation or whitespace source token could
spawn an empty mapping. Both `toggleSource` and `toggleTarget` now early-return when
`type === 'whitespace' || type === 'punctuation'`.

(This commit also adds `.claude/launch.json`, a dev-server launch config — unrelated to the
fix, no further action needed.)

## Whitespace tokens selectable as plain text (`f3f14f8`)

Target whitespace tokens (the inter-word gaps, used as split affordances in line mode) were
rendered as `<button>`. Browsers exclude `<button>` content from text selection/copy, so copying
target text collapsed multi-word spans into newlines (spaces lost). Whitespace tokens are now
`<span role="button">` with explicit `user-select: text` / `-webkit-user-select: text`, keeping
the split-click behavior (via `onclick` + `role="button"`) while making the space copyable.

## Solid skewed split/merge indicators (`a190a26`)

The split/merge zone indicators in both `InteractiveSourceText.svelte` and
`InteractiveTargetText.svelte` used a `repeating-linear-gradient` dash pattern that read as faint
dotted lines. Replaced with a solid `background: var(--line-tool-color)`, with the target
indicator additionally getting `skewX(-10deg)`. The merge-zone hover transition slowed from
200ms to 340ms and its hover-expanded width shrank from 100% to 30% (background-size multiplier
2x → 1.5x), so the merge indicator grows more gently on hover/focus.

## Disable authorship textarea in view mode (`98c0356`)

View mode (`'view'`) is meant to be read-only, but the authorship `<textarea>` in
`QuoteWorkbench.svelte` stayed editable. Added `disabled={mode.current === 'view'}` plus a
`disabled:cursor-default` class.
