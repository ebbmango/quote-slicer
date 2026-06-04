# Tokenization Pipeline and Interactive Token Views

> Commits: `934af68`, `48143e8`, `5e2c182`, `fc034a8`
> Date: 2026-06-03

## Overview

When the user advances past the text input step, the source and target textareas are replaced by read-only interactive views that render the text as individual token spans. This is the first step toward the alignment UI: each span carries a `data-type` attribute and can later receive hover, selection, and mapping behaviour. The underlying tokenization logic lives in a standalone module with no Svelte dependencies, making it independently testable and reusable.

## Motivation

The end goal of the workbench is to let users draw connections between source tokens (Chinese characters) and target tokens (English words). That requires the text to exist as discrete, addressable DOM nodes rather than a monolithic string inside a textarea. The textarea is appropriate for input — ergonomic, accessible, handles IME — but once the user is done editing, a span-per-token representation is needed.

## Architecture

**`src/lib/tokenize.ts`** is a pure TypeScript module exporting two raw token types and three tokenizer functions. It has no imports from Svelte or the application. The "raw" types (`RawSourceToken`, `RawTargetToken`) are deliberately lighter than the domain types in `quote.tsx` — they carry only `text` and `type`, with no `id`, `line`, or `transliteration` fields. Those enrichments are downstream concerns.

**`InteractiveSourceText.svelte`** and **`InteractiveTargetText.svelte`** are thin presentational components that receive a token array as their only prop and render each token as a `<span data-type="...">`. They mirror the visual styling of their corresponding textareas (same font, size, max-height, and overflow behaviour).

`QuoteWorkbench.svelte` drives the switch: when `editing` is true (mode is `'text'`), textareas are shown; when false, the interactive components are shown. The token arrays are `$derived` from the current text values, so they stay current if the text ever changes.

## Implementation Details

**Source tokenization** is straightforward: `[...text]` spreads the string into Unicode code points (correctly handling surrogate pairs), and each character is classified by Unicode property tests — Han script → `'character'`, `\p{N}` → `'number'`, `[\p{P}\p{S}]` → `'punctuation'`, everything else → `'symbol'`.

**Target tokenization** has two variants:
- `tokenizeTargetSeparate` — every punctuation run is its own token. `"simple"` → `['"', 'simple', '"']`. Used in the current interactive view.
- `tokenizeTargetCombined` — flanking punctuation absorbs into adjacent word tokens. `"simple"` → `['"simple"']`. Available for use cases where punctuation should travel with its word.

Both variants handle Latin contractions (`don't`, `it's`) as single tokens via the pattern `[A-Za-z]+(?:'[A-Za-z]+)*`, preserve whitespace as explicit `'whitespace'` tokens (required for correct rendering and future copy behaviour), and treat em/en dashes and other non-letter runs as punctuation tokens.

**Flex layout for token display:** The interactive divs use `flex flex-wrap justify-center` rather than block layout with inline spans. The reason is the CSS inline "strut" — a block container with inline children implicitly creates a zero-width inline element at the baseline, which adds descender-space below the last line and causes `scrollHeight > clientHeight` by a few pixels even when all content fits visually. Flex items don't participate in inline formatting contexts and don't generate a strut.

**Whitespace tokens in flex:** In a flex container, a `<span>` containing only a space character gets its whitespace collapsed by `white-space: normal` (the default), rendering as zero-width. Whitespace tokens are given `whitespace-pre` (`white-space: pre`) to prevent this.

**Wenkai font glyph overflow:** `InteractiveSourceText` has an additional scroll-prevention problem. The Wenkai handwriting font at `text-3xl` has glyphs that physically extend 2px beyond the CSS `line-height: 2.25rem` box. This means a single line of Chinese text has `scrollHeight = 38px` while the container's `clientHeight = 36px` — triggering `overflow-y: auto` even on a one-liner. Separating the flex layout into an inner div and the scroll container into an outer div did not help, because the outer div (as a flex item in the `flex-col items-center` workbench) was still sized by the CSS line-height, not the actual glyph height.

The fix mirrors `autosize`: a `$effect` reads `container.scrollHeight` after each render and sets `container.style.height` to that value explicitly. Combined with `max-height: 40vh`, the behaviour is: height tracks content exactly up to 40vh, then scroll kicks in. A `window.addEventListener('resize', fit)` inside the same effect (with cleanup returned) ensures the height recalculates when text reflows at a new viewport width.

## Design Decisions

**`tokenizeTargetSeparate` as the default:** The interactive view currently uses the separate-punctuation variant. This maximises the number of individually addressable tokens, which is preferable for alignment mapping where a closing quote or period might need to map independently.

**`data-type` on every span:** Each span carries `data-type={token.type}`. This is unused in the current rendering pass but is a deliberate hook for CSS and JavaScript interaction in the alignment UI — type-based highlighting, click handlers, and accessibility labels can all key off this attribute without needing to re-run the tokenizer.

**`$derived` tokens, not stored on button click:** Token arrays are derived reactively from the text state rather than computed once at mode-advance time and stored. This keeps the component stateless with respect to tokens and means the interactive view would stay correct if the text could ever change in non-text mode (currently it can't, since the textareas are replaced, but the architecture doesn't rely on that constraint).

## Areas to Be Careful

The `$effect` in `InteractiveSourceText` sets an inline `style.height` that overrides the Tailwind class. If `max-h-[40vh]` is removed or changed, the scroll behaviour breaks silently — the `max-height` CSS property is what prevents the `$effect` from setting an arbitrarily large height when content is very long.

The `InteractiveTargetText` does not use the same `$effect` height fix. It happens not to need it because `font-ss4` (Source Serif 4) at `text-base` does not have the same glyph-overflow issue as Wenkai at `text-3xl`. If the font or size changes, the same spurious scroll could appear there too.

## Future Considerations

- The `data-type` spans have no interactivity yet. The alignment UI will need click/hover handlers, selection state, and visual feedback (highlight, line drawing between source and target tokens).
- `tokenizeTargetCombined` is implemented and tested but not currently used anywhere. It exists as the natural choice for rendering modes where punctuation should visually cluster with its word.
- The tokenizers produce no `id` or `line` fields — those need to be added (or the raw tokens need to be mapped to the full `SourceToken`/`TargetToken` domain types) before alignment data can be persisted.
