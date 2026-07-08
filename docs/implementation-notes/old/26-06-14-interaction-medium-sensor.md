# Interaction medium sensor: gating hover vs focus styles by input device

> Commits: `02ecee4`, `539973f`
> Date: 2026-06-14

## Overview

Adds a global singleton, `interactionMedium` (`src/lib/context/interactionMedium.svelte.ts`), that
tracks whether the user is currently driving the app with a mouse or a keyboard, and wires it
into CSS so line-tool's split/merge "divisor" zones don't show both a hover highlight and a
focus highlight at once.

## Motivation

The split/merge divisors in `InteractiveSourceText.svelte` / `InteractiveTargetText.svelte` use
`:hover` and `:focus-visible` to reveal themselves. With both selectors active unconditionally, a
mouse-hover on one divisor and a Tab-focus on another divisor could both be highlighted
simultaneously — confusing when the user is mixing input methods (e.g. tabbing through tokens
while the mouse sits over a different divisor).

## Architecture

`interactionMedium` is a `$state` singleton with `current: 'mouse' | 'keyboard'`, plus `isMouse` /
`isKeyboard` getters and a `set()` method. `initInteractionMediumTracking()` attaches two document-level
listeners — `mousemove` → `'mouse'`, `Tab` keydown → `'keyboard'` — and is called once from
`src/routes/+layout.svelte` via a synchronous `onMount` (kept separate from the existing async
`onMount` that lazy-loads GSAP, since an async `onMount` returns a Promise and Svelte ignores the
cleanup function in that case).

## Implementation Details

The first commit (`02ecee4`) only updated the in-memory singleton — nothing consumed it yet. The
second commit (`539973f`) closes the loop: `set()` (and `initInteractionMediumTracking()` on init) now also
write `document.documentElement.dataset.interactionMedium = medium`. CSS in
`InteractiveSourceText.svelte` / `InteractiveTargetText.svelte` gates the divisor's `:hover` and
`:focus-visible` rules behind `:global(html[data-interaction-medium='mouse'])` and
`:global(html[data-interaction-medium='keyboard'])` respectively, so only the active input device's
affordance can be highlighted — no per-component imports of `interactionMedium` needed.

## Design Decisions

- Last-input-wins, and only `Tab` flips to keyboard medium (other keypresses are ignored) — this
  keeps the heuristic cheap and avoids flicker from e.g. arrow-key navigation while the mouse is
  idle over a token.
- Global singleton + `data-interaction-medium` attribute was chosen over a context/prop so the gating
  works in plain CSS without threading the medium through every interactive component.

## Future Considerations

CLAUDE.md's domain vocabulary table now documents this as **interaction medium**, distinct from the
app's **tool** (text/link/line/view) — see the note added directly above the Domain vocabulary
section warning against confusing the two.
