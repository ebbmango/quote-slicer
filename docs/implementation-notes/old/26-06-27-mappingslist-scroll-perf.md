# MappingsList Scroll-Before-Animate and Concurrent Delete Guard

> Commits: `4a13b11`
> Date: 2026-06-26

## Overview

Adding or reactivating a mapping in the sidebar previously scrolled the list to the card only after the GSAP enter animation settled — roughly 400ms for adds, 220ms for deletes that reveal an active card. The fix scrolls as soon as layout space is allocated (before GSAP starts), with a retry in `onComplete` for the edge case where the user activates a different card mid-animation. A concurrent-delete guard was added to prevent reading Flip-displaced rects when multiple cards are being deleted simultaneously.

## Implementation Details

**Scroll timing:** `scrollIntoView` is now called immediately when the card becomes the active mapping, before GSAP transforms begin. This works because the card element exists in the DOM at that point even though it hasn't animated yet — the browser's layout already knows where it will end up. A second `scrollIntoView` call inside the animation's `onComplete` covers the case where the user activates a different mapping while the first animation is still running.

**Concurrent delete guard:** The existing `$effect` that triggers the end-of-deletion scroll checked whether any cards were being removed (`closing === 0`) — but the guard was evaluated before Flip-displaced rects could settle. Concurrent deletes (rapidly tapping delete on multiple cards) caused the scroll to read geometry from in-flight Flip transforms and target the wrong position. The fix defers the scroll until `closing === 0` so the $effect only runs when the last active deletion completes.

## Design Decisions

The retry-in-`onComplete` approach is slightly redundant but safe: the second call is a no-op if the card is already visible. The alternative (a single delayed call) would introduce an artificial timeout and might still land on the wrong frame if animation duration varies.
