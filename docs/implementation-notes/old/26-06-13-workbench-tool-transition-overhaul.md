# Workbench tool transitions: unified token DOM and the arrow launch

> Commits: `5db309e`, `2c95c87`
> Date: 2026-06-13

## Overview

Tool switches in the workbench used to _snap_ — token colors appeared instantly,
line breaks opened with no motion — because each tool rendered its own `{#if}`
branch and Svelte destroyed and recreated every token span and line separator on
every switch. This work collapses link/line/view into **one persistent DOM tree
per panel** so spans and separators stay mounted and animate their differences
via CSS transitions. A companion commit adds the "draw-and-shoot" arrow animation
that gates the text → link transition.

## Motivation

A new DOM element can't transition _from_ a previous element's state — there is no
previous state, so the browser paints the final value immediately. As long as
`InteractiveSourceText` and `InteractiveTargetText` swapped their entire subtree
between a line-tool branch and a link/view branch, no amount of CSS transition
could make color or line-break height animate across a tool change. The fix had
to be structural: keep the elements alive across tools and let their attributes
change in place.

## Architecture

Both `InteractiveSourceText.svelte` and `InteractiveTargetText.svelte` now render
a single `{#each tokens}` loop wrapped in one container. The container's ARIA role
(`listbox` vs none), the spans' interactivity, and the line-tool buttons'
clickability are all driven by `isLinkTool` / `isLineTool` flags rather than by
which branch is mounted. The line-tool buttons (split/merge zones, and the
target's whitespace-split) are **always present** and toggle a `.line-tool-active`
class; outside line tool they keep their layout slot but take
`pointer-events: none`.

Two transition mechanisms carry the animation:

- **`.tok`** — a class on every token span with
  `transition: color/opacity/font-weight 280ms`. Token styling functions
  (`tokenStyle`, `tokenOpacity`) now return _only_ the target values; the
  transition timing lives in the CSS rule, not inline. Leaving link tool unsets
  color/weight, so the span crossfades back to the default text color on its own.
- **`.merge-zone`** — the full-width line break. It is a real element at
  `height: 0` in link/view tools (still forcing a flex wrap, so it doubles as the
  plain line break) and transitions to `height: 1.5rem` when `.line-tool-active`. That
  height transition is what makes lines visibly "come apart" entering line tool.

## Data Flow

The scroll container's height is the load-bearing subtlety. Two parties want to
own it:

1. **`flipTransition`** owns an explicit pixel height _during_ a split/merge tween
   (`flip.animating === true`) so the Flip animation isn't fought.
2. **Everything else** wants the box at `height: auto` so it follows content in
   flow — crucially including the `.merge-zone` height transitions that animate a
   tool change.

The `$effect` in each component now simply clears the inline height
(`container.style.height = ''`) whenever `flip.animating` is false, replacing the
old measure-and-set `fit()` + resize-listener dance. To make this hand-off work,
`flipTransition`'s `onComplete` was changed from pinning the measured pixel height
to clearing it (`heightEl.style.height = ''`) — `auto` resolves to the same
measured value but leaves the box free to follow later separator transitions.

## Design Decisions

**Net-zero line tools over conditional mounting.** Keeping the split/merge buttons
in the DOM at all times (collapsed/non-interactive) costs a little markup but is
the whole point — it's what lets the merge zone's height animate rather than pop.

**Default `flip-id` key changed from `(token)` to `(i)`.** The unified loop keys
by index so the same span element persists across tool changes; identity by token
object would have let Svelte recycle differently.

**Source token opacity now distinguishes line vs view.** `tokenOpacity` returns
`opacity-70` in line tool and `opacity-30` for view, so the three tools read
distinctly without remounting.

## Areas to Be Careful

There is a documented headless-probe gotcha on `.merge-zone.line-tool-active`: in one
automated/headless run, forcing `height` on this flex item computed to `0px` while
`min-height` worked — though it rendered correctly in a real browser. The comment
lives in **both** components. If the line-break gap ever fails to open in a real
browser, swap `height` → `min-height` in both `InteractiveSourceText.svelte` and
`InteractiveTargetText.svelte` and re-verify the close transition.

The two components must stay in lockstep: the `.tok`, `.merge-zone`, `.line-tool-active`
rules and the height hand-off logic are duplicated, and divergence will desync the
source/target animations.

`prefers-reduced-motion: reduce` disables the `.tok` and `.merge-zone` transitions
in both components; keep new transitions behind that guard.

## The arrow launch (`2c95c87`)

The text → link transition got a deliberate animation beat. The old "next" button
flipped `toolCtx.current = 'link'` synchronously inside its `onclick`. Now
`advanceToLinkTool()` sets `arrowExiting = true`, which triggers the `arrow-launch`
keyframes (anticipate up with a slight `scaleY` stretch, hold a beat, then
accelerate hard downward and fade), and defers the actual tool switch by 450ms via
`setTimeout` so the shot completes before the tools panel fades in
(`in:fade delay 250`). The same handler still seeds the demo text / placeholder
defaults. A re-entrancy guard (`if (arrowExiting) return`) prevents a double-fire.

The hover nudge (`translateY(3px)`) and the launch keyframes share the `.arrow-svg`
element on purpose: while the keyframe animation runs it overrides the hover
transition outright, so a half-finished hover slide can never bleed into the shot.
