# Theme System (Light / Dark)

Ported from `quote-slicer-docs`. Reference implementation: `/Users/ebbmango/Coding/quote-slicer-docs`.

---

## UX Intent

The intended behavior is **"most recent change wins"**, whether that change came from the OS or the user:

- On first load: follow the OS preference.
- OS changes later: adopt them immediately.
- User clicks the toggle: switch, and stay switched until the next OS or user change.
- All open tabs: stay in sync at all times (via the native `storage` event).
- Reloads and full closes: preserve the active theme. A manual pick is durable — it persists until the user or the OS changes it.

The only thing that overrides a stored pick while the app is away is the OS preference itself changing, detected on the next load by comparing against `osAtPick`.

> This replaced an earlier revert-to-OS-after-all-tabs-closed model (a 5-minute grace + tab registry, `BroadcastChannel` sync). See ADR 0001 (`quote-slicer-docs/docs/adr/0001-theme-last-change-wins.md`) for why.

---

## File Map

```
src/
├── app.html                                         # Pre-hydration inline script (no-flash)
├── lib/
│   ├── types.ts                                     # Mode type
│   ├── theme.ts                                     # Singleton export
│   ├── systemTheme.ts                               # Runtime controller (adaptiveTheme)
│   ├── themeState.ts                                # Pure state logic, parsers, resolvers
│   └── styles/
│       ├── index.css                                # Entry: imports + Tailwind dark variant
│       ├── base.css                                 # html/body rules, transitions, dark class
│       ├── theme.css                                # @theme palette tokens
│       └── colors/
│           ├── tokens.css                           # Per-color token vars (hanzi/latin)
│           ├── gloss.css                            # Per-color gloss vars
│           ├── group.css                            # Per-color group vars
│           ├── verse.css                            # Per-color verse vars
│           └── accents.css                          # acc-0..8 shorthand layer
└── components/
    └── Menu/
        ├── Navbar.svelte                            # Wires both toggles
        └── Buttons/
            ├── ThemeToggle.svelte                   # Top-nav simple toggle (CSS-only)
            └── AnimatedThemeToggle.svelte           # Sidebar animated rotating toggle
routes/
└── +layout.svelte                                   # Root layout: imports CSS, reads theme.current
```

---

## Layer 1 — Type

**`src/lib/types.ts`**

```ts
export type Mode = 'dark' | 'light';
```

Everything uses this single union type. No enums, no booleans.

---

## Layer 2 — CSS

### `src/lib/styles/theme.css`

Defines design-token palette via Tailwind's `@theme` block. Pure static values — no dark/light branching here.

```css
@theme {
  --color-noctis: #1b1b1b;   /* darkest background */
  --color-silver: #8f8f8f;
  --color-white:  #ffffff;
  /* ...etc */
}
```

### `src/lib/styles/index.css`

Entry point. Crucially defines the **`@custom-variant dark`** so Tailwind's `dark:` prefix works correctly:

```css
@import 'tailwindcss';
@import './base.css';
@import './theme.css';
@import './colors/accents.css';
/* ...etc */

@custom-variant dark {
  /* JS path: .dark class toggled by JavaScript */
  &:where(.dark, .dark *) {
    @slot;
  }

  /* No-JS fallback: respect OS preference directly */
  @media (prefers-color-scheme: dark) {
    &:where(html.no-js, html.no-js *) {
      @slot;
    }
  }
}
```

This means `dark:` utility classes work in two situations:
1. JS is active → `.dark` class on `<html>`.
2. JS is disabled → `@media (prefers-color-scheme: dark)` on `html.no-js`.

Other custom variants defined here:
- `js-only` / `no-js` — scoped to `html.js` / `html.no-js`
- `hocus` — `:hover, :focus-visible`
- `touch` / `mouse` — pointer media queries

### `src/lib/styles/base.css`

Controls the actual light/dark appearance. Key rules:

```css
html {
  color-scheme: light;           /* default; overridden to "dark" by JS */
  --page-bg: light-dark(white, var(--color-noctis));
  /* more light-dark() vars... */
}

html,
body {
  background-color: var(--page-bg);
  transition: background-color 500ms ease, color 500ms ease;
}

html.no-js {
  color-scheme: light dark;      /* browser picks from OS when no JS */
}

html.dark {
  color-scheme: dark;
  --inline-mono-weight: 300;
}

article, article *, main {
  transition: color 500ms ease, background-color 500ms ease, border-color 500ms ease;
}
```

`light-dark()` is a CSS function: `light-dark(light-value, dark-value)` — it resolves based on `color-scheme`. So setting `color-scheme: dark` on `html.dark` is what makes `light-dark()` resolve to the dark variant. No extra CSS selectors needed for those vars.

### `src/lib/styles/colors/*.css`

Semantic color variables for the app's named palette (applesour, lush, seabreeze, azure, compostella, sugar, strawberry, maple, beeswax). Each file follows the same pattern: define `:root` values for light, then `.dark { }` overrides for dark.

Example from `tokens.css`:
```css
:root {
  --applesour-token-latin: #89ac00;
  --applesour-token-hanzi: #aac834;
}
.dark {
  --applesour-token-latin: var(--applesour-token-hanzi); /* brighten for dark bg */
}
```

`accents.css` adds a convenience layer (`--acc-0` through `--acc-8`) that maps to the token vars for both `:root` and `.dark`.

---

## Layer 3 — Pre-hydration Script

**`src/app.html`** — runs before any JavaScript framework loads.

### What it does

1. Reads `localStorage` for a previously stored theme state.
2. Reads the OS preference via `window.matchMedia('(prefers-color-scheme: dark)')`.
3. Applies the correct theme to `<html>` *before the first paint*, preventing flash.

### State format (`localStorage`)

One key: `quote-slicer:theme-state:v2`.

```js
{
  version: 2,
  mode: 'light' | 'dark',      // the resolved theme to apply
  source: 'system' | 'user',   // who set it (informational)
  osAtPick: 'light' | 'dark'   // OS preference when this state was written
}
```

`osAtPick` is the whole trick: it lets a load detect that the OS preference
changed while the app was closed (see ADR 0001).

### Resolution logic (mirrored in both app.html and themeState.ts)

```
1. Parse storedState from localStorage.
2. If storedState is valid AND storedState.osAtPick === currentOS → apply storedState.mode.
3. Otherwise (first visit, corrupt, or OS drifted while away) → apply currentOS.
```

That is the entire rule. No tab registry, heartbeat, or grace window: a manual
pick persists across close, and only a genuine OS change overrides it. The logic
is duplicated in plain JS inside `app.html` so it runs before any module
bundling; `themeState.ts` exposes it as `resolveTheme`.

### `applyTheme` in the inline script

```js
const applyTheme = (mode) => {
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
};
```

Both the class and the `colorScheme` style must be set — the class drives Tailwind/CSS selectors, the style drives `light-dark()` and browser chrome.

---

## Layer 4 — Pure State Logic

**`src/lib/themeState.ts`** — zero side effects, fully testable.

Exports:
- `StoredThemeState`, `ThemeSource`, `StorageLike` — types
- `THEME_STATE_KEY` — the single localStorage key (`quote-slicer:theme-state:v2`)
- `toMode(systemIsDark)` — maps a media-query boolean to a `Mode`
- `systemState(osMode)` / `userState(mode, osMode)` — build a state object
- `parseThemeState(string | null)` — validates + parses the localStorage value
- `resolveTheme(stored, osMode)` → `{ mode, state, fresh }` — the core rule

### `resolveTheme`

The one decision, "last change wins, OS-drift-aware":

```
if stored && stored.osAtPick === osMode → { mode: stored.mode, state: stored, fresh: false }
else                                     → { mode: osMode, state: systemState(osMode), fresh: true }
```

`fresh` tells the caller whether the resolved state is new (first visit or OS
drift — must be persisted) or the stored state returned unchanged. No timestamps,
tab registry, or external-state reconciliation remain — see ADR 0001 for why.

---

## Layer 5 — Runtime Controller

**`src/lib/systemTheme.ts`** — the `adaptiveTheme()` function.

Returns `{ get current(): Mode, set current(mode: Mode) }`. On the server it
returns a static `'light'` stub.

### Initialization

```
1. media = window.matchMedia('(prefers-color-scheme: dark)')
2. resolveTheme(read(), getSystemMode()) → initial mode
3. applyDocumentTheme(currentMode) → set html.dark class + colorScheme immediately
4. if the resolved state is fresh, write it back to localStorage
```

No tab id, no `BroadcastChannel`, no `registerTab`, no heartbeat interval.

### `applyDocumentTheme`

```ts
function applyDocumentTheme(mode: Mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.style.colorScheme = mode;
}
```

Called on init and inside `set`. The pre-hydration script already did this once;
`systemTheme.ts` re-applies it to stay authoritative after hydration.

### `set` — the central setter

All theme changes go through here:

```ts
const set = (state, { persist = true } = {}) => {
  const changed = state.mode !== currentMode;
  currentMode = state.mode;
  applyDocumentTheme(currentMode);
  if (changed) flashThemeTransition();   // app-specific: html.theme-anim for the flip
  if (persist) write(state);
  if (changed) notify();
};
```

`persist: false` is used when adopting a state another tab already wrote (via the
`storage` event), so the write isn't echoed back.

### `flashThemeTransition` (app-specific)

On an actual mode flip, marks `<html>` with `theme-anim` for 500ms so components
whose colour normally crossfades faster (e.g. the token spans' 280ms transition)
widen to the page's 500ms transition and settle together. Cleared afterward.
Independent of theme resolution — it exists only for the app's animated palette,
not the docs site.

### Svelte reactivity via `createSubscriber`

```ts
let notify = () => {};

const subscribe = createSubscriber((update) => {
  notify = update;   // expose update() outside the subscriber body

  media.addEventListener('change', onMedia);       // live OS change → follow OS
  window.addEventListener('storage', onStorage);   // another tab wrote → adopt
  document.addEventListener('visibilitychange', onReturn);
  window.addEventListener('pageshow', onReturn);
  window.addEventListener('focus', onReturn);

  return () => { /* cleanup: remove all listeners */ };
});
```

The getter calls `subscribe()`, so reading `theme.current` inside a `$effect`
registers a reactive dependency; `notify()` (= `update()`) re-runs it later.

### Tab synchronization

The native **`storage` event** is the whole mechanism. When one tab writes the
theme key, every other tab receives the event, re-reads `localStorage`, and
adopts the value (`reconcile({ persist: false })`). A newly opened tab needs no
handshake — it reads the key on load. `onReturn` (visibility / pageshow / focus)
re-reconciles a tab that may have missed an OS change while hidden. No
`BroadcastChannel`, tab registry, heartbeat, or `pagehide` teardown.

### OS change handler

```ts
const onMedia = () => set(systemState(getSystemMode()));
```

When the OS switches theme, each open tab detects it via its own `media.change`
listener and follows — the most recent change wins over any prior manual pick.

### Singleton export

**`src/lib/theme.ts`**:
```ts
import { adaptiveTheme } from '$lib/systemTheme';
export const theme = adaptiveTheme();
```

`adaptiveTheme()` is called exactly once at module load time. All components import `theme` from here — never call `adaptiveTheme()` themselves.

---

## Layer 6 — Root Layout

**`src/routes/+layout.svelte`**

```svelte
<script>
  import '../lib/styles/index.css';
  import { theme } from '$lib/theme';

  let favicon = $derived(theme.current === 'dark' ? faviconWhite : faviconBlack);
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>
```

Reading `theme.current` in `$derived` registers the reactive dependency. The actual DOM class toggling (`html.dark`) is done by `applyDocumentTheme` inside `systemTheme.ts` — the layout does NOT need an `$effect` for that. The favicon swap is the main reactive job of the layout.

> **Note:** The diary entry (`reactive-theme.svx`) describes an older version where the layout had an `$effect` that toggled the class. In the current implementation, `systemTheme.ts` handles the class toggle directly via `applyDocumentTheme()`. The layout only needs reactivity for the favicon.

---

## Layer 7 — UI Components

### `ThemeToggle.svelte` (top nav, mobile/desktop narrow)

Simple CSS-only icon swap. No JS state. Receives a `toggle` prop (function):

```svelte
<script>
  const { toggle } = $props();
</script>

<button onclick={toggle} class="top-theme-toggle ...">
  <!-- sun icons (light-mode visible) -->
  <span class="top-theme-icon top-theme-light-mode" data-weight="light">...</span>
  <span class="top-theme-icon top-theme-light-mode" data-weight="solid">...</span>
  <!-- moon icons (dark-mode visible) -->
  <span class="top-theme-icon top-theme-dark-mode" data-weight="light">...</span>
  <span class="top-theme-icon top-theme-dark-mode" data-weight="solid">...</span>
</button>

<style>
  /* hide dark-mode icons by default, show when html.dark */
  .top-theme-dark-mode, :global(html.dark) .top-theme-light-mode { display: none; }
  :global(html.dark) .top-theme-dark-mode { display: flex; }

  /* light icon at rest, solid on hover/focus */
  .top-theme-icon[data-weight='light'] { opacity: 0.3; }
  .top-theme-toggle:hover .top-theme-icon[data-weight='light']  { opacity: 0; }
  .top-theme-toggle:hover .top-theme-icon[data-weight='solid']  { opacity: 0.6; }
</style>
```

The `toggle` function is defined in `Navbar.svelte`:
```ts
const toggle = () => {
  const nextMode = theme.current === 'dark' ? 'light' : 'dark';
  theme.current = nextMode;
};
```

### `AnimatedThemeToggle.svelte` (sidebar, desktop)

More complex. Has a vertically-stacked sun (top) + moon (bottom) pair that **rotates 180°** to flip between them. Key points:

- Two buttons stacked in a `div` with `rotate` CSS.
- The outer `div` rotates; an inner `.theme-toggle-counter` counter-rotates each icon so icons stay upright during the container rotation.
- **Pre-hydration:** before JS, the CSS `--theme-toggle-initial-rotation` is used (set by `:global(html.dark)` rule). After hydration, the `data-hydrated="true"` attribute enables `rotate` driven by the inline `--theme-toggle-rotation` JS variable.
- This avoids animation flash on load: initial rotation is set by CSS (reads `.dark` class), subsequent clicks animate via JS state.

```svelte
<script>
  import { theme } from '$lib/theme';
  let hasHydrated = $state(false);
  let rotation = $state(theme.current === 'dark' ? 180 : 0);

  onMount(() => { hasHydrated = true; });

  const toggle = (event) => {
    const nextMode = theme.current === 'dark' ? 'light' : 'dark';
    rotation += 180;
    theme.current = nextMode;
    // focus management: move focus to the now-visible button
  };

  $effect(() => {
    // React to external theme changes (other tab, OS change)
    const currentMode = theme.current;
    if (currentMode === displayedMode) return;
    rotation += 180;
    displayedMode = currentMode;
  });
</script>

<div
  class="theme-toggle ..."
  style="--theme-toggle-rotation: {rotation}deg; ..."
  data-hydrated={hasHydrated ? 'true' : undefined}
>
  <button ...>sun icon pair</button>
  <button ...>moon icon pair</button>
</div>

<style>
  .theme-toggle {
    rotate: var(--theme-toggle-initial-rotation); /* CSS-driven before hydration */
    transition: color 400ms;
  }
  :global(html.dark) .theme-toggle {
    --theme-toggle-initial-rotation: 180deg;
  }
  .theme-toggle[data-hydrated='true'] {
    rotate: var(--theme-toggle-rotation);          /* JS-driven after hydration */
    transition: rotate 800ms, color 400ms;
  }
</style>
```

Icon visibility: each button shows a `light` icon (dim, at rest) and a `solid` icon (brighter, on hover/focus). Controlled via `activeControl` state (which button is hovered/focused). The "active" control is determined by tracking pointer position with `requestAnimationFrame`.

Accessibility: only the currently-active button (the one that would switch away from current mode) has `tabindex=0`. The other has `tabindex=-1`. After clicking, focus is moved to the new active button.

---

## Reproduction Checklist

1. **Copy `src/lib/types.ts`** — `Mode` type.

2. **Copy `src/lib/themeState.ts`** — update the single localStorage key constant:
   ```ts
   export const THEME_STATE_KEY = 'YOUR-APP-NAME:theme-state:v2';
   ```

3. **Copy `src/lib/systemTheme.ts`.** The only app-specific part is `flashThemeTransition` (`html.theme-anim`); drop it if you don't have the animated palette.

4. **Copy `src/lib/theme.ts`** verbatim.

5. **Copy the `<script>` block from `src/app.html`** into your own `app.html`.
   - Update the `STATE_KEY` inline constant to match step 2; keep it in sync with `resolveTheme` in `themeState.ts`.

6. **CSS — `index.css`**: define the `@custom-variant dark` exactly as shown. This is non-negotiable for Tailwind `dark:` to work.

7. **CSS — `base.css`**: add rules for `html`, `html.dark`, `html.no-js` as shown. Use `light-dark()` for values that differ per mode.

8. **Root layout** (`+layout.svelte`): import CSS here, import `theme`, use `theme.current` in `$derived` for anything reactive (e.g. favicon). Do NOT add an `$effect` to toggle `.dark` — `systemTheme.ts` owns that.

9. **Toggle UI**: implement at minimum a simple button that calls `theme.current = nextMode`. `ThemeToggle.svelte` is the simplest pattern. `AnimatedThemeToggle.svelte` is more complex but self-contained — copy it if you want the same sidebar animation.

10. **Color palette CSS**: the `colors/*.css` files are specific to the docs site color system. Replace with your own semantic variables following the same `.dark {}` override pattern.

---

## Gotchas

- **`applyDocumentTheme` is called in `systemTheme.ts`, not the layout.** The layout used to have an `$effect` for this (described in the diary), but the current code handles it inside the controller. Don't add a redundant layout effect.
- **The inline script in `app.html` duplicates `resolveTheme` from `themeState.ts`** intentionally — it runs before any module is available. Keep them in sync manually if you change the state format or key name.
- **`createSubscriber` is called on every `theme.current` read in a reactive context** — that's normal and expected. Svelte deduplicates subscriptions.
- **Cross-tab sync is the native `storage` event** — it fires only in *other* tabs on a write, which is exactly what's needed; the writing tab already updated itself.
- **The animated toggle has a no-JS guard**: `html.no-js .side-nav-footer { display: none }` in `Navbar.svelte` hides the animated toggle entirely when JS is disabled (it can't work without it). The simpler `ThemeToggle` in the top nav has a `no-js:hidden` utility class for the same reason. The no-JS user only gets CSS-driven system theme via the `@custom-variant dark` media query fallback.
