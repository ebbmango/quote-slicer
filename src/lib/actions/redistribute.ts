// Line-mode divisor hover feedback: open the hovered gap by translating the
// row's tokens apart, while *closing* every other gap on that row by an equal
// share — so the row's visual width stays constant (anchored at both ends).
//
// Why constant-width: the previous feedback grew the divisor's `width` (a layout
// property), which reflowed everything to its right. Hovering divisors in quick
// succession made the whole line expand/contract — the eyesore this replaces.
//
// All movement is `transform: translateX` written to the `--rd-x` custom property
// on each `.tok`, transitioned by the `.tok` rule. Transforms never participate in
// layout, so this can never re-wrap the text, in any mode. The row is measured
// lazily on each hover-enter (a handful of `offsetTop` reads) — always fresh, so
// resize / font-load / edits need no invalidation. Cleared on leave/blur.

import {
	SPLIT_SURFACE_SELECTOR,
	TOK_SELECTOR,
	tokenIndexOf,
	divisorIndexOf
} from '$lib/navigation/gridDom';

export type RedistributeOpts = {
	/** Largest gap-opening, in px, for a roomy/long row. */
	max: number;
	/** Opening contributed per borrow-able neighbour gap; also the m===2 fallback. */
	perGap: number;
};

/**
 * Pure core of the hover-spread: given the token indices on a visual row and
 * the divisor to open, return the per-token translateX offsets that open that
 * one gap while closing the rest by an equal share. For rows of 3+ tokens the
 * two outer offsets are 0, so the row's edges never move; a 2-token row has
 * only the one gap to open, so it widens by `perGap` (the documented fallback).
 * DOM-free, so it's unit-testable.
 *
 * Offsets (px) parallel to `rowIndices`, or `null` when nothing should spread
 * (row shorter than 2, or the divisor's right side wrapped to the next row).
 *
 * `rowIndices` must be the row's token indices sorted ascending. `divisorIndex`
 * is the token index the divisor sits *after*.
 */
export function computeRowOffsets(
	rowIndices: number[],
	divisorIndex: number,
	{ max, perGap }: RedistributeOpts
): number[] | null {
	const m = rowIndices.length;
	if (m < 2) return null;

	// Local split position p: index in the row of the last tok at/before the
	// divisor. Everything ≤ p is the left group; the gap to open is p → p+1.
	let p = 0;
	for (let k = 0; k < m; k++) if (rowIndices[k] <= divisorIndex) p = k;
	if (p >= m - 1) return null; // divisor's right side wrapped — nothing to open here

	const delta = m === 2 ? perGap : Math.min(max, perGap * (m - 2));
	const other = m > 2 ? -delta / (m - 2) : 0; // each non-hovered gap shrinks by this

	// offset(j) = Σ of gap-deltas strictly left of token j. Ends land on 0
	// (Σ all deltas = delta + (m-2)·other = 0), so the outer edges never move.
	return rowIndices.map((_, j) =>
		m === 2 ? (j === 0 ? -delta / 2 : delta / 2) : j * other + (p < j ? delta - other : 0)
	);
}

const reducedMotion = () =>
	typeof window !== 'undefined' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Open the gap at `divisorIndex` (the global token index the divisor sits *after*)
 * on its visual row, keeping the row's outer width constant.
 */
export function redistributeRow(
	container: HTMLElement | undefined,
	divisorIndex: number,
	{ max, perGap }: RedistributeOpts
): void {
	if (!container || reducedMotion()) return;

	// Clear any redistribution left on a previously spread row before applying the new one.
	for (const el of container.querySelectorAll<HTMLElement>(`${TOK_SELECTOR}, ${SPLIT_SURFACE_SELECTOR}`))
		el.style.removeProperty('--rd-x');

	const toks = Array.from(container.querySelectorAll<HTMLElement>(TOK_SELECTOR));
	if (!toks.length) return;

	// Batch all layout reads first (no interleaved writes → one reflow at most).
	const data = toks.map((el) => ({
		el,
		idx: tokenIndexOf(el),
		top: el.offsetTop
	}));

	// The divisor's row is the row of its left-flank token: highest-index tok at
	// or before the divisor.
	let anchor: (typeof data)[number] | null = null;
	for (const d of data) if (d.idx <= divisorIndex && (!anchor || d.idx > anchor.idx)) anchor = d;
	if (!anchor) return;

	const rowTop = anchor.top;
	const row = data.filter((d) => Math.abs(d.top - rowTop) < 4).sort((a, b) => a.idx - b.idx);

	const off = computeRowOffsets(row.map((d) => d.idx), divisorIndex, { max, perGap });
	if (!off) return;
	const m = row.length;
	for (let j = 0; j < m; j++) row[j].el.style.setProperty('--rd-x', off[j].toFixed(2) + 'px');

	// Slide each divisor by the mean of its two flanking tokens so its indicator
	// stays centred in the (re-sized) gap instead of drifting toward one side.
	// A divisor's `data-divisor-index` is the token index it sits *after*: that's
	// the left token's own index for source split-zones, but the whitespace
	// token's index (strictly between the two words) for target ws-splits — so we
	// resolve its flanks by index comparison rather than an exact key match.
	const idxOff = new Map(row.map((r, j) => [r.idx, off[j]]));
	const minIdx = row[0].idx;
	const maxIdx = row[m - 1].idx;
	for (const dv of container.querySelectorAll<HTMLElement>(SPLIT_SURFACE_SELECTOR)) {
		const d = divisorIndexOf(dv);
		if (!(d >= minIdx && d < maxIdx)) continue; // not an interior gap of this row
		let lIdx = -Infinity;
		let rIdx = Infinity;
		for (const r of row) {
			if (r.idx <= d && r.idx > lIdx) lIdx = r.idx;
			if (r.idx > d && r.idx < rIdx) rIdx = r.idx;
		}
		const lo = idxOff.get(lIdx);
		const ro = idxOff.get(rIdx);
		if (lo === undefined || ro === undefined) continue;
		dv.style.setProperty('--rd-x', ((lo + ro) / 2).toFixed(2) + 'px');
	}
}

/**
 * Reset every token and divisor to its resting position.
 *
 * `instant` snaps with the `transform` transition suppressed for one reflow —
 * used before a split/merge so the divisor's live hover offset isn't baked into
 * the GSAP Flip from-state (and doesn't ease back while Flip is mid-flight,
 * which made the row wobble). The default eases back via the CSS transition,
 * which is what we want on plain mouseleave/blur.
 */
export function clearRedistribute(
	container: HTMLElement | undefined,
	{ instant = false }: { instant?: boolean } = {}
): void {
	if (!container) return;
	const els = Array.from(
		container.querySelectorAll<HTMLElement>(`${TOK_SELECTOR}, ${SPLIT_SURFACE_SELECTOR}`)
	);
	if (instant) {
		// The indicators consume `--rd-x` via inheritance (the value is written to
		// the zone; the indicator — a child span, or a `::after` pseudo in the target
		// panel — reads it). The pseudo can't be selected from JS, so suppress every
		// indicator's transition with a container class the panels' CSS gates on.
		container.classList.add('rd-instant');
		for (const el of els) el.style.transition = 'none';
		for (const el of els) el.style.removeProperty('--rd-x');
		void container.offsetWidth; // flush the removal under transition:none
		for (const el of els) el.style.removeProperty('transition');
		container.classList.remove('rd-instant');
		return;
	}
	for (const el of els) el.style.removeProperty('--rd-x');
}
