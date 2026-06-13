# Minimal-viewport data modal for maps/json toggle

> Commits: `f2ec4ad`
> Date: 2026-06-13

## Overview

Below 900px (and outside the tall-portrait tablet layout), there is no aside panel to
host the mappings list or the JSON export. This change makes the maps/json toolbar
buttons open a **modal** over the workbench instead — a panel that slides in from the
side matching the active view, fills the vertical band between the sun icon and the
tools row, and closes on re-click or the browser/Android back button. It extends the
toggle mechanism introduced in
[the aside maps/json toggle](./26-06-13-aside-maps-json-toggle.md).

## Motivation

The prior toggle assumed a visible aside to swap content into. That holds at tablet,
medium, and desktop breakpoints, but the smallest viewports collapse both asides
entirely — leaving the toggle buttons with nowhere to put their content. The modal is
the smallest-viewport home for the same two views, reusing the existing
`mappingsList()` and `jsonExport()` snippets rather than building new content.

## Architecture

The "minimal" viewport is defined narrowly: `belowMedium && !tabletPortrait`, where
both flags are driven by `matchMedia` listeners set up in `onMount` and kept in sync
with the `@media` blocks in `<style>`. Tablet-portrait is excluded because that layout
already shows a sidebar, so it keeps the unchanged aside-toggle behavior.

Rather than rewire one button set across breakpoints, the toolbar carries **two
visually identical button pairs**, gated purely by CSS:

- `.subtools-aside` — the original wiring (`asideView = 'maps' | 'json'`, one button
  always active). Shown at tablet-portrait and medium.
- `.subtools-modal` — the new wiring (`openModal` / `closeModal`, both buttons idle
  unless the modal is open). Shown only at minimal.
- Desktop shows neither (both asides are visible there).

The two pairs have genuinely different notions of "active" — the aside variant always
highlights one button; the modal variant highlights none until the modal opens — so
duplicating the markup keeps each truth condition simple and leaves all breakpoint
selection in pure `@media` queries. The shared SVG paths are factored into
`{#snippet mapsIcon()}` / `{#snippet jsonIcon()}` so only the wiring differs between
the pairs.

The modal element itself (`.data-modal`) is `position: absolute` inside a now-`relative`
workbench wrapper, `inset: var(--layout-spacing) 0` so it keeps the same margins as the
toolbar icons, with `z-index: 2` to sit over the workbench.

## Implementation Details

**Open/close + history.** `openModal(view)` sets `asideView`, opens the modal, and
pushes a history entry via `pushState('', { modal: true })` from `$app/navigation`.
`closeModal()` clears `modalOpen` and, if our entry is still on top
(`page.state.modal`, read from `$app/state`), calls `history.back()` to unwind it. A
`popstate` listener closes the modal when the user navigates back — it only flips
`modalOpen`, never calls `history.back()` itself, so a back-button close cannot trigger
a second pop. The SvelteKit router APIs are used deliberately instead of raw
`history.pushState` / `history.state`, which the router intercepts and warns about
(and whose state it nests under `sveltekit:states`, so a raw `history.state.modal`
read would silently break). `App.PageState` is extended with `modal?: boolean` to type
the shallow-routing state.

**Content swap without re-animating.** If `openModal` is called while already open, it
only reassigns `asideView` and returns early — no second push, no re-mount. The slide
distance/direction lives in `flyX` (`$derived`): maps slides from the left
(`-innerWidth`), json from the right (`+innerWidth`). Because Svelte evaluates the
transition params only at transition start, swapping views while open never replays the
animation; the panel just changes its rendered snippet in place.

**Breakpoint-exit force-close.** An `$effect` watches `minimal` and `modalOpen`; when
the viewport leaves minimal while the modal is open, it force-closes. To make that exit
instant (no slide), it sets a `forceClose` flag that drives `out:fly` to
`duration: forceClose ? 0 : 450`. `forceClose` is a plain variable, not `$state` — it's
set synchronously in the same flush that flips `modalOpen`, so the transition reads the
updated value when the `{#if}` tears down the element. `openModal` resets it to `false`
to re-arm the animation for the next user-driven close.

## Design Decisions

- **Two CSS-gated button sets over one dynamically-rewired set.** Keeps breakpoint
  selection in `@media` and avoids adding JS branching to the existing `wide`
  `matchMedia` sync, already flagged as a fragility point in the
  [aside toggle note](./26-06-13-aside-maps-json-toggle.md).
- **Animation via Svelte's built-in `fly`**, not GSAP (which the rest of the app
  lazy-loads in `onMount`) — the modal needs only a fade+slide, and `fly` keeps it
  self-contained.
- **Slide direction tracks current `asideView`, not entry side**, so toggling views
  while open and then closing exits toward whichever side is currently shown.

## Areas to Be Careful

- The hidden left aside is wrapped in `{#if !minimal}` specifically so its
  `mappingsList()` — which holds `bind:this={listEl}` — does not coexist with the
  modal's copy of the same snippet. Removing that guard reintroduces a duplicate
  binding. There is still a one-tick overlap during the force-close transition; treat
  the `!minimal` gate and the `forceClose` instant-exit as load-bearing together.
- `aria-label="maps"` / `"json"` now appear twice in the DOM (one pair per variant,
  only one visible via CSS). `display: none` hides one from the accessibility tree, but
  DOM-based test selectors (`getByLabel`) will match both — scope any such selector to
  `.subtools-modal` or `.subtools-aside`.
- The `matchMedia` queries in `onMount` must stay in sync with the `@media` breakpoints
  in `<style>`; they encode the same thresholds in two places.

## Future Considerations

`forceClose` as a non-reactive variable read at transition time is an unusual pattern;
if the open/close logic grows, consider deriving the exit duration more explicitly. No
unit/component tests cover the modal yet — it was verified manually and via preview.
