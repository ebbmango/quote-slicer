# Mapping Card: Keyboard Access, Focus States, and Scoped Delete

> Commits: `e3717c3`, `91e87e8`, `09688ad`, `b8b025d`
> Date: 2026-06-07

## Overview

Mapping cards in the left sidebar became fully keyboard-accessible: each card tracks its own focus
state and renders a colored outline, Tab navigates the list with smooth scroll-anchoring, active
tokens darken when keyboard-focused, and the Delete/Backspace key deletes whichever card currently
holds focus (not necessarily the "active" one).

## Motivation

Before this work, cards were mouse-only. The delete button only appeared for the active card, was
only clickable, and deletion was always tied to `link.activeMappingId`. There was no visual
feedback when a card was focused via keyboard, and Tab would fall through to browser defaults
inside a scrolling container.

## Implementation Details

### Per-card focus tracking (`Mapping.svelte`)

Each card tracks `isFocused` as local `$state`. It sets to `true` on `onfocusin` and back to
`false` on `onfocusout` — but only when focus has genuinely left the card:

```js
onfocusout={(e) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) isFocused = false;
}}
```

The `e.relatedTarget` check is essential: `focusout` fires even when focus moves from the card
`<li>` into the pinyin `<input>` inside it. Without this guard, `isFocused` would flicker false
on every inward focus movement.

When focused, a `focus:outline-2 focus:outline-solid` outline appears in a color-mix of the card's
palette color, giving each card a unique focus ring that matches its badge.

### Gated pinyin input tab-index

The pinyin `<input>` inside each card uses `tabindex={isActive ? 0 : -1}`. This means Tab only
enters the pinyin field of the currently selected card. Cards that aren't active are skipped
entirely, preventing the user from accidentally tabbing into dozens of hidden inputs.

### Sidebar Tab handler (`+page.svelte`)

Default Tab behavior inside a scrolling `<ol>` is unpredictable — the browser may or may not
scroll to keep the focused element visible. The page replaces it entirely.

`handleListTab` intercepts all Tab events on the `<ol role="listbox">`:

1. Builds a live list of focusable elements: `li[tabindex="0"]` (card roots) and
   `input[tabindex="0"]` (pinyin inputs of the active card).
2. Finds the current focus position in that list.
3. Focuses the next (or previous, if Shift+Tab) element with `preventScroll: true`.
4. Then manually scrolls the container so the newly focused element sits within 20px of the
   container's edge:

```js
if (nextRect.bottom > containerRect.bottom - PADDING) {
    listEl.scrollTo({ top: listEl.scrollTop + nextRect.bottom - containerRect.bottom + PADDING, behavior: 'smooth' });
} else if (nextRect.top < containerRect.top + PADDING) {
    listEl.scrollTo({ top: listEl.scrollTop + nextRect.top - containerRect.top - PADDING, behavior: 'smooth' });
}
```

The 20px padding avoids the jarring experience of the focused card sitting flush against the
container edge. Using `preventScroll` on the focus call and then scrolling manually gives precise
control over the scroll position.

### Delete key and `deleteById`

`09688ad` added `deleteById(id: MappingId)` to `LinkContext`. Before this, only `deleteActive()`
existed, which required the mapping to be selected before it could be deleted. `deleteById`
decouples deletion from selection state.

The initial keyboard Delete/Backspace handler in `+page.svelte` still used `activeMappingId` as
the target. `b8b025d` fixed this to use the focused card's ID instead:

```js
const focusedId = (active?.closest('li[data-mapping-id]') as HTMLElement)?.dataset.mappingId;
if (!focusedId) return;
link.deleteById(focusedId);
```

`data-mapping-id` is stamped on each `<li>` in `Mapping.svelte`. The handler climbs the DOM from
`document.activeElement` to find the nearest mapping card, regardless of whether that card is
the "active" one. This means a user can Tab to any card and delete it without first clicking it
to make it active.

### Focus-brightness on tokens (`91e87e8`)

When a token is both active (part of a mapping) and keyboard-focused, it gets
`filter: brightness(0.75)`. This distinguishes "I have selected this token and my keyboard focus
is also here" from "this token is selected but I'm looking elsewhere". Without it, arrow-key
navigation through already-mapped tokens is visually ambiguous.

## Areas to Be Careful

The Tab handler in `handleListTab` queries `li[tabindex="0"]` and `input[tabindex="0"]` at
call time. If a new focusable element is added inside the list, it must either use one of those
selectors or the handler needs updating — it won't automatically include it.

The `e.relatedTarget` guard on `focusout` works correctly in all major browsers but relies on
the browser providing `relatedTarget` reliably. In some edge cases (focus leaving the page,
certain programmatic focus calls) `relatedTarget` may be `null`, which `contains(null)` handles
gracefully by returning `false` — causing `isFocused` to correctly reset.
