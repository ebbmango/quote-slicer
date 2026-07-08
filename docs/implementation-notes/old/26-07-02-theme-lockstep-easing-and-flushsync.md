# Theme lockstep: easing mismatch and Svelte batching (2026-07-02)

## Bug: mapping cards lag during theme flip

User report: during light↔dark theme transition, mapping cards visibly settle _after_ the rest of the page, even though everything transitions 500 ms. The page background + text finish the color shift while cards are still moving. Not a frame-rate stutter (that would be paint jank); the transitions themselves were asynchronous.

## Root causes

### 1. Easing curve divergence

`html, body` transition colors over 500 ms with `ease` (equivalent to
`cubic-bezier(0.25, 0.1, 0.25, 1)`). Mapping cards use Tailwind's
`transition-colors duration-500`, which applies Tailwind's _default_ timing
function: `cubic-bezier(0.4, 0, 0.2, 1)` — a different curve altogether.

Same duration, different easing → mid-flip the card is at 37% progress while
the page is at 51%. The lag compounds as they diverge; by 450 ms one is done,
the other still moving. The eye sees this.

**Fix:** `layout.css` now defines `--default-transition-timing-function: ease`
in the `@theme` block. Every Tailwind utility class that uses `transition-*`
(without an explicit `ease-*` modifier) pulls from that theme variable instead
of the built-in default. Cards, buttons, any Tailwind-transitioned surface now
shares the page's curve app-wide.

**Why this is load-bearing:** Tailwind's defaults are good for most apps, but
our spec demands pixel-perfect lockstep. Never add per-element `ease-cubic`,
`ease-in`, etc. utilities; they'd diverge again. The theme variable keeps one
curve everywhere.

### 2. Svelte batched flush lands one frame late

Card colors are derived Svelte state: `style="background: {theme.cardBg};"`
updates when `appTheme.current` changes. In `systemTheme.ts`, the theme flip
does:

```ts
applyThemeClass(currentMode); // toggle .dark on <html>
// ... rest of function continues ...
notify(); // triggers Svelte re-renders
```

The class flip drives the HTML/body color transition _immediately_. But Svelte
batches all re-renders in that `notify()` call into a single flush that lands
asynchronously, in Chromium usually one frame later (16 ms). So:

- Frame 1 (t=0): `.dark` toggles → page colors start animating
- Frame 2 (t=16): Svelte flushes → card inline styles update → card colors
  start animating, 16 ms behind

This also affected Shiki-exported JSON spans (same inline `style="color: ..."`
pattern) and the delete button's SVG `fill` attributes (Svelte-driven).

**Fix:** `systemTheme.ts` now calls `flushSync()` immediately after `notify()`.
Svelte's `flushSync()` forces the reactive update to run in the _current_ task,
not a batched one. Now:

- Frame 1 (t=0): `.dark` toggles → `notify()` fires → `flushSync()` runs
  → card inline styles update in the same paint cycle → all transitions start
  together

**Why this is fragile:** This relies on `flushSync()` not being removed or
re-semanticized in a future Svelte major version. The commit message documents
the reason ("same style recalc") so if it breaks, a future developer can
search for "flushSync" and understand why it's there. Also guards it with a
regression test (`theme-lockstep.e2e.ts`).

## Verification

Per-frame luminance sampling in Playwright across Chromium, WebKit, and Firefox:

**Before fixes:**

- Chromium: body start 60 ms, card start 77 ms (17 ms lag) + easing divergence
- WebKit: body start 103 ms, card start 103 ms (good) but wrong curves
- Firefox: similar to Chromium

**After fixes:**

- All engines: body and all card surfaces start same frame, follow identical
  luminance curves within 1% at every checkpoint. Painted-pixel truth (decode
  mid-flip screenshots) confirms: progress values identical within 0.3 % across
  body bg, card top, card bottom.

## Where it could rot

1. **Tailwind version upgrade.** If Tailwind changes its default timing
   function or the theme variable is ignored, cards diverge. Guard: run
   `src/routes/theme-lockstep.e2e.ts` after any Tailwind bump; the spec
   asserts all transition timing functions are the same.

2. **Svelte version upgrade.** If `flushSync()` is removed or re-semanticized,
   the Chromium 1-frame lag returns. Guard: the e2e test also asserts card
   inline colors update in the same task as the class flip.

3. **Someone adds `ease-*` utility to a card or surface.** Tailwind utilities
   have high specificity; a `class="ease-in-out"` would override the theme
   variable. Guard: linting rule or code review. The docs note is now in
   [themes.md](../../themes.md#traps-that-reintroduce-the-bug-all-fixed-keep-them-fixed).

## Commits

`fb0265f` — fix(theme): synchronize mapping card transitions with page

Also touches:

- `src/routes/layout.css` — added `--default-transition-timing-function: ease`
  in `@theme`
- `src/lib/systemTheme.ts` — added `flushSync()` call
- `src/routes/theme-lockstep.e2e.ts` — new regression test (2 assertions)
- `docs/themes.md` — documented both traps in the "Synchronized transitions"
  section

## Related

- **[Themes → Synchronized transitions](../../themes.md#synchronized-transitions)** — full explanation of the theme flip architecture, all prior fixes, and the trap that reintroduced this bug
- **[Themes → Two more supporting fixes](../../themes.md#two-more-supporting-fixes)** — JSON export recolor and `::placeholder` currentColor (also guarded against async surprises)
