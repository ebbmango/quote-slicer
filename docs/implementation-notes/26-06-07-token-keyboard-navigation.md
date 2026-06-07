# Token Keyboard Navigation: Alt+Arrow and Cross-Zone Jumping

> Commits: `a17f988`, `8b4a0bb`
> Date: 2026-06-07

## Overview

Tokens in the source and target text views became fully keyboard-navigable without relying on the
browser's natural Tab order. Alt+Arrow moves focus between individual tokens using geometry-based
neighbor finding, Alt+Enter jumps between the source and target zones while remembering the last
position in each, and the system preserves Tab for coarser navigation between major UI areas.

## Motivation

Before this, each token had `tabindex=0`, putting every word in the natural tab sequence. A typical
quote has dozens of tokens, so tabbing through them to reach anything else was unusable. The
source and target views were also fully separate — no keyboard path connected them.

## Architecture

The central design decision is that tokens are **not** tab stops. Both `InteractiveSourceText` and
`InteractiveTargetText` set their token spans to `tabindex=-1`. Focus within the token area is
managed entirely by JavaScript in `QuoteWorkbench.svelte`.

A `tokenContainer` div wraps both text views. It has `tabindex=0` so it IS a tab stop — a single
entry point into the token area. All keyboard events relevant to token navigation are handled on
this container via `onkeydown={handleArrowNav}` and `onfocusin={handleFocusIn}`.

The authorship textarea is also inside `tokenContainer`, which means Tab exits the token area only
when the textarea itself is focused, not when a token is.

## Data Flow

### Entering the token area

When Tab brings focus to `tokenContainer` itself, the user is "at the door." The first Alt+Arrow
key moves them in:

- Alt+↓ or Alt+→ → focuses `all[0]` (first token in DOM order)
- Alt+↑ or Alt+← → focuses `all[all.length - 1]` (last token)

`all` is built by querying `tokenContainer.querySelectorAll('[role="option"]')` at the moment of
the keypress, so it always reflects the current rendered tokens.

### Left/right navigation

Alt+← and Alt+→ move through `all` by index — pure DOM order. In the source view this is
left-to-right across and down; in the target view the same applies. There is no boundary between
the source and target arrays: left/right navigation flows straight through from the last source
token into the first target token (and vice versa).

### Up/down navigation: `findVisualNeighbor`

Alt+↑ and Alt+↓ use geometry, not DOM order, because tokens wrap across lines. Moving "up" in
DOM order would skip to a token on a completely different visual row, not the one directly above.

`findVisualNeighbor(currentEl, all, dir)` works in four steps:

1. **Filter by direction.** Keep only tokens whose bounding rect is strictly above (bottom < current.top + 4px) or below (top > current.bottom - 4px). The 4px tolerance absorbs subpixel layout differences.

2. **Find the nearest row edge.** For downward movement, the nearest row is the one whose `top` is the minimum among candidates. For upward, it's the one whose `bottom` is the maximum. This identifies "the first row in that direction."

3. **Filter to that row.** Keep only candidates within 4px of that row edge. This isolates the single visual row immediately above or below.

4. **Pick the closest by center-x.** Among tokens on that row, return the one whose horizontal center is nearest to the current token's horizontal center.

This correctly handles variable-width CJK characters and reflowed lines — it always moves to the
token directly above or below in visual space, not just the nearest index.

### Zone crossing on up/down

When `findVisualNeighbor` returns `null` (no tokens in that direction), the handler checks whether
the current token is at a zone boundary:

- Alt+↓ at the bottom of the source view → `jumpTo('target')`
- Alt+↑ at the top of the target view → `jumpTo('source')`

This creates a continuous vertical navigation path from the first source token to the last target
token and back.

### Remembered positions: `jumpTo` and `handleFocusIn`

`lastSourceEl` and `lastTargetEl` record the most recently focused token in each zone.
`handleFocusIn` updates them on every `focusin` event inside `tokenContainer`, but only for
elements with `role="option"` (skipping focus on the container itself or the authorship textarea).

`getZone(el)` determines which zone an element belongs to by calling
`el.closest('[aria-label="Source tokens"]')` or `el.closest('[aria-label="Target tokens"]')`.

`jumpTo(zone)` resolves the target element in priority order:

1. The remembered element for that zone, if it's still in the DOM (`tokenContainer.contains(remembered)`).
2. `findDefaultToken(zone)`: the first word token in the zone that is currently unmapped.
3. `findDefaultToken` fallback: the first word token, mapped or not.
4. `null` — no tokens exist.

`findDefaultToken` locates the element by `data-token-index` attribute:
```js
tokenContainer.querySelector(`[aria-label="${label}"] [data-token-index="${idx}"]`)
```
`data-token-index` was added to token spans (in both `InteractiveSourceText` and
`InteractiveTargetText`) specifically to support this lookup — it stamps the logical array index
onto the DOM node.

The "first unmapped word" default is intentional: when jumping into a zone for the first time, the
most useful starting point is the next token that needs to be mapped, not an arbitrary position.

### Alt+Enter: explicit zone toggle

Alt+Enter calls `jumpTo` on the opposite zone. This works from anywhere:

- Focused on a source token → jump to remembered/default target position
- Focused on a target token → jump to remembered/default source position
- Focused on `tokenContainer` itself (not in either zone) → `getZone` returns `null`,
  which `zone === 'source'` evaluates to false, so it jumps to... source. The `null` case
  effectively defaults to source.

### Token selection: Alt+Space

In `a17f988`, token selection was changed from Space/Enter to **Alt+Space** (with Alt+Shift+Space
for force-adding a source token to the current mapping). The original Space/Enter shortcut
conflicted with standard page interaction (scrolling, button activation). Requiring Alt makes
all token keyboard actions unambiguous — no Alt key on a token = no token action.

## Design Decisions

**Tokens are not tab stops.** The alternative — keeping tokens in the Tab sequence — was tried
(they had `tabindex=0` before). The problem is that a typical quote has 15–40 tokens, making Tab
essentially unusable for reaching anything outside the token area. Removing them from the Tab
sequence and giving the container a single entry point keeps the keyboard flow sane.

**Geometry over DOM order for vertical movement.** Target text tokens wrap onto multiple lines
and their DOM order does not match visual rows. A DOM-order approach to "move up" would produce
nonsensical jumps. Using `getBoundingClientRect` gives the user what they expect: the token
directly above or below in visual space.

**Remembered position per zone.** A simpler design would always jump to the first unmapped token.
But if the user has been working in one zone, interrupted to toggle to the other, and then
Alt+Enters back, they expect to land where they left off — not restart from the beginning.

## Areas to Be Careful

`findVisualNeighbor` queries `getBoundingClientRect` on every token on every keypress. For very
long texts this could become a performance concern. It's not batched or memoized.

The 4px tolerance in row-edge filtering is a heuristic. It handles typical subpixel rendering
gaps but could theoretically fail at very small font sizes, unusual line heights, or when two
rows happen to be exactly 4px apart.

`lastSourceEl` and `lastTargetEl` are never cleared when tokens change (e.g., when the user
edits the source text). The `tokenContainer.contains(remembered)` check in `jumpTo` prevents
focusing a detached node, but if the user edits the text and the remembered element happens to
be re-created at the same position in the DOM, it may still be referenced. In practice this is
not a problem because editing switches the workbench back to textarea mode, resetting focus
naturally.
