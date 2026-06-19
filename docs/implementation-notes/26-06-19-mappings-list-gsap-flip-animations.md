# MappingsList GSAP Flip Animation System

> Commits: `4d7a123`, `098dc4b`, `e81d5ca`, `8d704d4`, `bbd0a2d`, `3315995`
> Date: 2026-06-19

## Overview

`MappingsList.svelte` animates card additions and deletions using GSAP's Flip plugin. Cards slide in from their column edge on add; they slide out on delete, then neighbours ripple closed to fill the gap. The system was built incrementally over a single day, with each commit fixing a sequencing problem exposed by the previous one. The final commit in the series fixes a subtle re-entrant `$state` write that silently killed Svelte's entire reactive scheduler under rapid create/delete.

## Motivation

Without animation, adding or deleting a mapping card makes the list jump — cards teleport to new grid positions with no continuity. The goal was:

- **Add**: show the new card sliding in from its column edge, with existing neighbours visibly opening a gap first so the new card has somewhere to land.
- **Delete**: show the leaving card sliding out, then neighbours flowing closed to fill the void, with a staggered ripple outward from the deleted position.
- **Column awareness**: a two-column grid layout is common at wider viewports; cards in the left column should slide left, right column right.
- **Interruption safety**: rapid user actions (clicking the same token repeatedly) create and destroy mappings faster than a single animation cycle. The system must not leave cards stranded, invisible, or at the wrong position.

Svelte's built-in `animate:flip` was not used because it cannot handle column-direction awareness, the out→close sequencing, or the deletion-point ripple stagger.

## Architecture

All animation logic lives in `MappingsList.svelte`. `Mapping.svelte` is kept thin — it only receives and applies the `exit` transition function and `onoutrostart`/`onoutroend` lifecycle callbacks as props. This keeps GSAP entirely out of `Mapping.svelte`.

GSAP and the Flip plugin are lazy-loaded inside `onMount` (the app prerenders statically; GSAP must not run during SSR). A `canAnimate()` guard checks that both are loaded, the list element is visible, and `prefers-reduced-motion` is not set.

Animation timing constants are collected in a single **tunables block** near the top of the script, labelled clearly, so feel adjustments don't require reading the implementation:

```
SLIDE      = 56px   // travel distance in/out from column edge
MAKEWAY_S  = 0.22s  // neighbours sliding apart (add)
ENTER_S    = 0.25s  // new card sliding in
GAP_DELAY  = 0.15s  // card waits so gap is already opening when it arrives
EXIT_MS    = 250ms  // leaving card sliding out (Svelte transition, ms)
CLOSE_S    = 0.22s  // neighbours closing gap (delete)
STAGGER    = 0.025s // per-card ripple delay from deletion point
```

Two-column layouts use 0.40 s for both make-way and gap-close (computed live from `getComputedStyle` at animation time to stay in sync with CSS breakpoints).

## Implementation Details

### Add path

`$effect.pre` runs before the DOM patch. It diffs the current `sortedMappingViews` IDs against `prevIds` to detect a single new ID, then calls `Flip.getState(existingCards)` to snapshot neighbour positions before Svelte inserts the new card. The snapshot and the new card's ID are stored in plain `let` variables (`addFlipState`, `pendingAddId`).

A post-update `$effect` then calls `runAdd(id, state)`. At this point the new card is in the DOM but hasn't been painted. `runAdd` immediately hides the new card (`opacity: 0, x: dir * SLIDE`) so it never flashes at rest, then:

1. Runs `Flip.from(state, ...)` to animate neighbours from their old positions to the room-made layout the DOM now holds. The new card is absent from the snapshot, so Flip ignores it.
2. After `GAP_DELAY`, slides the new card in with `gsap.to(card, { opacity: 1, x: 0, ... })`.

**First card on an empty list**: when the list was empty, there are no neighbours to snapshot, so `state` is `null` and only the slide-in runs.

### Delete path

Deletion is driven by Svelte's `out:exit` transition (a custom function, not a built-in). The transition keeps the leaving card in the DOM while sliding it to its column edge over `EXIT_MS`. While the card is still in the DOM it holds its grid slot, so neighbours stay in their open-gap positions — this is the key timing insight.

`onoutroend` fires the `onExitEnd` handler once the slide finishes. At that instant the card is invisible but still in flow:

1. Snapshot surviving neighbours with `Flip.getState(survivors)` — they're at their open-gap positions.
2. Set `node.style.display = 'none'` — this pulls the card out of layout flow, so the grid reflows the survivors closed *synchronously, in the same call stack*.
3. Run `Flip.from(state, ...)` — Flip animates the survivors from the snapshot (open) to where the grid just placed them (closed), with a stagger ripple outward from the deleted card's former index.

This approach is frame-perfect: both the snapshot and the reflow happen before the browser paints, so there is no teleport and no reliance on timing.

### Interruption safety

Rapid actions create conflicts that required explicit handling:

- **Delete interrupts add**: if the card being deleted is the card currently sliding in (`addCard`), `onExitStart` calls `killAdd()` to settle the add tween before the exit transition takes ownership of the node.
- **Add interrupts add**: `runAdd` always calls `killAdd()` first, which snaps any in-flight add to its rest state before starting fresh.
- **Concurrent add+delete**: if `addCard` is not null when `onExitEnd` fires, the surviving neighbours' positions may be mid-tween from the make-way Flip. `onExitEnd` calls `killAdd()` first so the gap-close snapshot captures survivors at their final positions, not mid-animation.
- **Last card deleted**: `Flip.from([])` is a no-op tween that may never fire `onComplete`. Early-returning when `survivors.length === 0` avoids pinning `closing > 0` forever.
- **Multiple concurrent deletes**: each delete gets its own `tween` pushed into `closeTweens[]`. They do not cancel each other. `onDestroy` kills them all.

### Scroll suppression

The active-card scroll `$effect` is suppressed while any animation is in flight via `scrollSuppressed()`:

```js
const scrollSuppressed = () =>
    pendingAddId != null || addCard != null || outroing > 0 || closing > 0;
```

`outroing` and `closing` are `$state` so the scroll `$effect` re-runs (and retries the scroll) the moment the last exit slide and gap-close finish — no separate "scroll when done" callback is needed in most cases.

### Empty-state overlay

The `<ol>` is **always mounted**, even when the mapping list is empty. This is necessary because Svelte's `out:exit` is a *local* transition: it only plays when the `{#each}` item is removed, not when an ancestor block is torn down. Putting the `<ol>` inside an `{#if length > 0}{:else}` block meant the whole `<ol>` was destroyed when the last card was deleted, skipping the exit slide entirely.

The empty-state "No mappings." overlay is a separate `{#if length === 0 && outroing === 0}` block so it waits for the last card's slide to finish before appearing.

## The Freeze Bug (commit `3315995`)

### Symptom

Rapidly clicking the same hanzi token in link mode — which creates a mapping on odd clicks and deletes it on even clicks — froze the entire app after roughly 10 clicks. Once frozen:

- Mode/tool switches stopped rendering.
- The JSON export panel went stale (typing in the authorship field updated the textarea but the JSON never recomputed).
- Native textarea input and DOM scroll still worked.
- No exception was thrown. No `pageerror`, no `console.error`, no pegged main thread.

### Root cause

GSAP's ticker can advance **synchronously** when `Flip.from()` is called — it ticks forward to process any already-completed tweens before returning. Under rapid same-token clicks, the exit transitions overlapped: card A's `onExitEnd` ran while card B's exit was still in progress. Inside `onExitEnd`, calling `Flip.from(...)` for the gap-close caused GSAP's ticker to advance, which completed the *previous* gap-close tween's `onComplete` callback — **synchronously, while Svelte was mid-flush** (because `onExitEnd` itself was called from Svelte's outro machinery, which is part of a flush).

The `onComplete` body wrote `closing = Math.max(0, closing - 1)` — a `$state` mutation. Writing `$state` re-entrantly during an already-in-progress Svelte flush silently corrupts the reactive scheduler. No error is thrown; the flush simply stops committing updates. All derived values freeze globally.

This was confirmed by systematic bisection: disabling every other animation operation left reactivity ALIVE; only the `closing` `$state` write inside the GSAP `onComplete` was the necessary-and-sufficient trigger.

**Why `outroing` is safe**: `outroing` is also `$state`, but it is written from Svelte's own `onoutrostart`/`onoutroend` handlers — already part of the flush machinery, not from a GSAP callback. Writing `$state` from within Svelte's own event dispatch path is fine; writing it from a GSAP ticker callback that fires re-entrantly mid-flush is not.

### Fix

Wrap the gap-close `onComplete` body in `queueMicrotask`:

```js
onComplete: () => {
    queueMicrotask(() => {
        closeTweens = closeTweens.filter((t) => t !== tween);
        closing = Math.max(0, closing - 1);
        if (closeTweens.length === 0) {
            clearSurvivorTransforms(addCard ?? undefined);
            scrollActiveIntoView();
        }
    });
}
```

`queueMicrotask` defers the callback until after the current microtask (and therefore the current Svelte flush) has unwound. The `$state` write then lands in a clean scheduler context.

`closing++` (written in `onExitEnd` itself) stays synchronous — it runs in Svelte's outro handler context, not inside a GSAP callback, so it is safe. `killClose()` resets `closing = 0` synchronously, which is also safe — it runs on teardown, not from a GSAP tick.

### General rule

**Never mutate a Svelte `$state` variable synchronously inside a GSAP callback** (`onComplete`, `onUpdate`, `onStart`, etc.). GSAP can advance its ticker synchronously during `Flip.from()`, `tween.kill()`, and similar calls, meaning any of those callbacks can fire re-entrantly mid-flush. The safe pattern is `queueMicrotask(() => { /* $state write */ })`.

Today only `closing` was the culprit (the `addEnter`/`addFlip` `onComplete` callbacks write only plain `let` variables). Future tweens that need to write `$state` should follow the same deferred pattern.

## Areas to Be Careful

- **`onExitEnd` is synchronous by design**: the snapshot, `display:none`, and `Flip.from` call must all happen in the same synchronous frame for the animation to be teleport-free. Do not introduce `await` or `setTimeout` in this handler.
- **`closing` bookkeeping is deferred but the tween itself is not**: `closeTweens.push(tween)` and `closing++` happen synchronously *after* `Flip.from` returns (they are not in the `onComplete`). Only the decrement is deferred.
- **The `queueMicrotask` deferral means `closing` briefly lags reality**: for the duration of one microtask after a gap-close completes, `closing` is still 1 (not 0). `scrollSuppressed()` will still return `true` for that window. This is harmless — the scroll will fire on the next scheduler tick when `closing` drops.
- **Two `<MappingsList>` instances can coexist** (aside panel + modal on mobile). The `listRef` action prevents stale teardown from nulling the ref owned by the surviving copy.
