# Project Foundation: Layout, Fonts, and Quote Input Prototype

> Commits: `d521ad9`, `e26b7b0`, `f2a84fb`, `0932483`, `6338972`, `785fcaa`, `2724c1e`
> Date: 2026-05-20 (types: 2026-06-01)

## Overview

This covers everything built before the first major feature landed: the SvelteKit project scaffold, the responsive three-column grid layout, the typography system, the initial textarea-based quote input, and the provisional data model for quotes and their tokens.

## Motivation

The app is a bilingual quote workbench — users enter Chinese source text, a translation, and authorship attribution. The immediate goal was a working input surface and a layout that would eventually accommodate side panels for tooling without reflowing the main content area.

## Architecture

The layout lives entirely in `src/routes/+page.svelte` as a CSS grid with three named areas: `left`, `content`, `right`. Breakpoints progressively reveal sidebars — portrait tablet gets one sidebar below, landscape gets one to the left, desktop gets both. All layout logic is CSS-only at this stage; no JS is involved in showing or hiding panels.

Typography is defined in `src/routes/layout.css`, which registers two font families:

- **Wenkai** — a Chinese handwriting-style font (light/regular/bold weights bundled as TTF), used for the source Chinese text
- **Source Serif 4** — used for the translation and attribution fields

Both are exposed as Tailwind theme tokens (`font-wenkai`, `font-ss4`) via `@theme`.

The quote input is three auto-growing textareas — source, translation, authorship — using a simple Svelte action (`autosize`) that adjusts `height` on each `input` event by reading `scrollHeight`.

## Data Model

`src/lib/types/quote.tsx` defines the intended data shape for when raw text gets tokenized and aligned:

- `SourceToken` — either a Han character (with optional transliteration in pinyin, Wade-Giles, Zhuyin, or Jyutping) or a punctuation/number/symbol token
- `TargetToken` — translation token with explicit `whitespace` type, because correct spacing around punctuation cannot be automated reliably
- `Alignment` — many-to-many mapping between source and target token IDs

This type file is provisional — no tokenization logic exists yet; the types are scaffolding for the shape of the eventual processing pipeline.

## Design Decisions

**`source` / `target` over `original` / `translation`**: The field names reflect the *direction of the interaction* (source → target), not the linguistic relationship. This keeps the naming consistent if the tool is later extended to non-translation use cases.

**Fonts bundled as TTFs**: The Wenkai font files are large (~13 MB each for light and regular). They are committed directly to the repo rather than loaded from a CDN, prioritizing offline reliability and rendering consistency over bundle size.

**`hocus` Tailwind variant**: `layout.css` registers a custom `hocus` variant (`&:is(:hover, :focus-visible)`) alongside `touch` and `mouse` media-query variants. This gives a single utility class for combined hover+focus states without duplicating declarations.

## Future Considerations

- The `autosize` action is defined inline in `+page.svelte`. Once `QuoteWorkbench` is its own component, this action should live closer to where it's used.
- The type definitions in `quote.tsx` assume a tokenized representation. The path from raw textarea text to `Quote` (tokenizer, alignment UI) is not yet designed.
