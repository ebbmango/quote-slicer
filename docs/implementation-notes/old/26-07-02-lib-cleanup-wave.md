# Lib cleanup wave: reorg for discoverability, dedupe, named constants

> Commits: `d6884e9`, `3a43d10`, `25cde28`, `8d4e99c`
> Date: 2026-07-02

## Overview

A no-behavior-change housekeeping wave with one theme: make file location match
responsibility, and make one copy of each thing. Four strands — the
`rowSpread`/`redistribute` merge, CSS and input-filter dedupe, the `lib/`
directory reorg, and two small extractions.

## rowSpread folded into redistribute

The line-tool hover-spread had been split into a DOM-free pure core
(`rowSpread.ts`, `computeRowOffsets`) and a DOM shell (`redistribute.ts`) —
originally so the math was unit-testable. The split turned out to be
ceremony: the pure function is unit-testable regardless of which file it lives
in. `rowSpread.ts` was deleted and its spec renamed to `redistribute.spec.ts`
(`d6884e9`); `computeRowOffsets` now lives at the top of
`src/lib/actions/redistribute.ts` — pure math and DOM I/O in one module, the
math still exported and tested. (The inline landed alongside the theme
reconcile commit `628fc63`, which also extended `redistribute.ts` for
theme-flip behavior — see the theme notes for that story.)

## Dedupe: fade-y mask and source-input filter (`3a43d10`)

- The `.fade-y` soft scroll fade existed as a byte-identical scoped rule in
  both `InteractiveSourceText.svelte` and `InteractiveTargetText.svelte`, plus
  a 0.5rem variant in `QuoteWorkbench.svelte`. It is now one global rule in
  `routes/layout.css`, parameterized by `--fade-pad` (default `0.75rem`; the
  workbench overrides to `0.5rem`). This continues the existing pattern of
  panel-shared token styles living in `layout.css`.
- The source textarea's character filter had an identical ~10-line body in
  both `oninput` and `oncompositionend`. Extracted as `filterSourceInput()` in
  `QuoteWorkbench.svelte` — both paths are still required, because IME input
  only settles on `compositionend`. The caret-preservation math (shift the
  selection left by the number of stripped characters) lives once now.

## Directory reorg (`25cde28`)

Three moves, each correcting a location that lied about responsibility:

- `tokenStore.svelte.ts` moved from `lib/animation/` to `lib/context/` — it is
  a context provider and the single token owner, not an animation helper. (It
  *contains* the line-edit animation, which is how it ended up misfiled.)
- The theme trio (`theme.ts`, `systemTheme.ts`, `themeState.ts`) grouped under
  `lib/theme/`, with `theme.ts` becoming `theme/index.ts` so every consumer's
  `$lib/theme` import path survives unchanged.
- Specs colocated beside their sources (`tokenize.spec.ts`,
  `pinyinConvert.spec.ts`), retiring the template-era `vitest-examples/`
  folder.

The living docs (file-map, token-store, ui-architecture, tokenization,
build-and-deploy, dark-theme, CONTEXT.md) were updated in the same commit, so
doc paths and code paths never diverged.

## Small extractions (`8d4e99c`)

- The `autosize` textarea action was defined inline in `+page.svelte` and
  threaded through `QuoteWorkbench` as a prop. It is now
  `lib/actions/autosize.ts`, a sibling of `longpress`/`swipeToDelete`,
  imported directly — one less prop crossing a component boundary.
- `buildTargetText`'s magic `5` became `MAX_BRIDGE_GAP` in `tokenState.ts`,
  with a comment defining it: selected target tokens at most this far apart
  (with only whitespace/punctuation between) join into one run instead of
  being comma-separated in the mapping's display text.
