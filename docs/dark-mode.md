# Dark Mode

The app supports light and dark themes. Three problems shaped the design, and each
is solved by a distinct layer:

1. **No flash on load.** The app is statically prerendered and ships `light` as the
   default. Without intervention a dark-mode user sees a white flash before
   hydration applies the right class. → solved by a **prepaint script** in
   `src/app.html`.
2. **Preference that follows the OS, but not forever.** "Prefer dark" should persist
   while the user has the app open, yet reset to the OS default if they close
   everything and come back. → solved by a **cross-tab theme controller** with an
   OS-aware continuity check (`themeState.ts` + `systemTheme.ts`).
3. **One coherent transition.** On a theme flip, every element should settle on the
   new colours at the same rate — no element finishing 220 ms ahead of the page
   background. → solved by the **`html.theme-anim` gating window** plus a per-scheme
   palette.

## The no-flash prepaint script (`src/app.html`)

An inline `<script>` runs synchronously before any CSS or JS loads. It reads
`localStorage`, decides the correct mode, and stamps `html.dark` +
`style="color-scheme: …"` in the same task as the HTML parse — so by the time the
browser begins layout the correct class is already there and no flash is possible.

The script is a self-contained IIFE with **no imports** (it runs before modules
exist), so it **duplicates** the state-parsing logic from `themeState.ts`: the same
storage keys (`quote-slicer:theme-state:v1`, `quote-slicer:theme-tabs:v1`), the same
`version: 1` schema and validation, and the same `hasContinuity` decision (active
tab within the 5-minute TTL, or a recent reload within the grace window).

> **Keep in sync.** The prepaint script and `themeState.ts` share the storage schema
> and the continuity decision. Any schema change requires editing **both** and
> bumping the version string. This duplication is deliberate — the script must stay
> tiny and dependency-free.

## The theme controller (`themeState.ts` + `systemTheme.ts` + `theme.ts`)

The logic is split so it can be unit-tested without a DOM:

- **`src/lib/themeState.ts`** — pure functions and types only. The storage shape
  (`StoredThemeState`, `StoredTabRegistry`), the keys and timing constants
  (`HEARTBEAT_MS = 30 s`, `STALE_TAB_MS` / `RELOAD_GRACE_MS = 5 min`), and all the
  resolution logic (`resolveStoredTheme`, `resolveExternalThemeState`,
  `pruneTabRegistry`, …). No browser API. Covered by `themeState.spec.ts`.
- **`src/lib/systemTheme.ts`** — `adaptiveTheme()`, the browser-connected runtime. It
  wires the pure functions to `localStorage`, a `BroadcastChannel('theme-sync')`, the
  OS media query, and a heartbeat timer, and returns a Svelte-reactive object with a
  `get/set current` backed by `createSubscriber`.
- **`src/lib/theme.ts`** — `export const theme = adaptiveTheme()`, the single shared
  controller instance. Consumers import it (most alias it `appTheme`) and read
  `theme.current` (`'light' | 'dark'`); setting `theme.current = …` is what
  `ThemeToggle` does on click.

### State semantics — explicit choice vs OS default

The stored state carries both `mode` (the active theme) and `systemMode` (what the OS
was showing when the state was written). On load:

- If there is **continuity** (at least one live tab in the registry, or a recent
  reload) and the stored `systemMode` still matches the current OS, the stored `mode`
  is used — so an explicit "dark" choice survives reloads.
- If the OS preference changed since the state was written (`storedState.systemMode !==
currentSystemMode`), the preference is **stale** and discarded in favour of the new
  OS default. (A user who chose dark on a light OS thus loses that choice if they
  switch the OS to dark — an accepted edge case.)
- Without continuity, stored preferences are cleared and the OS default applies.

### The tab registry (continuity)

Two `localStorage` keys: `…:theme-state:v1` (the mode) and `…:theme-tabs:v1` (a map of
`tabId → { seenAt }`, heartbeated every 30 s). "Continuity" means at least one tab
entry is within the 5-minute TTL, **or** the registry's `lastEmptyAt` is within the
reload-grace window. This is what lets a preference persist across a reload (briefly
zero tabs) but reset after every tab has been closed long enough.

### Cross-tab sync

`BroadcastChannel('theme-sync')` carries `{ type: 'state', source, state }` messages.
On receipt, `resolveExternalThemeState` decides `adopt`, `ignore`, or `publish-system`
(the incoming state has a stale `systemMode`). A newly opened tab also sends
`{ type: 'request' }`; existing tabs reply with their state, so the new tab inherits
the live theme before its own storage read settles. A `localStorage` `storage` event
is used as a fallback for environments without `BroadcastChannel`. `visibilitychange`
/ `pageshow` / `focus` trigger a `reconcileStoredTheme()` so a backgrounded tab catches
up on return.

> The live cross-tab sync is intentional and valued — do not remove it.

## The toggle button (`ThemeToggle.svelte`)

Two buttons (moon on top, sun on bottom) inside a clipped orbit container. The stack
rotates 180° per toggle; `overflow: hidden` clips the upper half so only the bottom
icon shows at rest, and each toggle swings the off-screen icon down into view.
`mask-image` fades the top edge so the entering icon dissolves rather than snapping.

Two browser-specific fixes are load-bearing:

- **`overflow: hidden`, not `clip-path`.** Firefox does not repaint a `clip-path`
  region when a descendant is being transformed, which dropped the leaving icon on
  alternate toggles. `overflow: hidden` clips correctly under transforms. (`mask-image`
  is used only for the edge fade, not clipping, so the same bug doesn't apply.)
- **`data-hydrated` guard.** On SSR `theme.current` is always `'light'`, so the server
  renders rotation 0 (sun). The prepaint script may have set `html.dark` before
  hydration; pre-hydration CSS rules (`html.dark .theme-toggle { rotate: 180deg }`)
  snap to the right angle without a transition. A `hasHydrated` flag is set in
  `onMount` and exposed as `data-hydrated`; only then do the `transition: rotate 800ms`
  rules engage. Without this guard, Firefox started the rotation from the wrong angle
  every other toggle.

## The per-scheme palette (`MAPPING_COLORS`)

Mapping-card colours are applied as inline `style="…"` attributes, not Tailwind
utilities, so a `.dark` CSS class can't gate them — the light/dark split has to happen
in script. `MappingColor` is therefore a `{ light, dark }` wrapper around a
`MappingColorVariant` (the 13 colour roles: token `source`/`target` plus the card
backdrop, badge, and bottom-bar colours). See
[Data Model → Colors](data-model.md#colors).

- **`Mapping.svelte`** derives `isDark` from `appTheme.current` and selects
  `colorVariant = isDark ? color.dark : color.light`; its `theme` object reads from
  the variant.
- The token-state and divisor colour functions (`deriveSourceTokenState`,
  `deriveTargetTokenState`, `divisorColor`) take a `mode` parameter and do the same
  selection — `Alignment` passes `appTheme.current` through.

### The delete-button colour flash

The delete button on a mapping card used to flash the wrong colour in two situations.
Three independent bugs combined; all three are fixed:

1. **Transition on SVG `fill`.** The icon `<path>`s carried Tailwind's `duration-100`,
   which sets `transition-duration` while leaving `transition-property: all` — so
   `fill` animated over 100 ms instead of snapping. Removed.
2. **Colours coupled to `isActive`, but focus fires before click.** The button is
   revealed on `onfocus` (mousedown) but `isActive` flips on `onclick` (mouseup), so
   for that interval it showed the inactive palette, then snapped. Fix: the delete
   button is an _action affordance_, not a state indicator — its colours now derive
   directly from `colorVariant` (always the active palette), regardless of `isActive`.
   There is no inactive→active change left to flash.
3. **Stale GPU texture after a theme switch.** Chrome paint-culls an `opacity-0`
   subtree and does not re-rasterize it on a theme switch, so the first reveal
   composited the pre-switch texture for one frame. Fix: `{#key isDark}` on the
   `<svg>` forces Svelte to recreate the node with a fresh raster. The remount is
   invisible because toggling the theme moves focus to the toggle button, hiding every
   delete button during the swap. (This relies on delete buttons being hidden at theme
   switch — see the code comment if a keyboard theme shortcut is ever added.)

## Synchronized transitions

Every visible colour on the page must settle on its new value at the same rate on a
theme flip — no element finishing ahead of or behind the page background.

### Never change `color-scheme` during the flip (Chrome throttle)

The single most important rule, and the least obvious. Chrome runs a
`background-color` transition on the **compositor** but a `color` transition on the
**main thread** — and it _throttles the `color` transition to roughly half rate when
`color-scheme` changes in the same frame as the flip._ With the old code
(`applyDocumentTheme` set `document.documentElement.style.colorScheme = mode` inline on
every toggle, and `.dark` also carried `color-scheme: dark`), the background settled in
~500 ms while all text dragged to ~900 ms — text visibly "caught up" late. It was not
paint jank and not DOM size: a bare test page synced fine, and toggling only the `.dark`
class (leaving `color-scheme` alone) synced fine; adding the `color-scheme` change was
the sole trigger.

Fix: `color-scheme` is no longer set via CSS (removed from `html` / `html.dark`) or
synchronously on a flip. `systemTheme.ts` applies it inline **after** the transition
window (`scheduleColorScheme`, debounced to `THEME_ANIM_MS + 60`), so no `color`
transition is running when it changes. The initial value is still stamped inline by the
app.html prepaint (pre-paint, no transition) and re-asserted once on controller init.
Native form controls / scrollbars therefore adopt the new scheme ~560 ms after a flip
instead of instantly — imperceptible, and the whole page now transitions in lockstep.

### The load-bearing rule: transition colour once, at the root, and inherit

`html, body` transition `background-color` and `color` over 500 ms. **That single
`color` transition is what carries every piece of text.** `color` is inherited, and all
three engines (Firefox, WebKit, Chromium) repaint a descendant in lockstep with an
ancestor's _animating_ inherited colour — **but only if the descendant has no `color`
transition of its own.** So the authorship line, "No mappings", plain tokens, toolbar
and toggle glyphs (SVG `fill: currentColor`) all just inherit `<body>`'s transition and
settle with it, on every engine, for free.

> **The one rule that matters:** never put a `color` transition on an element that takes
> its colour by inheritance. If a descendant _also_ transitions `color`, it eases toward
> `<body>`'s already-easing value, so the lag **compounds with DOM depth** — and if the
> transition definition is swapped mid-flight (e.g. a `.theme-anim` rule being removed),
> the descendant snaps to its ancestor's lagging value. That is exactly the flicker /
> "text reappears at different speeds" bug this section exists to prevent. Transition
> `color` **only** on elements that set an explicit colour of their own.

### What legitimately transitions its own colour

- **Tinted tokens.** A `.tok` only sets an explicit `color` when it carries a mapping
  tint (active / focused — see `tokenPresentation`); those spans get a `.tok-tinted`
  class (added in `Interactive{Source,Target}Text` when `p.style` contains `color:`).
  `.tok-tinted` transitions colour (280 ms for the link-mode activate crossfade, widened
  to 500 ms under `.theme-anim`). Untinted tokens get **no** colour transition and ride
  `<body>` by inheritance.
- **Shiki JSON spans.** Each carries an explicit inline palette colour, so a theme flip
  must transition their own `color` — `JsonExportPanel` scopes a 500 ms colour transition
  to `:global(html.theme-anim) .shiki-export span`. Explicit colour ⇒ no inheritance
  compounding, so it stays flicker-free.
- **Mapping cards** already transition their (explicit, inline) palette colours via
  Tailwind `transition-colors duration-500`.

### The `html.theme-anim` window

`systemTheme.ts` calls `flashThemeTransition()` on a real mode change, adding
`theme-anim` to `<html>` for 500 ms (debounced). Its only job now is to _widen_ the
handful of elements whose own colour transition is normally faster — the tinted tokens
(280→500 ms) and the `morph-target` textarea — so their explicit-colour shift matches the
page during a theme flip without slowing the arrow-launch mode-crossfade the rest of the
time.

### Traps that reintroduce the bug (all fixed, keep them fixed)

- **`duration-*` with no `transition-property`.** Tailwind's `duration-200` /
  `duration-150` set only `transition-duration`; the property defaults to `all`, so the
  element silently transitions its (inherited) `color` too. The token-workspace wrapper
  (`duration-200` for a `focus:bg` tint) and the toolbar / toggle buttons (`duration-150`
  / `duration-300` for opacity) each did this and desynced everything nested under them.
  Fixed by scoping: `transition-[background-color]` on the wrapper, `transition-opacity`
  on the buttons.
- **A blanket `html.theme-anim * { transition: color … }`.** Tried once; it is the
  compounding trap applied to _every_ element at once (deep inherited text lagged by
  depth, then snapped when the window closed). Do not reintroduce a universal colour
  transition — inheritance already does this job correctly.
- **Same duration, different easing.** Tailwind's default timing function is
  `cubic-bezier(0.4, 0, 0.2, 1)` while the page-level `html, body` transition uses
  `ease` — so the mapping cards (Tailwind `transition-colors duration-500`) trailed the
  page by up to ~15 % progress mid-flip despite the equal 500 ms duration, visibly
  settling after everything else. `layout.css` pins
  `--default-transition-timing-function: ease` in `@theme`, so every Tailwind transition
  shares the page's curve. Don't add per-element `ease-*` utilities that diverge from it.

### Two more supporting fixes

- **`::placeholder` uses `currentColor`.** Browsers don't re-resolve `light-dark()`
  on `::placeholder` when `color-scheme` changes — the colour freezes at first paint.
  Switching the target textarea's placeholder to `currentColor` makes it inherit
  through the normal cascade and update on theme flip.
- **JSON export recolours synchronously.** `HighlightedCode` used to re-tokenize on a
  theme flip to swap Shiki's inline colours — an _async_ step, so the JSON panel snapped
  a frame late. It now tokenizes once with the raw `dracula` theme (structure and base
  colours are theme-independent) and applies a synchronous `colorMap` (raw hex →
  app-palette hex) at render, so a flip changes the inline colours in the same frame and
  the transition above eases them in lockstep. See
  [Export → Recoloring Shiki](export.md#recoloring-shiki-to-the-app-palette).
- **Svelte-driven colours flush synchronously with the class flip.** Everything whose
  colour is an inline style derived from `theme.current` (mapping cards, the Shiki
  `colorMap`) re-renders through Svelte's batched flush — which in Chromium landed one
  frame _after_ `applyThemeClass` toggled `.dark`, so those transitions started a frame
  behind the page's. `systemTheme.ts` calls `flushSync()` right after `notify()` on a
  real mode change, putting every DOM write into the same style recalc: one shared start
  frame for all transitions.

Verified across Chromium / WebKit / Firefox by driving a theme toggle in Playwright and
sampling each element's painted `color` per animation frame: authorship, "No mappings",
plain tokens, toolbar buttons, the toggle glyph and the JSON panel all trace the _same_
luminance curve as `<body>`, with no post-window drop.
