export type Rect = { top: number; bottom: number; left: number; width: number };

/**
 * Picks the candidate whose row is closest in `dir` and whose horizontal
 * center is closest to `current`'s. Returns -1 if no candidate qualifies.
 */
export function pickVisualNeighbor(current: Rect, all: Rect[], dir: 'up' | 'down'): number {
	const cx = current.left + current.width / 2;

	const candidates = all
		.map((r, i) => ({ r, i }))
		.filter(({ r }) => (dir === 'down' ? r.top > current.bottom - 4 : r.bottom < current.top + 4));

	if (!candidates.length) return -1;

	const rowEdge =
		dir === 'down'
			? Math.min(...candidates.map(({ r }) => r.top))
			: Math.max(...candidates.map(({ r }) => r.bottom));

	const rowCandidates = candidates.filter(({ r }) =>
		dir === 'down' ? Math.abs(r.top - rowEdge) < 4 : Math.abs(r.bottom - rowEdge) < 4
	);

	return rowCandidates.reduce((best, cur) => {
		const bx = cur.r.left + cur.r.width / 2;
		const bestx = best.r.left + best.r.width / 2;
		return Math.abs(bx - cx) < Math.abs(bestx - cx) ? cur : best;
	}).i;
}
