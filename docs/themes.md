# Themes

The app supports light and dark themes. Three problems shaped the design, and each
is solved by a distinct layer:

1. **No flash on load.** The app is statically prerendered and ships `light` as the
   default. Without intervention a dark-theme user sees a white flash before
   hydration applies the right class. → solved by a **prepaint script** in
   `src/app.html`.
2. **Last change wins.** A user pick should survive reloads, but a later OS theme
   change while the app was away should supersede the stored pick. → solved by the
   OS-drift-aware resolver in `themeState.ts`.
3. **One coherent transition.** On a theme flip, every element should settle on the
   new colours at the same rate — no element finishing 220 ms ahead of the page
   background. → solved by the **`html.theme-anim` gating window** plus a per-scheme
   palette.

## The no-flash prepaint script (`src/app.html`)

An inline `<script>` runs synchronously before any CSS or JS loads. It reads
`localStorage`, decides the correct theme, and stamps `html.dark` +
`style="color-scheme: …"` in the same task as the HTML parse — so by the time the
browser begins layout the correct class is already there and no flash is possible.

The script is a self-contained IIFE with **no imports** (it runs before modules
exist), so it **duplicates** the state-parsing logic from `themeState.ts`: the same
storage key (`quote-slicer:theme-state:v3`), the same `version: 3` schema, and the
same `theme` / `osThemeAtPick` validation. It also accepts the legacy
`quote-slicer:theme-state:v2` shape (`mode` / `osAtPick`) and maps it into the v3
names so existing manual picks survive the terminology migration.

> **Keep in sync.** The prepaint script and `themeState.ts` share the storage schema
> and the OS-drift rule. Any schema change requires editing **both** and
> bumping the version string. This duplication is deliberate — the script must stay
> tiny and dependency-free.

## The theme controller (`themeState.ts` + `systemTheme.ts` + `theme.ts`)

The logic is split so it can be unit-tested without a DOM:

- **`src/lib/theme/themeState.ts`** — pure functions and types only. The storage shape
  (`StoredThemeState`), the storage key, and the resolution logic
  (`parseThemeState`, `resolveTheme`, `systemThemeState`, `userThemeState`). No browser
  API. Covered by `themeState.spec.ts`.
- **`src/lib/theme/systemTheme.ts`** — `adaptiveTheme()`, the browser-connected runtime. It
  wires the pure functions to `localStorage`, the OS media query, `storage` events, and
  return-to-tab reconciliation (`visibilitychange`, `pageshow`, `focus`), and returns a
  Svelte-reactive object with a `get/set current` backed by `createSubscriber`.
- **`src/lib/theme/index.ts`** — `export const theme = adaptiveTheme()`, the single shared
  controller instance. Consumers import it (most alias it `appTheme`) and read
  `theme.current` (`'light' | 'dark'`); setting `theme.current = …` is what
  `ThemeToggle` does on click.

### State semantics — last change wins

The stored state carries both `theme` (the active theme) and `osThemeAtPick` (what the
OS was showing when the state was written). On load:

- If the stored `osThemeAtPick` still matches the current OS theme, the stored `theme`
  is used — so an explicit choice survives reloads and full closes.
- If the OS preference changed since the state was written (`storedState.osThemeAtPick !==
currentOsTheme`), the preference is **stale** and discarded in favour of the new
  OS default. That OS change is treated as the later user/environment change.
- On a first visit or corrupt storage, the OS default applies and a fresh system state
  is persisted.

### Cross-tab sync

The browser runtime listens for `storage` changes on `quote-slicer:theme-state:v3`.
When another tab writes a fresh user or system state, this tab re-runs `resolveTheme`
against the current OS preference and adopts the stored state without echoing the write
back. `visibilitychange`, `pageshow`, and `focus` also trigger reconciliation so a tab
that missed events while hidden catches up on return.

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
  `deriveTargetTokenState`, `divisorColor`) take a `themeName` parameter and do the same
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

### Never change the root `color-scheme` while transitions can run (Chrome throttle)

The single most important rule, and the least obvious. Chrome runs a
`background-color` transition on the **compositor** but a `color` transition on the
**main thread** — and it _runs every `color` transition at roughly half speed when the
**root element's** `color-scheme` changed in the same frame, mid-flight, **or within
~500 ms before the transition started**._ With the original code
(`document.documentElement.style.colorScheme = themeName` inline on every toggle, and
`.dark` also carrying `color-scheme: dark`), the background settled in ~500 ms while
all text dragged to ~900 ms. It was not paint jank and not DOM size: a bare test page
synced fine, and toggling only the `.dark` class (leaving `color-scheme` alone) synced
fine; adding the `color-scheme` change was the sole trigger.

A first fix deferred the root write past the transition window (a debounced timer at
`THEME_ANIM_MS + 60`). That only **moved** the poison window: because the penalty also
hits transitions that _start_ within ~500 ms _after_ a root `color-scheme` change, a
second toggle landing 0–500 ms after the deferred write (which in practice meant
"toggle again right as the button's 800 ms orbit settles") still throttled every text
colour to ~1 s while backgrounds finished in 500 ms — the on-and-off "everything that
is text lags" Chrome glitch. No deferral schedule can dodge that for an
arbitrarily-timed next click.

Fix: live `color-scheme` changes go inline on **`<body>`**, synchronously with the
class flip (`applyColorScheme` in `systemTheme.ts`). Body-level changes carry no
penalty at any offset (measured on a minimal fixture: same-frame, before, and
mid-flight all settle ~440 ms) and still reach every form control, caret, and inner
scrollbar via inheritance. `<html>` keeps only the app.html prepaint value (correct
pre-hydration first paint); it goes stale after live toggles, which only affects the
root scrollbar and canvas default — the layout is a non-scrolling `h-dvh` grid and
every surface paints its own background, so neither is ever visible. Native form
controls now re-theme in the same frame as the flip, and there is no timer left to
collide with.

### The load-bearing rule: transition colour once, at the root, and inherit

`html, body` transition `background-color` and `color` over 500 ms. **That single
`color` transition is what carries every piece of text.** `color` is inherited, and all
three engines (Firefox, WebKit, Chromium) repaint a descendant in lockstep with an
ancestor's _animating_ inherited colour — **but only if the descendant has no `color`
transition of its own.** So the provenance line, "No mappings", plain tokens, toolbar
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
  `.tok-tinted` transitions colour (280 ms for the link-tool activate crossfade, widened
  to 500 ms under `.theme-anim`). Untinted tokens get **no** colour transition and ride
  `<body>` by inheritance.
- **Shiki JSON spans.** Each carries an explicit inline palette colour, so a theme flip
  must transition their own `color` — `JsonExportPanel` scopes a 500 ms colour transition
  to `:global(html.theme-anim) .shiki-export span`. Explicit colour ⇒ no inheritance
  compounding, so it stays flicker-free.
- **Mapping cards** already transition their (explicit, inline) palette colours via
  Tailwind `transition-colors duration-500`.

### The `html.theme-anim` window

`systemTheme.ts` calls `flashThemeTransition()` on a real theme change, adding
`theme-anim` to `<html>` for 500 ms (debounced). Its only job now is to _widen_ the
handful of elements whose own colour transition is normally faster — the tinted tokens
(280→500 ms) — and to arm the Shiki spans' colour transition, so their explicit-colour
shift matches the page during a theme flip without slowing the arrow-launch
tool-crossfade the rest of the time.

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
- **A resting `color` transition on the text fields.** The `.morph-*` textareas used to
  carry `transition: color 400ms ease-out` permanently (for the arrow-launch morph).
  Their colour is inherited, so this is the compounding trap above — with a twist per
  engine: WebKit showed the chase in computed style (target text settled ~900 ms), while
  **Chromium reported lockstep in `getComputedStyle` but painted the chase anyway**
  (painted pixels sat at ~50 % when the page was done). Painted-pixel measurement is the
  only truth for form controls. The morph transitions (and the `.exiting` colour values
  they animate) now live only under `.morph-*.exiting` — the destination state of the
  one-way arrow launch — so resting fields ride inheritance untransitioned.
- **Placeholder colour must be PLAIN `currentColor` — never a colour function of it.**
  Under a dark OS scheme (the prepaint stamps `color-scheme: dark` on `<html>`),
  Chromium fails to recompute `::placeholder` colours built from `color-mix()` or
  relative-colour syntax over `currentColor` when the inherited colour changes: after
  a toggle the placeholder keeps the previous theme's ink and camouflages into the new
  background. The UA default is exactly such a `color-mix`, so leaving the colour to
  the UA has the same bug. The fields declare `color: currentColor` with the 50 %
  dimming on the pseudo-element's `opacity` (identical visual math; plain
  `currentColor` and `var()`-based colours recompute correctly). Separately, pairing
  any author placeholder colour with a `transition: color` arms the inherited-change
  chase (the "target placeholder lags" symptom) — placeholders transition only
  `opacity`, and only under `.exiting`.
- **State-dependent inline `opacity` without an opacity transition.** The mapping card's
  bottom text opacity derives from `isDark` (`0.5`/`1` inactive-dark vs rest). With only
  `transition-colors` on the span, the flushed inline opacity snapped in one frame while
  every colour eased over 500 ms — the "bottom text flickers" symptom in all three
  engines. The spans use `transition-[color,opacity] duration-500`. Any inline style
  derived from `theme.current` must either be transitioned or be theme-invariant.

### Two more supporting fixes

- **`::placeholder` is `currentColor` + pseudo `opacity`, transitioned never (colour)
  / only under `.exiting` (opacity).** Three placeholder traps stack here: browsers
  don't re-resolve `light-dark()` on `::placeholder` when `color-scheme` changes (rules
  out `var(--page-fg)`); Chromium under a dark OS scheme doesn't recompute
  colour-functions-of-`currentColor` on `::placeholder` (rules out `color-mix` and the
  UA default — see the trap above); and an author colour plus a colour transition
  chases the flip. Plain `color: currentColor; opacity: 0.5` dodges all three and
  rides `<body>`'s transition in lockstep (verified Chromium / WebKit / Firefox, light
  and dark OS). The arrow-launch morph brightens the placeholder by transitioning the
  pseudo-element's `opacity` 0.5 → 1 under `.exiting`.
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
  real tool change, putting every DOM write into the same style recalc: one shared start
  frame for all transitions.

Verified across Chromium / WebKit / Firefox by driving a theme toggle in Playwright and
sampling each element's painted `color` per animation frame: provenance, "No mappings",
plain tokens, toolbar buttons, the toggle glyph and the JSON panel all trace the _same_
luminance curve as `<body>`, with no post-window drop.
