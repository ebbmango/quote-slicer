# Dark Mode Infrastructure

> Commits: `0a90f89`, `247b60c`  
> Date: 2026-06-21

## Overview

Full light/dark mode support: a no-flash prepaint script, a persistent cross-tab theme controller, and an animated toggle button. The system distinguishes between a user's explicit choice and the OS default, so a preference set on one tab is remembered across reloads but resets to the OS preference if all tabs are closed and a fresh session starts.

## Motivation

Without this, the app had no theme switching at all. The primary challenge was the usual one: SvelteKit renders on the server and ships `light` as the default, so without intervention a dark-mode user sees a white flash before hydration applies the correct class. A secondary challenge was state semantics — "prefer dark" should persist while the user has the app open, but should not be sticky forever (if you close every tab and come back on a different machine or device, it should follow the OS again).

## Architecture

Three layers:

**`src/app.html` prepaint script** — An inline `<script>` that runs synchronously before any CSS or JS loads. It reads `localStorage`, decides the correct mode, and stamps `html.dark` and `style="color-scheme: dark"` in the same task as the HTML parse. By the time the browser begins layout the correct class is already there, so no flash is possible. The script is a self-contained IIFE with no imports — it can't use any module code.

**`src/lib/themeState.ts` + `src/lib/systemTheme.ts`** — Pure logic (themeState) and browser-connected runtime (systemTheme). `themeState.ts` exports the state shape, storage keys, and all resolution logic as pure functions so they can be unit-tested without a DOM. `systemTheme.ts` wires those functions to `localStorage`, `BroadcastChannel`, OS media queries, and a heartbeat timer that keeps the tab registry alive. `adaptiveTheme()` returns a Svelte-reactive object (`get/set current`) backed by `createSubscriber`.

**`src/lib/components/ThemeToggle.svelte`** — Two buttons (moon on top, sun on bottom) inside a clipped orbit container. The stack rotates 180° per toggle; `overflow: hidden` clips the upper half so only the bottom icon is visible at rest. Each toggle swings the off-screen icon down into view. `mask-image` fades the top edge so the entering icon dissolves rather than snapping in.

## Implementation Details

**No-flash strategy:** The prepaint script duplicates the state-parsing logic from `themeState.ts` — same schema, same validation, same `hasContinuity` decision. This duplication is intentional: the script runs before modules are available and must be kept small. Any change to the storage schema requires updating both files.

**State semantics:** The stored state carries both `mode` (the actual theme) and `systemMode` (what the OS was showing when the state was written). On load, if `storedState.systemMode !== currentSystemMode`, the preference is stale (the user changed their OS preference since last visit) and is discarded in favour of the new system default. This means a user who explicitly chose dark on a light-mode OS will have their preference reset if they switch the OS to dark — but that edge case is considered acceptable.

**Tab registry:** Two keys in `localStorage`: `quote-slicer:theme-state:v1` (the mode) and `quote-slicer:theme-tabs:v1` (a map of `tabId → { seenAt }`, heartbeated every 30 s). "Continuity" means at least one tab entry is not stale (5-minute TTL), or the last-empty timestamp is within 5 minutes (reload grace). Without continuity, user preferences are cleared and the OS default applies.

**Cross-tab sync:** `BroadcastChannel('theme-sync')` carries `{ type: 'state', source: tabId, state }` messages. On message, the receiver calls `resolveExternalThemeState` to decide whether to `adopt`, `ignore`, or `publish-system` (the incoming state has a stale `systemMode`). A new tab also sends a `{ type: 'request' }` message; existing tabs reply with their current state so the new tab inherits the live theme before its own storage read settles.

**ThemeToggle hydration guard:** On SSR, `theme.current` is always `'light'`, so the server renders rotation 0 (sun visible). The prepaint script may have set `html.dark` before hydration, so the CSS pre-hydration rules (`html.dark .theme-toggle { rotate: 180deg }`) snap to the right position without a visible transition. A `data-hydrated` attribute is set on `mount`; only then do the CSS transition rules engage (`transition: rotate 800ms`). This prevents Firefox from competing with Svelte's inline `--theme-toggle-rotation` variable: without the guard, `html.dark` changing the `rotate` value synchronously (before Svelte flushes) caused Firefox to start the transition from the wrong angle every other toggle.

**`clip-path` vs `overflow: hidden`:** The orbit container was initially implemented with `clip-path`. Firefox does not repaint a `clip-path` region when a descendant is being transformed, which caused the leaving icon to drop on alternate toggles. Switching to `overflow: hidden` fixed the repaint issue. `mask-image` is used alongside it purely for the fade effect (not clipping), so Firefox's repaint issue doesn't apply to it.

## Design Decisions

- **`BroadcastChannel` + `localStorage` storage event** — `BroadcastChannel` is same-origin only and same-browser. `localStorage` storage events fire in other tabs in the same browser. Both are used: Channel for fast same-browser sync, storage event as fallback for environments without `BroadcastChannel`.
- **No SSR theme** — The server always returns `light`. The no-flash script corrects this before first paint. An alternative would be reading a cookie during SSR to inject the correct class server-side, but that requires a server and the app is fully static.
- **No-js simplification (`247b60c`)** — After landing, the no-JS CSS variant was removed. The app requires JS to function at all; the `no-js` handling was carried over from the docs site. Without JS, `color-scheme: light dark` on `<html>` lets the browser follow the OS preference natively.

## Areas to Be Careful

The prepaint script in `app.html` and the logic in `themeState.ts` must stay in sync. They share the same storage key (`quote-slicer:theme-state:v1`), the same schema version (`version: 1`), and the same `hasContinuity` decision. Changing the schema requires bumping the version string in both places and handling migration.

The `data-hydrated` attribute on `.theme-clip` is load-bearing for the toggle animation correctness in Firefox. Removing it or moving `hasHydrated = true` earlier than `onMount` will reintroduce the wrong-angle transition bug.
