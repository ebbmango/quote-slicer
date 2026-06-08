# Mapping Keyboard Delete: Focus Fallback and Input Scoping

> Commits: `71d2d95`, `ea2df39`
> Date: 2026-06-08

## Overview

Two related keyboard-delete bugs fixed: deletion silently no-op'd right after creating a mapping, and Space/Enter/Escape from the pinyin input was being intercepted by the card's own keydown handler.

## The Bugs

**Focus fallback (`71d2d95`).** The document-level `keydown` handler for Backspace/Delete resolved the target by walking up from `document.activeElement` to find a `li[data-mapping-id]`. A freshly created mapping becomes `activeMappingId` in `LinkContext` immediately, but DOM focus stays on the source/target textarea — so the lookup found nothing and the keypress was silently swallowed. Fix: resolve as `focusedId ?? link.activeMappingId`, so deletion works even when the new card hasn't been tabbed to yet.

**Input scoping (`ea2df39`).** The card's `keydown` listener caught Space, Enter, and Escape bubbling up from the pinyin `<input>` inside the card, turning Space into a select/deselect toggle while the user was trying to type. Fix: bail out of the handler early when `e.target instanceof HTMLInputElement`. Also swapped `onfocusin`/`onfocusout` (which bubble) back to non-bubbling `onfocus`/`onblur` on the `<li>` so `isFocused` only reflects the card row itself, not nested inputs.
