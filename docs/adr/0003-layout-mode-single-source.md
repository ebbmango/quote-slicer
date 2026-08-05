# Layout mode is the single macro-layout source

The responsive choice is structural. JavaScript decides whether mappings and JSON are
rendered in asides or a modal, while CSS decides which grid tracks and sidebars exist.
When each side independently classified the viewport, every threshold and combination
had to be manually mirrored; disagreement could route interaction into a hidden surface.

## Decision

`BreakpointContext` is the sole macro-layout classifier. Its three reactive viewport
facts reduce to exactly one `LayoutMode`: `drawer`, `bottom`, `single`, or `double`.
The root page publishes that value as `data-layout-mode` on `.layout`.

All macro consumers follow the published value:

- Svelte branches use `breakpoints.layoutMode` for content ownership and toolbar routing;
- the page grid uses `[data-layout-mode='…']` selectors for tracks and sidebar display;
- the mapping list's `bottom-layout:` variant selects the published `bottom` mode.

No macro viewport threshold remains in CSS. `modal-wide:` combines the published
`drawer` mode with `min-width: 600px`, but that query answers a local question—whether
the modal has room for two cards—and cannot select an app layout.

The dependency is deliberately one-way:

```
viewport facts → BreakpointContext.layoutMode → Svelte rendering
                                             → data-layout-mode → CSS geometry
```

During SSR and hydration the context publishes `single` until mount. That fallback is
safe without a prepaint script because Text is the initial tool and every mode's closed
geometry shows only the full-size workbench. Hydration then updates the attribute and
all consumers from the same reactive value.

## Consequences

- Change `900px`, `1000px`, or `1200px` only in `breakpoints.svelte.ts`; CSS must not
  restate them.
- Adding or renaming a mode requires updating the union/reducer and every explicit
  consumer selector. TypeScript covers JavaScript consumers; boundary and live-resize
  E2E tests cover the DOM-to-CSS contract.
- Component-local media or container queries remain valid when they adapt content
  inside a surface and do not decide which macro surface exists.
- The root attribute is an output contract, not a second state store. Production code
  must update `layoutMode`, never imperatively mutate the attribute.
- Persisting or deep-linking a non-Text startup tool would invalidate the visually
  equivalent `single` fallback and requires revisiting prepaint before it ships.

## Alternatives considered

- **CSS owns the mode and JavaScript reads a sentinel or computed style.** This makes
  rendering depend on a post-layout DOM read, complicates SSR/hydration, and adds an
  observer loop before Svelte can choose a surface.
- **A prepaint script stamps the mode.** This duplicates the classifier in inline
  JavaScript and is unnecessary because the initial closed geometry is mode-equivalent.
- **JavaScript writes all grid styles inline.** This centralizes classification but
  moves declarative geometry, transitions, and responsive component styling out of CSS.
- **Generate JavaScript and CSS predicates from build-time tokens.** This removes hand
  editing but still creates two runtime classifiers and adds generation machinery for
  three stable thresholds.
- **Container queries own layout.** They are useful for local component adaptation, but
  Svelte still needs the app-level structural decision; reading it back would recreate
  the CSS-to-JavaScript synchronization problem.
