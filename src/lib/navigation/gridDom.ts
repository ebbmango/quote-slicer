// The token-grid DOM contract: the single source of truth for every selector and
// attribute name that couples the rendered token grid to the modules that READ it
// (the keyboard navigator, the hover-spread `redistribute`, the line-edit
// animation in the token store, and the global shortcuts).
//
// Components WRITE these attributes in their own markup. The writers are:
//   data-zone           QuoteWorkbench panel wrappers
//   data-token-index    InteractiveSourceText / InteractiveTargetText tokens
//   role="option"       ditto (link/view tool)
//   .tok                ditto
//   data-flip-id        the panels, their wrappers, and LineDivisor
//   data-divisor-index  LineDivisor
//   .split-zone / .merge-zone / .ws-split   LineDivisor
//   data-scrollbox      the panels' scroll boxes
//
// Readers go through this module, so renaming an attribute touches the writer's
// markup plus this file and nothing else. Absorbs the former constants/lineDivisor.ts.
//
// ponytail: selector strings, builders, and the dataset accessors that mirror the
// indexed attributes — but no query wrappers; single-use lookups like
// querySelector(SCROLLBOX_SELECTOR) read fine inline. Add a query helper only if a
// querySelector pattern starts repeating across readers.

export type Zone = 'source' | 'target';

/** Focusable token in link/view tool (keyboard-nav item selector). */
export const TOKEN_ITEM_SELECTOR = '[role="option"]';
/** All focusable line-tool controls (split + merge + ws). Keyboard-nav item selector. */
export const LINE_ITEM_SELECTOR = '.split-zone, .merge-zone, .ws-split';
/** Split surfaces only — the source zero-width zone and the target whitespace span. */
export const SPLIT_SURFACE_SELECTOR = '.split-zone, .ws-split';
/** A rendered token (the unit the hover-spread translates). */
export const TOK_SELECTOR = '.tok';
/** Either token panel, matched by zone presence (zone value irrelevant). */
export const PANEL_SELECTOR = '[data-zone]';
/** A panel's scroll box (overflow-y-auto), height-tweened during a line edit. */
export const SCROLLBOX_SELECTOR = '[data-scrollbox]';
/** A token carrying a Flip id, reflowed during a line edit. */
export const FLIP_TOKEN_SELECTOR = '[data-flip-id]';

export const zoneSelector = (zone: Zone) => `[data-zone="${zone}"]`;
export const tokenSelector = (index: number) => `[data-token-index="${index}"]`;
export const divisorSelector = (index: number | string) => `[data-divisor-index="${index}"]`;

/** The zone a node sits in, or null if it's outside both panels. */
export function getZone(el: HTMLElement): Zone | null {
	if (el.closest(zoneSelector('source'))) return 'source';
	if (el.closest(zoneSelector('target'))) return 'target';
	return null;
}

// The camelCase `dataset.*` mirror of the indexed attributes — paired here with
// the selector builders above so a rename touches one place, not both spellings.
/** A token's stable grid index (NaN if the node isn't a token). */
export const tokenIndexOf = (el: HTMLElement) => Number(el.dataset.tokenIndex);
/** The index a divisor sits after (NaN if the node isn't a divisor). */
export const divisorIndexOf = (el: HTMLElement) => Number(el.dataset.divisorIndex);
