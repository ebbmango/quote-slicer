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

const reducedMotion = () =>
	typeof window !== 'undefined' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type RedistributeOpts = {
	/** Largest gap-opening, in px, for a roomy/long row. */
	max: number;
	/** Opening contributed per borrow-able neighbour gap; also the m===2 fallback. */
	perGap: number;
};

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

	const toks = Array.from(container.querySelectorAll<HTMLElement>('.tok'));
	if (!toks.length) return;

	// Batch all layout reads first (no interleaved writes → one reflow at most).
	const data = toks.map((el) => ({
		el,
		idx: Number(el.dataset.tokenIndex),
		top: el.offsetTop
	}));

	// The divisor's row is the row of its left-flank token: highest-index tok at
	// or before the divisor.
	let anchor: (typeof data)[number] | null = null;
	for (const d of data) if (d.idx <= divisorIndex && (!anchor || d.idx > anchor.idx)) anchor = d;
	if (!anchor) return;

	const rowTop = anchor.top;
	const row = data.filter((d) => Math.abs(d.top - rowTop) < 4).sort((a, b) => a.idx - b.idx);
	const m = row.length;
	if (m < 2) return;

	// Local split position p: index in the row of the last tok at/before the divisor.
	// Everything ≤ p is the left group; the gap to open is between p and p+1.
	let p = 0;
	for (let k = 0; k < m; k++) if (row[k].idx <= divisorIndex) p = k;
	if (p >= m - 1) return; // divisor's right side wrapped to the next row — nothing to open here

	const delta = m === 2 ? perGap : Math.min(max, perGap * (m - 2));
	const other = m > 2 ? -delta / (m - 2) : 0; // each non-hovered gap shrinks by this

	// offset(j) = Σ of gap-deltas strictly left of token j.
	// Ends land on 0 (Σ all deltas = delta + (m-2)·other = 0), so the row's
	// outer edges never move — only the interior redistributes.
	const off = row.map((_, j) =>
		m === 2 ? (j === 0 ? -delta / 2 : delta / 2) : j * other + (p < j ? delta - other : 0)
	);
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
	for (const dv of container.querySelectorAll<HTMLElement>('.split-zone, .ws-split')) {
		const d = Number(dv.dataset.divisorIndex);
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
		container.querySelectorAll<HTMLElement>('.tok, .split-zone, .ws-split')
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
