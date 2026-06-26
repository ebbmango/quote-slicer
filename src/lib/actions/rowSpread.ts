// Pure core of the line-mode hover-spread: given the token indices on a visual
// row and the divisor to open, return the per-token translateX offsets that open
// that one gap while closing the rest by an equal share. For rows of 3+ tokens
// the two outer offsets are 0, so the row's edges never move; a 2-token row has
// only the one gap to open, so it widens by `perGap` (the documented fallback).
// DOM-free, so it's unit-testable; the live reads/writes live in redistribute.ts.

export type RedistributeOpts = {
	/** Largest gap-opening, in px, for a roomy/long row. */
	max: number;
	/** Opening contributed per borrow-able neighbour gap; also the m===2 fallback. */
	perGap: number;
};

/**
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
