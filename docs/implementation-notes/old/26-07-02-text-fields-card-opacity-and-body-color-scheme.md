# Text-field chase, card-opacity snap, and body-level color-scheme (2026-07-02)

Follow-up to the theme-lockstep session (easing + flushSync). Three independent
desyncs remained after that fix; all were confirmed and re-verified with per-frame
`getComputedStyle` sampling **and painted-pixel screenshot decoding** in Playwright
(Chromium / WebKit / Firefox), because one of the three is invisible to computed
style in Chromium.

## 1. Text mode: target textarea chases the flip (Safari always, Chrome paint-only)

**Symptom.** Safari: the Latin (target) text and placeholder lag the theme flip
badly, filled or empty. Chrome: the target _placeholder_ lags; with real text the
fields desync too.

**Root cause.** `.morph-target` (and `.morph-target::placeholder`) carried a
permanent `transition: color 400ms ease-out` for the arrow-launch morph. Their
colour is _inherited_, so on a theme flip they ease toward `<body>`'s
already-easing value — the compounding chase documented in dark-mode.md. Measured:
target settles ~890–900 ms while everything else settles ~460 ms.

**The trap inside the trap.** Chromium _reports lockstep_ in `getComputedStyle`
for the filled text but **paints the chase anyway** — painted pixels sat at ~52 %
when the page hit 100 %. WebKit shows the chase in computed style. Never trust
computed style alone for form-control colour timing; decode screenshots.

**Placeholder variant.** Both engines' UA default for `::placeholder` is already
`color-mix(in oklab, currentColor 50%, transparent)` (Firefox too — verified).
An author declaration of that _identical value_ is what arms the chase when a
`transition: color` is present; colour-transition-free placeholders ride
inheritance in lockstep. That asymmetry is why Chrome lagged only the target
placeholder (explicit author colour) and not source/authorship (UA colour, even
though they also had a placeholder transition).

**Placeholder trap #2 (found post-fix, by the user, on a dark-OS machine).** The
first fix left resting placeholders on the UA default. Under a dark OS scheme —
where the app.html prepaint stamps `color-scheme: dark` on `<html>` — Chromium
does **not recompute** `::placeholder` colours built from colour _functions_ of
`currentColor` (`color-mix()`, relative-colour syntax) when the inherited colour
changes. After every toggle the placeholder kept the previous theme's ink:
invisible dark-on-dark / faint white-on-white ("the text perfectly camouflages
and never comes back"). The UA default is exactly such a `color-mix`, and it
never reproduces under a light OS scheme — which is why every light-OS probe was
clean. Measured variant sweep (real Chrome, `channel: 'chrome'`, emulated dark
OS): UA default ✗, author `color-mix(currentColor…)` ✗, relative-colour ✗, plain
`currentColor` ✓, `color-mix(var(--page-fg)…)` ✓, `var(--page-fg)` ✓. The old
code never hit this because its permanent `transition: color` forced continuous
recomputation — removing the chase unmasked the staleness.

**Fix.** All morph transitions and colours moved under `.morph-*.exiting` — the
destination state of the one-way arrow launch (`advanceToLinkMode` seeds every
field and swaps mode; `.exiting` never comes off while text mode is visible).
Resting placeholders declare plain `color: currentColor` with the 50 % dimming on
the pseudo-element's `opacity` (identical visual math to the UA default; dodges
the dark-OS staleness; theme-invariant, so no transition needed on a flip). The
morph brightens the placeholder by transitioning pseudo `opacity` 0.5 → 1 under
`.exiting` instead of animating its colour. The `html.theme-anim .morph-target`
500 ms widening rule is deleted — nothing left to widen. Transitions read from
the destination state, so adding `.exiting` still animates the 400 ms morph.

This also removed the Chrome "target text flickers white after a dark→light flip
settles" artifact: that was the deferred root `color-scheme` write (see §3)
landing at ~570 ms and forcing a form-control style re-resolve while the target
was still mid-chase. With no chase and no late root write, both triggers are gone.

## 2. Mapping card bottom text: opacity snaps (all engines)

**Symptom.** The card's bottom (translation) text visibly "flickers" on a theme
flip in Chrome, Firefox, and Safari — it changes ahead of everything else.

**Root cause.** `botTextOpacity` / `botTextEmptyOpacity` in `Mapping.svelte`
derive from `isDark` (inactive-dark = 0.5 / 0.3), and the flip's `flushSync`
lands the new inline `opacity` in the same frame as the class flip — but the
span only had `transition-colors`, so the opacity change **snapped in one frame**
while every colour eased 500 ms. Confirmed: opacity was already at its final
value at the first post-click frame.

**Fix.** `transition-[color,opacity] duration-500` on both bottom-bar spans.
Rule of thumb recorded in dark-mode.md: any inline style derived from
`theme.current` must either be transitioned or be theme-invariant.

## 3. Chrome "one switch speed glitches everything": root color-scheme poison window

**Symptom.** Chrome only, intermittent: toggling again "right as the toggle
button settles" made every piece of text lag the backgrounds; card text crawled
on its own slow curve; the JSON panel froze mid-shade and snapped at the end.
Fast double-clicks and long waits were both fine.

**Root cause.** The previous fix deferred the root `color-scheme` write to
560 ms after a flip (debounced). Isolated on a minimal fixture: Chromium runs
_every_ `color` transition at ~half speed if the **root** `color-scheme` changed
in the same frame, mid-flight, **or within ~500 ms before the transition
starts**. So the deferred write opened a poison window at 560–1060 ms after each
flip — and the toggle's 800 ms orbit animation trains the user to click inside
it. Measured in-app: second flip at gaps 558–800 ms → body text settled
~1000 ms, card bottom text ~1370 ms (the _second_ deferred write landed
mid-crawl and re-throttled it), Shiki spans snapped at ~520 ms (the `theme-anim`
transition rule was removed while the throttled transition was still ~40 %
behind). Gaps ≤540 ms were clean (debounce cancelled the write) and ≥1200 ms
were clean (outside the tail) — exactly the user's reproduction recipe.

**Dead ends measured.** Deferring further only moves the window. Registered
`@property` colour transitions are _always_ on the slow path (~950 ms even with
no color-scheme change) — not an escape hatch.

**Fix.** Live `color-scheme` goes inline on **`<body>`**, synchronously with the
class flip; the throttle is root-element-specific (body-level measured clean at
every offset: same-frame / −300 ms / +250 ms all ~440 ms). The
`scheduleColorScheme` timer machinery is deleted. `<html>` keeps the app.html
prepaint value and goes stale after live toggles — harmless: root scrollbar and
canvas are never visible (non-scrolling `h-dvh` grid, every surface paints its
own background). Form controls now re-theme in the same frame as the flip.

## Verification

- Per-frame computed sampling: all textarea channels settle with `body` (both
  directions, filled + placeholder, Chromium + WebKit).
- Painted-pixel decode: all four regions (page bg, source, target, authorship)
  within ±7 % progress of each other across the whole flip, both engines, both
  directions; no post-500 ms reversal (white-flicker trigger gone).
- Double-flip sweep at gaps 250/480/558/570/590/650/800/1200 ms: text settle ==
  background settle at every gap; `bot.op` eases and retargets smoothly.
- Firefox: UA placeholder identical to author value it replaced; rides lockstep.
- Guardrails: tsc 0, svelte-check 0/0, build ✓, vitest 111 ✓, playwright same 3
  pre-existing failures; `theme-lockstep.e2e.ts` extended with three structural
  invariants (no resting colour transition on fields; opacity in the bot-span
  transition; live color-scheme lands on `<body>` and never touches the root).

## Fragility / future rot

- The `.exiting` scoping relies on the arrow launch being **one-way**. If a
  "back to text mode" path ever un-sets `arrowExiting` while fields are visible,
  the reverse morph will snap (no resting transition) — reintroduce a scoped
  transition for that path only, never a resting one.
- The placeholder rules are a three-constraint knife-edge: no `light-dark()`
  (never re-resolves on `::placeholder`), no colour functions of `currentColor`
  (dark-OS Chromium staleness), no colour transition (inherited-change chase).
  Plain `currentColor` + pseudo `opacity` is the only measured-safe corner —
  don't "simplify" it into any of the three.
- Playwright's bundled Chromium does NOT reproduce the dark-OS placeholder
  staleness; the real Chrome binary (`launch({ channel: 'chrome' })` with
  `colorScheme: 'dark'` context emulation) does. Any future placeholder-colour
  work must be verified on `channel: 'chrome'`.
- `<html>`'s inline `color-scheme` is intentionally stale after live toggles.
  If the layout ever gains a root scrollbar (or drops `h-dvh`), root scrollbar
  colours will mismatch the theme — revisit §3 before "fixing" it by writing to
  the root again.
- The Chromium throttle numbers (~500 ms tail, ~2× slowdown) are engine
  internals observed on 2026-07 Chromium; the _rule_ (never write root
  color-scheme near a colour transition) is the stable part.
