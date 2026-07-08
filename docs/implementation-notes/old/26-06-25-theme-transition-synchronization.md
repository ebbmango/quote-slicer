# Theme Transition Synchronization

> Commits: `eb941ed`
> Date: 2026-06-25

## Overview

When the user toggles dark/light theme, different elements had different
transition durations — some finishing 220ms before others, producing a
visible stagger. This commit hunts down every mismatched duration,
repairs two browser quirks around `::placeholder` colour inheritance and
syntax-highlight palette selection, and introduces a gated window
(`html.theme-anim`) so fast-transitioning elements temporarily match the
slower page background.

## Motivation

The page background transitions over 500ms. Token `<span>` elements were
already using a 280ms colour transition (intentionally faster, for
tool-crossfade feel during arrow launch). On a theme toggle those tokens
settled 220ms ahead of everything else, making the panel look "done" while
the background was still animating. Several other elements had similar
mismatches: `PinyinInput` at 200ms, `Mapping` badge spans with no
`transition-colors` at all, and the JSON export panel hardcoded to
light-theme colours entirely.

## Implementation Details

### `html.theme-anim` gating window

`systemTheme.ts` now calls `flashThemeTransition()` whenever the theme
theme actually changes. This adds `theme-anim` to `<html>` for exactly
500ms, then removes it. Components whose elements normally transition
faster can opt in with a scoped rule:

```css
:global(html.theme-anim) .my-element {
	transition: color 500ms ease;
}
```

The token spans in `InteractiveSourceText` / `InteractiveTargetText` and
the `morph-target` textarea in `QuoteWorkbench` use this. The 280ms
tool-crossfade behaviour is untouched for normal arrow-launch transitions;
the wider window only fires during the theme-switch event.

### `::placeholder` and `currentColor`

`QuoteWorkbench`'s target textarea placeholder was using
`color-mix(in oklab, var(--page-fg) 50%, transparent)`. Browsers do not
re-resolve `light-dark()` (which `--page-fg` uses internally) on
`::placeholder` when `color-scheme` changes — the colour is frozen at
whatever value was computed at the time the style was first applied. The
fix is to use `currentColor` instead, which inherits through the normal
cascade and updates correctly on theme flip.

### JSON export panel dark palette

`JsonExportPanel.svelte` previously passed a hardcoded light-theme
`colorReplacements` object to `HighlightedCode`. It now derives the
palette from `appTheme.current`, mapping Dracula theme tokens to the
correct light/dark `MappingColor` shades for strings, numbers, and the
undefined sentinel, and to a dimmer neutral grey for properties, colons,
and brackets.

The `colorReplacements` object is hoisted to a `$derived` at the module
level rather than passed inline. An inline object literal is an
`ObjectExpression` — Svelte 5 wraps it in `$.derived()` and creates a
new reference on every parent render, which triggers a spurious
`codeToTokens()` call on every alignment change even when the palette
hasn't changed. The `$derived` breaks that cycle.

`HighlightedCode` was also updated to read all tokenizer inputs
(code + colorReplacements) within the `$effect` body so Svelte tracks
`colorReplacements` as a reactive dependency.

## Areas to Be Careful

The `html.theme-anim` window is 500ms and debounced (a second toggle
before expiry restarts the timer). CSS rules that gate on `.theme-anim`
must be carefully scoped — a rule that's too broad could slow transitions
in contexts where the fast feel is intentional.

The `currentColor` fix for `::placeholder` relies on `currentColor`
resolving to the computed colour of the element, not the placeholder's
own colour. If the element's colour is animated (as `.morph-target` is
during arrow-exit), the placeholder inherits that animation, which is the
correct behaviour here.
