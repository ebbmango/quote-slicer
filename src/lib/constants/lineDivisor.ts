// Single source of truth for the line-tool divisor selectors that row-level
// concerns query from OUTSIDE the divisor. The class names themselves are
// rendered (and styled) by LineDivisor.svelte; these constants exist so the
// external readers — the keyboard navigator (tokenGridNav, via QuoteWorkbench)
// and the hover-spread (redistribute.ts) — don't each hand-copy the selector
// string and drift from each other. Renaming a class still touches LineDivisor's
// markup + CSS, but only this one place on the reader side.

/** All focusable line-tool controls (split + merge + ws). Keyboard nav selector. */
export const LINE_ITEM_SELECTOR = '.split-zone, .merge-zone, .ws-split';

/** Split surfaces only — the source zero-width zone and the target whitespace
 *  span. Merge bands spread nothing, so redistribute targets just these. */
export const SPLIT_SURFACE_SELECTOR = '.split-zone, .ws-split';
