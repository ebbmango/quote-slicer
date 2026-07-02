import { describe, it, expect } from 'vitest';
import { computeRowOffsets } from './redistribute';

const opts = { max: 24, perGap: 8 };

// Local split position p: index in the row of the last token at/before `d`.
const splitPos = (row: number[], d: number) => row.reduce((p, idx, k) => (idx <= d ? k : p), 0);

describe('computeRowOffsets', () => {
	it('returns null when the row is shorter than 2', () => {
		expect(computeRowOffsets([], 0, opts)).toBeNull();
		expect(computeRowOffsets([5], 5, opts)).toBeNull();
	});

	it('returns null when the divisor sits at/after the last token (right side wrapped)', () => {
		expect(computeRowOffsets([0, 1, 2], 2, opts)).toBeNull();
		expect(computeRowOffsets([0, 1, 2], 9, opts)).toBeNull();
	});

	it('m>2: anchors both outer edges at 0 so the row width stays constant', () => {
		for (const row of [[0, 1, 2], [3, 4, 5, 6, 7]]) {
			for (let d = row[0]; d < row[row.length - 1]; d++) {
				const off = computeRowOffsets(row, d, opts);
				if (!off) continue;
				expect(off[0]).toBe(0);
				expect(off[off.length - 1]).toBe(0);
			}
		}
	});

	it('opens the hovered gap by a positive amount on every spreadable divisor', () => {
		for (const row of [[0, 1], [0, 1, 2], [3, 4, 5, 6, 7]]) {
			for (let d = row[0]; d < row[row.length - 1]; d++) {
				const off = computeRowOffsets(row, d, opts);
				if (!off) continue;
				const p = splitPos(row, d);
				expect(off[p + 1] - off[p]).toBeGreaterThan(0);
			}
		}
	});

	it('m===2: splits the single gap symmetrically (the only-gap fallback)', () => {
		expect(computeRowOffsets([0, 1], 0, opts)).toEqual([-4, 4]);
	});
});
