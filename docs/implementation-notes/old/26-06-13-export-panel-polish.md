# Export & aside panel polish: edge fades, empty state, overflow sizing

> Commits: `fd43e3d`, `3773995`
> Date: 2026-06-13

## Overview

Two visual-correctness fixes to the side panels that hold the mappings list and
the JSON export: the JSON box now sizes to its content so horizontal padding is
honoured past long lines, and every scrollable panel now fades its content near
the container edges instead of hard-clipping it. The mappings list also gained a
"No mappings." empty state.

## Motivation

The JSON export (`HighlightedCode.svelte`) rendered into a `<pre>` that stayed at
the panel's width while `white-space: pre` let the text overflow horizontally.
The panel's right padding was applied to the box, not the content, so once a line
ran past the box edge the padding sat _behind_ the start of the line — long lines
butted right up against the scroll boundary with no breathing room.

Separately, the panels relied on native scrollbars as the only cue that content
continued past the visible area, and content terminated in a hard pixel edge at
the top/bottom of the scroll box, which read as clipped rather than scrollable.

## Implementation Details

**Content-width sizing.** `width: max-content` on `.highlighted-code` grows the
`<pre>` to the longest line. Now the panel's padding is measured relative to the
real content extent, so the right padding reappears past the longest line.

**Edge fades.** A `.fade-edges` wrapper applies a CSS mask gradient on all four
edges. The ramp (`--ramp-y`) is hand-tuned to approximate a _smoothstep_ curve:
the alpha stops are spaced so the opacity slope is ~0 at both the transparent
outer edge and the fully-opaque inner junction, which kills the visible kink a
plain linear gradient leaves at each end. The same ramp is reused for both axes
via two `linear-gradient`s composited with `mask-composite: intersect` (with the
`-webkit-mask-composite: source-in` fallback for WebKit). `--fade` (24px) is the
single knob for fade depth.

Because the fade now signals scrollability, native scrollbars were hidden
(`no-scrollbar`) on both the mappings list and the JSON export.

**Empty state.** `mappingsList()` branches on `sortedMappingViews.length === 0`
to render a centred, dimmed "No mappings." placeholder instead of an empty `<ol>`.

## Areas to Be Careful

The `.fade-edges` wrapper is applied at three separate call sites in
[`+page.svelte`](../../src/routes/+page.svelte) — the minimal-viewport aside, the
modal, and the right sidebar. All three wrap the shared `mappingsList()` /
`jsonExport()` snippets in an identical `<div class="fade-edges h-full w-full">`.
If you add a fourth surface for these panels, wrap it the same way or it will
clip while the others fade.
