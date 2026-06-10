import { describe, it, expect } from 'vitest';
import { pickVisualNeighbor, type Rect } from './visualNeighbor';

function rect(overrides: Partial<Rect> = {}): Rect {
	return { top: 0, bottom: 20, left: 0, width: 20, ...overrides };
}

describe('pickVisualNeighbor', () => {
	it('returns -1 when no candidate is below', () => {
		const current = rect({ top: 0, bottom: 20, left: 0 });
		const all = [current, rect({ top: 0, bottom: 20, left: 30 })];
		expect(pickVisualNeighbor(current, all, 'down')).toBe(-1);
	});

	it('returns -1 when no candidate is above', () => {
		const current = rect({ top: 0, bottom: 20, left: 0 });
		const all = [current, rect({ top: 0, bottom: 20, left: 30 })];
		expect(pickVisualNeighbor(current, all, 'up')).toBe(-1);
	});

	it('picks the closest horizontal match on the next row down', () => {
		const current = rect({ top: 0, bottom: 20, left: 50, width: 20 });
		const all = [
			current,
			rect({ top: 30, bottom: 50, left: 0, width: 20 }), // far left
			rect({ top: 30, bottom: 50, left: 45, width: 20 }), // closest
			rect({ top: 30, bottom: 50, left: 100, width: 20 }) // far right
		];
		expect(pickVisualNeighbor(current, all, 'down')).toBe(2);
	});

	it('picks the closest horizontal match on the row above', () => {
		const current = rect({ top: 30, bottom: 50, left: 50, width: 20 });
		const all = [
			current,
			rect({ top: 0, bottom: 20, left: 0, width: 20 }),
			rect({ top: 0, bottom: 20, left: 55, width: 20 }), // closest
			rect({ top: 0, bottom: 20, left: 100, width: 20 })
		];
		expect(pickVisualNeighbor(current, all, 'up')).toBe(2);
	});

	it('only considers the nearest row, not rows further away', () => {
		const current = rect({ top: 0, bottom: 20, left: 50, width: 20 });
		const all = [
			current,
			rect({ top: 30, bottom: 50, left: 0, width: 20 }), // nearest row, far horizontally
			rect({ top: 60, bottom: 80, left: 50, width: 20 }) // exact horizontal match, but farther row
		];
		expect(pickVisualNeighbor(current, all, 'down')).toBe(1);
	});

	it('treats rows within a 4px tolerance as the same row', () => {
		const current = rect({ top: 0, bottom: 20, left: 50, width: 20 });
		const all = [
			current,
			rect({ top: 23, bottom: 43, left: 0, width: 20 }), // 3px below the edge row, within tolerance
			rect({ top: 30, bottom: 50, left: 50, width: 20 }) // exact horizontal match, outside tolerance
		];
		expect(pickVisualNeighbor(current, all, 'down')).toBe(1);
	});
});
