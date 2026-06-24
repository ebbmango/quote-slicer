# Theme System (Light / Dark)

Ported from `quote-slicer-docs`. Reference implementation: `/Users/ebbmango/Coding/quote-slicer-docs`.

---

## UX Intent

The intended behavior is **"most recent change wins"**, whether that change came from the OS or the user:

- On first load: follow the OS preference.
- OS changes later: adopt them immediately.
- User clicks the toggle: switch, and stay switched until the next OS or user change.
- All open tabs: stay in sync at all times.
- Page reload: preserve the active theme (including user overrides), up to a 5-minute grace window after the last tab closes.

There is no persistent "manual override" mode that survives closing all tabs. Once all tabs are gone (and the grace window expires), the next visit resets to OS default.

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

1. Swaps `html.no-js` → `html.js` immediately (so no-JS fallback CSS is suppressed).
2. Reads `localStorage` for a previously stored theme state.
3. Reads the OS preference via `window.matchMedia('(prefers-color-scheme: dark)')`.
4. Applies the correct theme to `<html>` *before the first paint*, preventing flash.

### State format (`localStorage`)

Two keys:

| Key | Purpose |
|-----|---------|
| `quote-slicer-docs:theme-state:v1` | Current theme state object |
| `quote-slicer-docs:theme-tabs:v1` | Tab registry (active tabs + last-empty timestamp) |

Theme state shape:
```js
{
  version: 1,
  mode: 'light' | 'dark',          // the resolved theme to apply
  source: 'system' | 'user',       // who set it
  systemMode: 'light' | 'dark',    // OS mode at the time of writing
  updatedAt: number,                // Date.now()
  writerTabId: string               // unique tab identifier
}
```

Tab registry shape:
```js
{
  version: 1,
  tabs: { [tabId]: { seenAt: number } },
  lastEmptyAt?: number              // when all tabs last disappeared
}
```

### Resolution logic (mirrored in both app.html and themeState.ts)

```
1. Parse storedState and registry from localStorage.
2. Prune tabs older than STALE_TAB_MS (300,000ms = 5min).
3. Determine hasContinuity:
   - activeTabCount > 0, OR
   - it's a reload AND lastEmptyAt is within RELOAD_GRACE_MS (300,000ms)
4. If storedState exists AND hasContinuity:
   - If storedState.systemMode !== currentSystemMode → ignore stored, use OS (system changed)
   - Else → apply storedState.mode
5. Otherwise → apply currentSystemMode (fresh start)
```

This logic is deliberately duplicated in plain JS inside `app.html` so it runs before any module bundling.

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
- `StoredThemeState`, `StoredTabRegistry`, `ThemeResolution` — types
- `createSystemState(systemMode, now, tabId)` — builds a system-sourced state object
- `createUserState(mode, systemMode, now, tabId)` — builds a user-sourced state object
- `parseThemeState(string | null)` — validates + parses localStorage value
- `parseTabRegistry(string | null)` — validates + parses tab registry
- `pruneTabRegistry(registry, now)` — removes stale tabs, sets `lastEmptyAt`
- `resolveStoredTheme(input)` — returns `ThemeResolution` (what mode to use + what to write back)
- `resolveExternalThemeState(input)` → `'adopt' | 'ignore' | 'publish-system'`
- `isStateNewer(candidate, current)` — timestamp + tabId tiebreaker comparison
- `readThemeState(storage)`, `readTabRegistry(storage)`, `writeThemeState(...)`, etc.

Constants:
```ts
export const HEARTBEAT_MS     = 30_000;   // tab heartbeat interval
export const STALE_TAB_MS     = 300_000;  // tab considered dead after 5min silence
export const RELOAD_GRACE_MS  = 300_000;  // grace window after last tab closes
```

### `resolveExternalThemeState`

Called when a message arrives from another tab:

```
if incomingState.systemMode !== currentSystemMode:
  if incomingState.source === 'system' → 'ignore'  (stale system state from old OS mode)
  else → 'publish-system'                           (their user pref is stale, correct them)
if incomingState is newer OR has different mode → 'adopt'
else → 'ignore'
```

---

## Layer 5 — Runtime Controller

**`src/lib/systemTheme.ts`** — the `adaptiveTheme()` function.

Returns `{ get current(): Mode, set current(mode: Mode) }`.

### Initialization sequence

```
1. getTabId()          → crypto.randomUUID() or fallback
2. window.matchMedia() → detect system preference
3. new BroadcastChannel('theme-sync') (or null if unavailable)
4. resolveInitialState() → read localStorage, run resolveStoredTheme, write back as needed
5. registerTab()       → add this tab to the registry
6. applyDocumentTheme(currentMode) → set html.dark class + colorScheme immediately
7. setInterval(heartbeatTab, HEARTBEAT_MS) → keep tab alive
```

### `applyDocumentTheme`

```ts
function applyDocumentTheme(mode: Mode) {
  document.documentElement.classList.toggle('dark', mode === 'dark');
  document.documentElement.style.colorScheme = mode;
}
```

Called on init AND inside `setCurrentState`. The pre-hydration script already did this, but `systemTheme.ts` re-applies it to stay authoritative after hydration.

### `setCurrentState`

Central setter — all theme changes go through here:

```ts
const setCurrentState = (state, options = {}) => {
  const modeChanged = state.mode !== currentMode;
  currentState = state;
  currentMode  = state.mode;
  applyDocumentTheme(currentMode);

  if (options.write !== false)     writeThemeState(localStorage, state);
  if (options.broadcast !== false) broadcastState(state);
  if (modeChanged && options.notify !== false) notify();
};
```

`options.write: false` and `options.broadcast: false` are used when adopting a state that came from another tab (already written/broadcast by the sender).

### Svelte reactivity via `createSubscriber`

```ts
let notify = () => {};

const subscribe = createSubscriber((update) => {
  notify = update;   // expose update() outside the subscriber body

  // attach all event listeners here:
  media.addEventListener('change', mediaHandler);
  channel?.addEventListener('message', channelHandler);
  window.addEventListener('storage', storageHandler);
  document.addEventListener('visibilitychange', visibilityHandler);
  window.addEventListener('pageshow', pageShowHandler);
  window.addEventListener('focus', focusHandler);

  channel?.postMessage({ type: 'request', source: tabId }); // ask peers for current state

  return () => { /* cleanup: remove all listeners */ };
});
```

The getter:
```ts
get current(): Mode {
  subscribe();       // registers dependency in active reactive context
  return currentMode;
}
```

When `theme.current` is read inside a `$effect`, Svelte sees the `subscribe()` call and tracks it as a reactive dependency. Later, calling `notify()` (= `update()`) re-runs that effect.

### Tab synchronization

**BroadcastChannel** (`'theme-sync'`) — primary, same-origin cross-tab:

Messages: `{ type: 'request', source: tabId }` or `{ type: 'state', source: tabId, state: StoredThemeState }`.

Protocol:
1. On init, new tab broadcasts `request`.
2. Other tabs respond with their current `state`.
3. New tab calls `handleExternalState()` → `resolveExternalThemeState()` → adopt or ignore.
4. On every user-initiated change, current tab broadcasts `state`.

**`storage` event** — secondary, catches tabs in other windows where BroadcastChannel may not fire:
```ts
window.addEventListener('storage', (event) => {
  if (event.key !== THEME_STATE_KEY || !event.newValue) return;
  const state = readThemeState(window.localStorage);
  if (state) handleExternalState(state);
});
```

**Reconciliation on visibility/focus/pageshow** — catches tabs that were backgrounded:
```ts
const visibilityHandler = () => {
  if (document.visibilityState === 'visible') reconcileStoredTheme();
};
```

**Tab lifecycle:**
- `registerTab()` on init: writes `{ seenAt: now }` into registry.
- `heartbeatTab()` every 30s: refreshes `seenAt`.
- `unregisterTab()` on `pagehide` (non-persisted): removes tab, sets `lastEmptyAt` if registry empties.

### OS change handler

```ts
const mediaHandler = () => publishSystemState();

const publishSystemState = () => {
  setCurrentState(createSystemState(getSystemMode(), Date.now(), tabId));
};
```

When the OS switches theme, all tabs independently detect it via their own `media.change` listener, and each one calls `publishSystemState()`. They converge on the same mode because it comes from the same OS signal.

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

2. **Copy `src/lib/themeState.ts`** — update the two localStorage key constants:
   ```ts
   export const THEME_STATE_KEY = 'YOUR-APP-NAME:theme-state:v1';
   export const THEME_TABS_KEY  = 'YOUR-APP-NAME:theme-tabs:v1';
   ```

3. **Copy `src/lib/systemTheme.ts`** verbatim (no app-specific strings).

4. **Copy `src/lib/theme.ts`** verbatim.

5. **Copy the `<script>` block from `src/app.html`** into your own `app.html`.
   - Update the two localStorage key strings to match step 2.
   - The `STATE_KEY` and `TABS_KEY` inline constants must stay in sync with `themeState.ts`.
   - Keep `html.no-js` on the `<html>` tag — the script swaps it to `html.js`.

6. **CSS — `index.css`**: define the `@custom-variant dark` exactly as shown. This is non-negotiable for Tailwind `dark:` to work.

7. **CSS — `base.css`**: add rules for `html`, `html.dark`, `html.no-js` as shown. Use `light-dark()` for values that differ per mode.

8. **Root layout** (`+layout.svelte`): import CSS here, import `theme`, use `theme.current` in `$derived` for anything reactive (e.g. favicon). Do NOT add an `$effect` to toggle `.dark` — `systemTheme.ts` owns that.

9. **Toggle UI**: implement at minimum a simple button that calls `theme.current = nextMode`. `ThemeToggle.svelte` is the simplest pattern. `AnimatedThemeToggle.svelte` is more complex but self-contained — copy it if you want the same sidebar animation.

10. **Color palette CSS**: the `colors/*.css` files are specific to the docs site color system. Replace with your own semantic variables following the same `.dark {}` override pattern.

---

## Gotchas

- **`applyDocumentTheme` is called in `systemTheme.ts`, not the layout.** The layout used to have an `$effect` for this (described in the diary), but the current code handles it inside the controller. Don't add a redundant layout effect.
- **The inline script in `app.html` duplicates logic from `themeState.ts`** intentionally — it runs before any module is available. Keep them in sync manually if you change the state format or key names.
- **`createSubscriber` is called on every `theme.current` read in a reactive context** — that's normal and expected. Svelte deduplicates subscriptions.
- **`BroadcastChannel` is guarded** (`typeof BroadcastChannel === 'function'`) for environments where it's unavailable. The `storage` event serves as fallback.
- **`pagehide` (not `beforeunload`)** is used for tab unregistration because `beforeunload` doesn't fire reliably on mobile. `event.persisted` check skips the teardown for BFCache restores.
- **The animated toggle has a no-JS guard**: `html.no-js .side-nav-footer { display: none }` in `Navbar.svelte` hides the animated toggle entirely when JS is disabled (it can't work without it). The simpler `ThemeToggle` in the top nav has a `no-js:hidden` utility class for the same reason. The no-JS user only gets CSS-driven system theme via the `@custom-variant dark` media query fallback.
