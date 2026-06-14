# Minimal-viewport modal: ref-race fix, two-column grid, forceClose reactivity

> Commits: `fd59b99`, `4fe54bc`, `81c0fd6`
> Date: 2026-06-13

## Overview

Three follow-up fixes to the
[minimal-viewport data modal](./26-06-13-minimal-viewport-data-modal.md): a teardown
race that could silently break scroll-to-mapping, a missing two-column breakpoint for
the modal's mapping grid, and a `forceClose` flag that wasn't actually reactive.

## Motivation

The modal feature introduced a second copy of `mappingsList()` (one in the aside, one
in the modal) that briefly coexist during a breakpoint force-close. The original
`bind:this={listEl}` couldn't express "only the surviving copy should own this ref,"
and the modal's mapping grid had no width-based column variant, unlike the tablet
aside it mirrors. Separately, the previous note had already flagged `forceClose` as a
plain (non-`$state`) variable read at transition time as an "unusual pattern" worth
revisiting.

## Implementation Details

**`listEl` ref ownership (`fd59b99`).** `bind:this={listEl}` let whichever
`mappingsList()` copy unmounted *last* clear `listEl`, even if the other copy was still
showing it — during a force-close, the modal and aside copies briefly coexist, so the
surviving aside's ref could get nulled and break `scrollCardIntoView` /
`handleListTab` until the next mutation. Replaced with a `use:listRef` action
(`src/routes/+page.svelte`):

```ts
function listRef(node: HTMLOListElement) {
	listEl = node;
	return {
		destroy() {
			if (listEl === node) listEl = undefined;
		}
	};
}
```

Only a destroying node that still owns `listEl` clears it, so the surviving copy's
claim isn't overwritten. `listEl` is now `HTMLOListElement | undefined = $state()`, and
all readers (`scrollCardIntoView`, `handleListTab`, `scrollToMapping`) guard on
`!listEl` and return early.

The same commit adds `data-testid="maps-aside"` / `"json-aside"` / `"maps-modal"` /
`"json-modal"` to the four toolbar buttons, since `aria-label="maps"`/`"json"` is
duplicated across the aside and modal variants (as flagged in the prior note) and
`getByLabel` would hit Playwright/axe strict-mode collisions.

**Modal two-column grid (`4fe54bc`).** The modal's `mappingsList()` had no width
breakpoint and stayed single-column even when wide enough for two. Added a
`modal-wide` custom variant in `layout.css`:

```css
@custom-variant modal-wide {
	@media (max-width: 899px) and (min-width: 600px) {
		@slot;
	}
}
```

applied to the same `grid-cols-[repeat(auto-fill,minmax(clamp(200px,...),1fr))]` used
by the tablet `tablet:` variant — matching the existing two-column threshold, but
width-only since the modal has no tall-portrait constraint to avoid.

**`forceClose` reactivity (`81c0fd6`).** `forceClose` was declared as a plain `let`,
not `$state`. Per the prior note's "Future Considerations," this was flagged as
unusual; in practice it meant the `out:fly` duration (`forceClose ? 0 : 450`) didn't
reliably reflect the latest value at transition start. Changed to
`let forceClose = $state(false)` so reads at transition time are reactive.

## Design Decisions

- Kept the action-based ref pattern (`use:listRef`) rather than restructuring so only
  one `mappingsList()` copy ever exists — the `{#if !minimal}` / force-close overlap is
  inherent to the slide-out animation and was already accepted as load-bearing in the
  prior note.

## Areas to Be Careful

- `listEl`'s ownership model now depends on action `destroy()` order matching mount
  order of the surviving copy — if a future change renders both `mappingsList()`
  copies without the `{#if !minimal}` guard for longer than one tick, the "still owns
  it" check could thrash between the two nodes.
- `data-testid` selectors are now the reliable way to target a specific aside/modal
  button; `getByLabel("maps")` / `getByLabel("json")` still matches both variants.
