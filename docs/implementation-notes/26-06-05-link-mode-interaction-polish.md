# Link Mode: Interaction Polish — Colors, Multi-Input, and Focus

> Commits: `b53d0d0`, `e2c5402`, `fbf12b4`
> Date: 2026-06-05

## Overview

A second pass over link mode refined three things: the color system gained per-role shades so source and target tokens in the same mapping look visually distinct; the source selection model was revised to match the one-source-per-mapping reality of classical Chinese; and keyboard focus received custom styling that doesn't intrude on pointer/touch users.

## Color Palette — Per-Role Shades

The initial palette was a flat array of single hex values. This was replaced with a `MappingColor` type (`colors.ts`) that holds three variants per color: `base`, `source`, and `target`. Each shade is a manually tuned, slightly darker version of the base — source tokens render distinctly from their corresponding target tokens even when both belong to the same active mapping.

`LinkContext.colorFor()` now returns a full `MappingColor` object; `getSourceTokenState` and `getTargetTokenState` each pick the appropriate `.source` or `.target` shade before returning it. Components receive a plain `color: string` and remain unaware of the distinction.

The `base` shade is retained in the data structure for potential future use (legend, palette swatches) but is not currently rendered.

## Source Selection Model

Classical Chinese is mostly uni-logographical: one character per concept. Allowing unconstrained many-to-many source selection would make the common case awkward — every click would silently accumulate characters into the same mapping. The model was revised so that the **default click creates a new mapping** once the active mapping already has a source character. Adding a second (or third) source to the same mapping requires an explicit modifier.

The modifier is exposed across three input modalities without a single shared key:

- **Mouse**: Cmd+click (Mac) / Ctrl+click (Windows/Linux) via `e.metaKey || e.ctrlKey`
- **Keyboard**: Option/Alt+Enter or Alt+Space via `e.altKey` — chosen because Cmd+Space and Ctrl+Space conflict with common OS shortcuts
- **Touch**: 500ms long press, implemented as a Svelte action (`longpress.ts`) that fires a custom `longpress` event and then captures and suppresses the `click` event that the browser fires immediately afterward (via a capture-phase listener), preventing a double-trigger

Punctuation tokens (Chinese `。，、` etc.) are fully excluded from interactivity: no `role`, no `tabindex`, no handlers. The `{@const interactive}` local variable in the template centralises this gate.

## Keyboard Focus Styles

Browser default focus outlines (`outline`) were suppressed. In their place, focused tokens reveal custom state:

- **Unmapped, focused**: opacity bumps from 30% to 50%
- **Mapped-idle, focused**: stays at 70% opacity but reveals its mapping's color (without focus, idle tokens show only the elevated opacity, no color)
- **Active, focused**: no change — already fully colored at 100%

The focus styles are gated on `:focus-visible` rather than plain `:focus`. This is the critical distinction: `:focus-visible` activates only when the browser determines the user is navigating by keyboard. A tap on a touch screen focuses an element but does not match `:focus-visible`, so touch users never see leftover focus styling after releasing a token.

## Design Decisions

**`idle` carries `color` even when not shown.** `TokenState`'s `idle` variant includes a `color` field so that the component can reveal it on keyboard focus without needing a separate context lookup. The component decides whether to apply it; the state machine always provides it.

**Long press suppresses its own click.** After the `longpress` timer fires, the `fired` flag is set. A capture-phase `click` listener checks this flag and calls `e.stopImmediatePropagation()` before Svelte's event handlers see the event. Without this, the long press would trigger both the multi-add action (correct) and a normal click (which would immediately re-evaluate the token as already-claimed and switch mappings instead of adding).

**Target tokens animate weight, source tokens do not.** Source Serif 4 (target font) is a variable font with a continuous `font-weight` axis, making 280ms `font-weight` transitions smooth and meaningful. Wenkai (source font) does not have the same variable axis, so transitions are not applied there.
