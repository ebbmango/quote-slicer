# View Mode

View mode (`mode.current === 'view'`) is the read-only presentation layer: the tokens
are dimmed, the line-tool affordances are inert, and the authorship field is locked.
Its one piece of interactivity is the **mapping highlight** — hovering (or tapping) a
mapped token lights up every token in the same mapping across **both** panels, so the
reader can see a connection at a glance instead of decoding per-token colour chips.

## Why a separate highlight state machine

The highlight is not just "colour the hovered token". It has to:

- light the _whole_ mapping group across both panels from a single hovered token;
- not flicker as the pointer glides across tokens of the same mapping;
- feel responsive on a deliberate re-hover but not trigger on an accidental graze;
- offer a touch equivalent (no hover) without inheriting the mouse delays.

That is a small timer state machine, and it was extracted from `Alignment` into its
own class so it can be unit-tested with fake timers rather than only through a live
Svelte context.

## `ViewHighlight` (`src/lib/context/viewHighlight.svelte.ts`)

A standalone Svelte 5 reactive class. Its only dependency is a `MappingAtResolver` —
a `(zone, i) => MappingId | null` closure injected via the constructor. `Alignment`
constructs one internally and provides the closure, pointing it at the live `$derived`
`sourceMappingIndex` / `targetMappingIndex` maps, so the resolver always reflects the
current token layout. `Alignment` exposes the instance directly as a `readonly highlight`
field; callers reach the machine through `alignment.highlight.hoverSource(i)` and the
like. (Earlier this surface was re-published as nine pass-through forwarders on
`Alignment` — deleted, since they added no behaviour over the already-named module.)

> Because `ViewHighlight` takes a resolver closure rather than owning the index maps,
> the coupling to `Alignment` is a single call-time function, not a structural
> reference. The closure reads the `$derived` maps at _call time_, which is correct;
> it shares `Alignment`'s lifetime so it can never outlive them.

## The cold / warm / grace timing

Firing on `mouseenter` naively makes the whole text flicker as the pointer crosses
tokens. The fix has two halves: **clearing is container-level, not per-token**, and
**light-up is delayed**.

- There is **no per-token `mouseleave`**. Clearing happens only when the pointer
  enters an _unmapped_ token or leaves the whole panel. (A pointer parked in the flex
  gap between tokens keeps the highlight lit — a known, intentional quirk of this
  design.) Moving between two spans of the _same_ mapping is an early-return no-op.
- **Cold delay = 500 ms** — the wait before lighting up when entering a mapping from
  nothing lit.
- **Warm delay = 300 ms** — used when re-entering a mapping within the 500 ms
  **grace** window after the previous highlight cleared (the user is still moving
  around the text, so a quicker response feels right).

`pointerMapping` (plain JS, not `$state`) tracks what's under the pointer right now;
`hoveredMappingId` (`$state`) is what's actually lit. Keeping `pointerMapping`
non-reactive avoids a re-render on every mouse move.

### Touch

Touch gets **no delay** — a tap is intentional. The tap handler toggles: tapping the
same mapping dismisses it, a different mapping switches, an unmapped token clears. It
also resets the warm flag and cancels any grace timer, so a subsequent mouse hover
doesn't inherit the shorter 300 ms delay.

### Highlight colour

`HIGHLIGHT_COLOR = 'rgb(255, 0, 55)'` (`constants/colors.ts`) — intentionally **flat**:
the same red for every mapping, ignoring each mapping's own palette entry, so the hover
state reads distinctly from the link-mode selection colours. The CSS `color` transition
on the token spans fades the highlight out; light-up is instant once the timer fires.

## Wiring and cleanup

Both `InteractiveSourceText` and `InteractiveTargetText` wire `onmouseenter` on each
token to `alignment.hoverSource(i)` / `hoverTarget(i)`, `onmouseleave` on the container
to `alignment.hoverOut()`, and touch taps to `tapSource(i)` / `tapTarget(i)`.

Cleanup is owned by a single `$effect` in `QuoteWorkbench`: it calls
`alignment.clearHighlight()` when the mode is not `view` **and** returns a teardown that
clears it on unmount, so pending light/grace timers can never fire on a detached
instance, and the reset runs once per mode-exit rather than once per panel.

> Keyboard navigation in view mode is deliberately not implemented — there is no
> keyboard highlight.
