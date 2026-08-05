# Responsive viewport model and nested-worktree test isolation

> Date: 2026-08-04
>
> Commits: `fad9d79` (`chore: exclude nested worktrees`), `61c151b`
> (`refactor(layout): clarify viewport model`)

## Context

`BreakpointContext` already reduced viewport state to one `LayoutMode`, but two parts
of that model obscured the real layout rules:

- `dual`, `stacked`, and `mini` described implementation history more than the
  resulting page geometry.
- `TALL_NARROW_PORTRAIT_QUERY` repeated the narrow-width threshold and an orientation
  condition that the height/width limits already guaranteed.

The breakpoint calculation is load-bearing beyond CSS. It decides whether maps/JSON
content belongs to an aside or `DataModal`, whether the second sidebar exists, and how
`ToolToolbar` routes its data buttons. The JavaScript classification and both CSS media
queries therefore have to move together.

Validation also exposed a separate tooling problem: Playwright and Prettier traversed
local checkouts under `.claude/worktrees/`. Playwright then ran stale tests from a
nested checkout against the current checkout's preview server, producing failures that
did not belong to either source tree.

## What changed

The viewport modes now use spatial names:

| Previous  | Current  | Geometry                          |
| --------- | -------- | --------------------------------- |
| `dual`    | `double` | main with both sidebars           |
| `single`  | `single` | main with one side sidebar        |
| `stacked` | `bottom` | main with one sidebar below       |
| `mini`    | `drawer` | main only; data opens in a drawer |

`BreakpointContext` now owns three independent `MediaQuery` facts:

- wide: `min-width: 1200px`
- narrow: `max-width: 899px`
- tall: `min-height: 1000px`

After the wide and non-narrow branches return, the remaining narrow branch selects
`bottom` when tall and `drawer` otherwise. The corresponding media blocks in
`+page.svelte` and the `tablet:` variant in `layout.css` now compose the same height
and width limits without an explicit orientation condition.

`data-modal.e2e.ts` adds a fixed-width `820x999 -> 820x1000 -> 820x999` transition. It
checks toolbar routing, CSS sidebar activation, modal force-close, and the reverse
transition, so a future JavaScript/CSS mismatch fails at the ownership boundary.

Tooling now treats nested agent worktrees as separate checkouts:

- `.gitignore` and `.prettierignore` exclude `.claude/worktrees/`.
- Playwright sets `testDir: 'src'`, matching the existing `src/routes/*.e2e.ts`
  convention and preventing nested tests from targeting this checkout's server.

## Why it matters

The change is intentionally behavior-preserving. It makes width and height composable
facts, removes a second JavaScript owner for the 899px threshold, and gives callers
mode names that describe the rendered result.

Two invariants remain important:

- Tall plus narrow implies portrait only because `1000px > 899px`. Revisit the removed
  orientation condition if either threshold changes enough to invalidate that proof.
- The current `max-width: 899px` / `min-width: 900px` convention has a fractional-width
  gap. Any fix must move the JavaScript query and every CSS mirror to complementary
  range queries together.

The SSR/hydration contract did not change: `layoutMode` remains `single` until mount,
then Svelte's reactive media queries classify the real viewport.

## Follow-ups

- Update `docs/ui-architecture.md` and `docs/file-map.md`, which still describe the
  removed `wide` / `belowMedium` / `tabletPortrait` / `minimal` / `dataSurface` API.
- Document Playwright's `testDir: 'src'` constraint in `docs/testing.md`; future E2E
  specs placed outside `src` will not be collected.
- Resolve the fractional 899-900px gap only as a synchronized JavaScript/CSS change.
