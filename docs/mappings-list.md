# Mappings List & Card Animations

The sidebar `<ol>` of mapping cards (`MappingsList.svelte`) animates additions and
deletions with GSAP's Flip plugin. This page covers _why_ the animation is built the
way it is, the add/delete sequencing, the touch swipe-to-delete gesture, the scroll
timing, and the one re-entrancy rule that the whole system hinges on.

For the card component itself (`Mapping.svelte`, which stays free of GSAP), see
[UI Architecture](ui-architecture.md#mappingsvelte).

## Why a hand-rolled Flip system

Without animation, adding or deleting a card makes the list jump — cards teleport to
new grid positions with no continuity. Svelte's built-in `animate:flip` can't express
what this list needs:

- **Column-direction awareness** — in `bottom` and roomier `drawer` surfaces the grid
  is two columns; a left-column card should slide left, a right-column card right.
- **Out→close sequencing** — the leaving card slides out _first_, then the survivors
  flow closed to fill the gap.
- **A ripple** — the gap-close staggers outward from the deleted card's position.

So all animation logic lives in `MappingsList.svelte`. `Mapping.svelte` is kept thin:
it only receives and applies the `exit` transition function and the
`onoutrostart`/`onoutroend` lifecycle callbacks as props, keeping GSAP entirely out of
the card component.

GSAP and the Flip plugin are lazy-loaded in `onMount` (the app prerenders statically).
A `canAnimate()` guard checks that both are loaded, the list is visible, and
`prefers-reduced-motion` is not set. Timing constants live in a single labelled
**tunables block** near the top of the script (`SLIDE`, `MAKEWAY_S`, `ENTER_S`,
`GAP_DELAY`, `EXIT_MS`, `CLOSE_S`, `STAGGER`); two-column layouts read their longer
durations live from `getComputedStyle` so they follow the resolved grid rather than
repeating its layout rules in animation code.

## Add path (make-way, then slide-in)

1. An `$effect.pre` (runs _before_ the DOM patch) diffs the current
   `sortedMappingViews` IDs against the previous set to detect a single new ID, then
   `Flip.getState(existingCards)` snapshots neighbour positions before Svelte inserts
   the new card. The snapshot and new ID are stored in plain `let` variables.
2. A post-update `$effect` calls `runAdd(id, state)`. The new card is in the DOM but
   not yet painted; `runAdd` immediately hides it (`opacity: 0, x: dir * SLIDE`) so it
   never flashes at rest, then runs `Flip.from(state, …)` to animate the neighbours
   from their old positions into the room-made layout (the new card is absent from the
   snapshot, so Flip ignores it).
3. After `GAP_DELAY` — so the gap is already opening when the card arrives — the new
   card slides in (`gsap.to(card, { opacity: 1, x: 0 })`).

On an empty list there are no neighbours to snapshot, so `state` is `null` and only the
slide-in runs.

## Delete path (slide-out, then gap-close ripple)

Deletion is driven by Svelte's `out:exit` (a custom transition, not the built-in). The
key insight: **while the leaving card is still in the DOM it holds its grid slot**, so
neighbours stay in their open positions until the slide finishes.

1. `out:exit` slides the leaving card to its column edge over `EXIT_MS`.
2. `onoutroend` fires `onExitEnd` while the card is invisible but still in flow:
   - `Flip.getState(survivors)` — snapshot survivors at their open-gap positions.
   - `node.style.display = 'none'` — pulls the card out of flow, so the grid reflows
     the survivors closed **synchronously, in the same call stack**.
   - `Flip.from(state, …)` — animate survivors from the snapshot (open) to where the
     grid just placed them (closed), with a stagger rippling outward from the deleted
     index.

Both the snapshot and the reflow happen before the browser paints, so the close is
frame-perfect — no teleport, no timing reliance.

### Interruption safety

Rapid create/destroy (clicking the same token repeatedly) overlaps animations, which
required explicit handling: `runAdd` always `killAdd()`s any in-flight add first;
deleting the card currently sliding in settles its add tween before the exit takes the
node; a concurrent add+delete `killAdd()`s before the gap-close snapshot so survivors
are captured at rest; deleting the last card early-returns on `survivors.length === 0`
(an empty `Flip.from([])` never fires `onComplete`, which would pin `closing > 0`
forever); and concurrent deletes each push their own tween into `closeTweens[]` without
cancelling each other (all killed on `onDestroy`).

## The re-entrancy freeze bug (and the rule it established)

Rapidly toggling one token — create on odd clicks, delete on even — used to **freeze
the whole app** after ~10 clicks: tool switches stopped rendering, the JSON export went
stale, yet no exception was thrown and the main thread wasn't pegged. Derived values
had simply stopped updating, app-wide.

**Root cause:** GSAP's ticker can advance **synchronously** inside `Flip.from()` (it
ticks forward to flush already-complete tweens before returning). Under overlapping
deletes, calling `Flip.from()` for one card's gap-close advanced the ticker, which fired
a _previous_ gap-close's `onComplete` — **synchronously, while Svelte was mid-flush**
(because `onExitEnd` is itself called from Svelte's outro machinery, part of a flush).
That `onComplete` wrote `closing` (a `$state`). **Writing `$state` re-entrantly during
an in-progress Svelte flush silently corrupts the reactive scheduler** — no error, the
flush just stops committing, and every derived value freezes.

**Fix:** wrap the gap-close `onComplete` body in `queueMicrotask`, deferring the
`$state` write until the current flush has unwound:

```js
onComplete: () => {
	queueMicrotask(() => {
		closeTweens = closeTweens.filter((t) => t !== tween);
		closing = Math.max(0, closing - 1);
		// …
	});
};
```

> **The general rule:** never mutate a Svelte `$state` variable synchronously inside a
> GSAP callback (`onComplete`, `onUpdate`, `onStart`). GSAP can advance its ticker
> synchronously during `Flip.from()`, `tween.kill()`, and similar, so any such callback
> can fire re-entrantly mid-flush. Defer the write with `queueMicrotask`. Writing
> `$state` from Svelte's _own_ outro handlers (`onoutrostart`/`onoutroend`) is fine —
> that's why `outroing++` stays synchronous while only the `closing` decrement is
> deferred.

## The `listAnimating` mutation throttle

The `queueMicrotask` fix stops GSAP callbacks from writing `$state` mid-flush, but it
doesn't stop the **user** from issuing a second create/delete while a card is still
sliding. Overlapping exit transitions could still re-trigger the freeze.

`MappingsList` therefore maintains `alignment.listAnimating` (a `$state` boolean on the
`Alignment` class) via an `$effect` mirroring `outroing > 0 || closing > 0`, reset to
`false` on `onDestroy` so the guard is inactive whenever the panel is hidden.
`Alignment`'s mutation paths — `toggleSource`, `toggleTarget`, `deleteActive`,
`deleteById` — early-return while it is `true`.

> Placing `listAnimating` on the domain `Alignment` class is an acknowledged altitude
> compromise (presentation state in the domain object; a second list consumer would
> silently inherit the throttle). It was accepted because the alternative — absorbing
> the clicks in the UI layer — touches gesture state with non-trivial regression risk.
> Revisit if a second list consumer ever appears.

## Scroll-to-active timing

When a card becomes the active mapping it is scrolled into view. The scroll is issued
**as soon as layout space is allocated** — immediately when the card becomes active,
_before_ the GSAP transforms begin — because the card already exists in the DOM and the
browser's layout knows where it will land. This cut roughly 400 ms (adds) / 220 ms
(deletes that reveal an active card) of latency versus the old "scroll after the
animation settles" approach. A second `scrollIntoView` in the animation's `onComplete`
covers the case where the user activates a _different_ card mid-animation; it is a
no-op if the card is already visible.

A separate `$effect` handles the end-of-deletion scroll, gated on `closing === 0` so it
only fires once the last active deletion completes — otherwise concurrent deletes would
read geometry from in-flight Flip transforms and scroll to the wrong place. The
`scrollSuppressed()` predicate (`pendingAddId != null || addCard != null || outroing > 0
|| closing > 0`) holds the active-card scroll until all animation is done; because
`outroing`/`closing` are `$state`, the scroll `$effect` re-runs the moment they settle.

## The empty-state overlay

The `<ol>` is **always mounted**, even when empty. Svelte's `out:exit` is a _local_
transition — it plays only when the `{#each}` item is removed, not when an ancestor
block is torn down. Wrapping the `<ol>` in `{#if length > 0}{:else}` would destroy it
on the last delete and skip the exit slide entirely.

The "No mappings." overlay is a separate block that crossfades: `in:fade` rises
concurrently with the last card's slide-out (rather than gating on `outroing === 0`,
which used to make it pop in after a half-second gap), and `out:fade`s away when the
first mapping is added.

## Swipe-to-delete (touch)

On coarse-pointer devices the delete button is hidden (it was hittable while invisible,
so a user trying to _select_ a card could delete it). A horizontal swipe replaces it.

The gesture state machine lives in the **`swipeToDelete` Svelte action**
(`src/lib/actions/swipeToDelete.ts`); the component keeps only the GSAP springback and
flyoff (those own a GSAP instance and run in `onMount`). The action borrows column
geometry from the component via options, matching the `longpress` pattern.

- **Recognition** — pointer events on the `<ol>` (delegated). A swipe commits only
  after 10 px of horizontal movement that also exceeds vertical movement (angle check),
  so the browser can still resolve vertical scroll. `touch-action: pan-y` on each `<li>`
  cedes horizontal events to JS once committed.
- **Tracking** — the card follows the finger 1:1 via inline `translateX`.
- **Threshold** — releasing past 40 % of the card's width deletes; below that it springs
  back (GSAP `power2.out`, 300 ms).
- **Direction constraint** — in two-column layouts a card may only swipe toward its
  outer edge; the wrong direction produces no movement.
- **Clipping** — `overflow-x-hidden` on the `<ol>` clips the translating card at the
  panel edge.

**Exit hand-off via a stamped marker.** On a past-threshold release the card's current
translate is written to `dataset.swipeFlyoff`, then `deleteById` is called. The `exit()`
transition reads the stamp and flies the card the rest of the way from the finger's
position, then runs the same gap-close as a button delete. The explicit stamp matters:
a button-deleted card may carry a GSAP survivor transform from an in-flight gap-close,
so _inferring_ "this was a swipe" from the computed transform is ambiguous — the marker
is unambiguous and dies with the node. (This exact ambiguity was a confirmed bug in the
first implementation, where a button-deleted card flew off in the wrong direction.)

Because `deleteById` bails while `listAnimating` is true, a swipe that lands during
another card's animation simply springs back; the user retries once it settles.
