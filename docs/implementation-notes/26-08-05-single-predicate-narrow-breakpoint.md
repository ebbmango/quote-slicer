# Single-predicate narrow breakpoint

> Date: 2026-08-05
>
> Commit: `ee64a72` (`fix(layout): unify narrow breakpoint`)

## Context

The responsive model was one-hot in JavaScript, but CSS still classified the viewport
independently. The old narrow and single queries used `max-width: 899px` and
`min-width: 900px`. Fractional CSS widths can fall between those endpoints, making
`BreakpointContext` select `single` while the grid keeps its drawer-shaped base.

That mismatch is structural, not cosmetic. JavaScript decides whether maps/JSON belongs
in the left aside or `DataModal`; CSS decides whether that aside is displayed. In the
gap, the toolbar routed clicks to a mounted but hidden aside and did not open the modal.

Validation exposed a second boundary risk: scaled browsers can round equivalent-looking
opposite endpoint queries differently. Merely replacing the old pair with separately
written `< 900px` and `>= 900px` queries would still leave two classifications to keep
equivalent.

## What changed

`BreakpointContext` now defines narrow once as `(width < 900px)`. Its existing
`layoutMode` reduction still checks wide first, selects `single` when narrow is false,
and combines narrow with the independent tall fact to select `bottom` or `drawer`.

The CSS grid in `+page.svelte` no longer states the opposite 900px endpoint:

- `single` is the unqueried base layout;
- the exact narrow predicate overrides that base with `drawer` geometry;
- tall plus the same narrow predicate overrides drawer with `bottom` geometry;
- the later 1200px rule still overrides the base with `double` geometry.

The `tablet:` and `modal-wide:` variants in `layout.css` use the same strict narrow
predicate, keeping `MappingsList` column behavior aligned with content ownership.

`data-modal.e2e.ts` now launches isolated scaled Chromium windows because Playwright's
normal viewport option only produces integer CSS widths. The regression coverage:

- proves the legacy queries are both false at an effective width between 899px and
  900px, then verifies drawer controls, hidden-aside geometry, modal opening, and the
  two-column modal grid;
- checks that rendered geometry follows the canonical narrow query at Chromium's
  rounded 900px boundary, regardless of which side that browser version selects;
- exercises exact 900px single routing and the bottom-layout two-column aside.

## Why it matters

JavaScript remains structurally one-hot, and CSS now derives the same boundary through
one queried override rather than a second endpoint. There is no fractional gap or
overlap in application ownership: the same predicate governs both the DOM routing and
the CSS branch that makes its destination usable.

Keep these invariants together:

- Do not add a separate non-narrow endpoint to `+page.svelte`; `single` must remain the
  base that the canonical narrow query overrides.
- Move `NARROW_QUERY`, both page media blocks, and the `tablet:` / `modal-wide:` variants
  together if the 900px threshold changes.
- Preserve the scaled-window E2E setup; `viewport` plus `deviceScaleFactor` does not
  reproduce fractional layout widths.
- Tall plus narrow implies portrait only while the height threshold remains at least
  1000px and the width threshold remains below 900px.
