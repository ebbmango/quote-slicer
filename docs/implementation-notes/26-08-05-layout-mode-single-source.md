# Layout mode as a shared runtime contract

> Date: 2026-08-05
>
> Commit: `5390525` (`refactor(layout): share layout mode with CSS`)

## Context

Responsive ownership was one-hot only inside JavaScript. `BreakpointContext.layoutMode`
selected which Svelte surfaces existed, while media queries in `+page.svelte` separately
selected the grid geometry. `layout.css` repeated parts of the same classification for
mapping columns. Keeping those paths aligned was a manual invariant, and an error could
send toolbar actions to content that CSS had hidden.

## What changed

The page now publishes `BreakpointContext.layoutMode` as `data-layout-mode` on the root
`.layout`. Mode selectors in `+page.svelte` consume that attribute for closed and open
grid tracks, sidebar display, and bottom-vs-side transforms. The `900px`, `1000px`, and
`1200px` macro thresholds now appear only in `breakpoints.svelte.ts`.

The mapping-list variants follow the same contract:

- `bottom-layout:` replaces the former viewport-classifying `tablet:` variant;
- `modal-wide:` requires the published `drawer` mode and retains only its independent
  `min-width: 600px` content threshold.

The prerendered value remains `single` until mount. No prepaint classifier was added:
Text is the initial tool, and all closed layouts visibly reduce to the full workbench.
Persisting a non-Text startup tool would invalidate that assumption and requires a
first-paint design review before such a feature ships.

## Why it matters

Surface ownership and rendered geometry can no longer disagree at an exact or
fractional viewport boundary: both are downstream of the same categorical value. The
root attribute is only a CSS-facing projection, not another mutable store, so a Svelte
update changes conditional content and mode geometry in the same render flush.

This keeps geometry declarative in CSS without retaining a second macro classifier.
The tradeoff is the deliberate prerendered `single` fallback described above; it stays
safe only while Text remains the startup tool.

## Regression coverage

Playwright now verifies:

- all four values at the exact `900px`, `1000px`, and `1200px` boundaries;
- CSS geometry and mapping columns changing when the published attribute changes;
- `drawer → bottom → single → double` geometry during live viewport changes;
- modal/aside ownership at exact, fractional, and scaled-browser boundaries;
- the modal's independent one-to-two-column transition at `600px`;
- the full-size `single` fallback with JavaScript disabled.

## Maintenance invariants

- `BreakpointContext` is the only macro-layout classifier.
- CSS may map a mode to geometry, but must not infer a mode from viewport thresholds.
- Local responsive queries may adapt content only after the owning surface is known.
- Keep the root data attribute declaratively bound to `layoutMode`.
