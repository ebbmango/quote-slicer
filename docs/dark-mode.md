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
   button is an *action affordance*, not a state indicator — its colours now derive
   directly from `colorVariant` (always the active palette), regardless of `isActive`.
   There is no inactive→active change left to flash.
3. **Stale GPU texture after a theme switch.** Chrome paint-culls an `opacity-0`
   subtree and does not re-rasterize it on a theme switch, so the first reveal
   composited the pre-switch texture for one frame. Fix: `{#key isDark}` on the
   `<svg>` forces Svelte to recreate the node with a fresh raster. The remount is
   invisible because toggling the theme moves focus to the toggle button, hiding every
   delete button during the swap. (This relies on delete buttons being hidden at theme
   switch — see the code comment if a keyboard theme shortcut is ever added.)

## Synchronized transitions (`html.theme-anim`)

The page background transitions over 500 ms. Token `<span>`s deliberately use a faster
**280 ms** colour transition for the mode-crossfade feel during the
[arrow launch](mode-transitions.md#the-arrow-launch-text--link); on a *theme* toggle,
that faster timing made the tokens settle 220 ms ahead of the background.

`systemTheme.ts` calls `flashThemeTransition()` whenever the mode actually changes,
adding `theme-anim` to `<html>` for exactly 500 ms (debounced — a second toggle
restarts the timer). Elements that normally transition faster opt in with a scoped
rule that widens them to 500 ms for the duration of the window:

```css
:global(html.theme-anim) .my-element { transition: color 500ms ease; }
```

The token spans and the `morph-target` textarea use this; the 280 ms mode-crossfade is
untouched for normal arrow-launch transitions. Two related fixes landed alongside:

- **`::placeholder` uses `currentColor`.** Browsers don't re-resolve `light-dark()`
  on `::placeholder` when `color-scheme` changes — the colour freezes at first paint.
  Switching the target textarea's placeholder to `currentColor` makes it inherit
  through the normal cascade and update on theme flip.
- **JSON export dark palette.** `JsonExportPanel` derives its Shiki
  `colorReplacements` from `appTheme.current` instead of a hardcoded light map. See
  [Export → Recoloring Shiki](export.md#recoloring-shiki-to-the-app-palette).

> Rules gated on `.theme-anim` must be tightly scoped — a too-broad rule would slow
> transitions in contexts where the faster feel is intentional.
