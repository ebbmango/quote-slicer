import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewHighlight } from './viewHighlight.svelte';

// Timing constants mirrored from viewHighlight.svelte.ts — the delays are the
// behaviour under test, so the specs assert the exact values.
const COLD = 500;
const WARM = 300;
const GRACE = 500;

// Resolver over a fixed token-index → mapping-id table per zone.
function makeHighlight(
	map: { source?: Record<number, string>; target?: Record<number, string> } = {}
) {
	return new ViewHighlight((zone, i) => map[zone]?.[i] ?? null);
}

beforeEach(() => {
	vi.useFakeTimers();
});
afterEach(() => {
	vi.useRealTimers();
});

describe('hover', () => {
	it('lights up after the cold delay on first hover', () => {
		const hl = makeHighlight({ source: { 0: 'm1' } });
		hl.hoverSource(0);
		expect(hl.hoveredMappingId).toBeNull();
		vi.advanceTimersByTime(COLD - 1);
		expect(hl.hoveredMappingId).toBeNull();
		vi.advanceTimersByTime(1);
		expect(hl.hoveredMappingId).toBe('m1');
	});

	it('keeps the pending timer when moving between tokens of the same mapping', () => {
		const hl = makeHighlight({ source: { 0: 'm1', 1: 'm1' } });
		hl.hoverSource(0);
		vi.advanceTimersByTime(COLD - 100);
		hl.hoverSource(1);
		vi.advanceTimersByTime(100);
		expect(hl.hoveredMappingId).toBe('m1');
	});

	it('cancels a pending light-up when the pointer leaves before it fires', () => {
		const hl = makeHighlight({ source: { 0: 'm1' } });
		hl.hoverSource(0);
		hl.hoverOut();
		vi.advanceTimersByTime(COLD * 2);
		expect(hl.hoveredMappingId).toBeNull();
	});

	it('stays lit across same-mapping moves and clears immediately on hover-out', () => {
		const hl = makeHighlight({ source: { 0: 'm1', 1: 'm1' } });
		hl.hoverSource(0);
		vi.advanceTimersByTime(COLD);
		hl.hoverSource(1); // same mapping — no flash, no timer
		expect(hl.hoveredMappingId).toBe('m1');
		hl.hoverOut();
		expect(hl.hoveredMappingId).toBeNull();
	});

	it('re-entering within the grace window uses the shorter warm delay', () => {
		const hl = makeHighlight({ source: { 0: 'm1' }, target: { 0: 'm2' } });
		hl.hoverSource(0);
		vi.advanceTimersByTime(COLD);
		hl.hoverOut();
		hl.hoverTarget(0);
		vi.advanceTimersByTime(WARM - 1);
		expect(hl.hoveredMappingId).toBeNull();
		vi.advanceTimersByTime(1);
		expect(hl.hoveredMappingId).toBe('m2');
	});

	it('cools back down once the grace window expires', () => {
		const hl = makeHighlight({ source: { 0: 'm1' } });
		hl.hoverSource(0);
		vi.advanceTimersByTime(COLD);
		hl.hoverOut();
		vi.advanceTimersByTime(GRACE);
		hl.hoverSource(0);
		vi.advanceTimersByTime(WARM);
		expect(hl.hoveredMappingId).toBeNull();
		vi.advanceTimersByTime(COLD - WARM);
		expect(hl.hoveredMappingId).toBe('m1');
	});

	it('hovering an unmapped token clears the lit mapping immediately', () => {
		const hl = makeHighlight({ source: { 0: 'm1' } });
		hl.hoverSource(0);
		vi.advanceTimersByTime(COLD);
		hl.hoverSource(5); // resolver → null
		expect(hl.hoveredMappingId).toBeNull();
	});
});

describe('tap', () => {
	it('lights instantly, toggles off on the same mapping, switches on another', () => {
		const hl = makeHighlight({ source: { 0: 'm1', 1: 'm2' } });
		hl.tapSource(0);
		expect(hl.hoveredMappingId).toBe('m1');
		hl.tapSource(1);
		expect(hl.hoveredMappingId).toBe('m2');
		hl.tapSource(1);
		expect(hl.hoveredMappingId).toBeNull();
	});

	it('re-lights on hover after a tap-off (pointer stays in lockstep)', () => {
		const hl = makeHighlight({ source: { 0: 'm1' } });
		hl.tapSource(0);
		hl.tapSource(0); // toggled off
		hl.hoverSource(0);
		vi.advanceTimersByTime(COLD);
		expect(hl.hoveredMappingId).toBe('m1');
	});

	it('resets warmth: the hover after a tap uses the cold delay again', () => {
		const hl = makeHighlight({ source: { 0: 'm1' }, target: { 0: 'm2' } });
		hl.hoverSource(0);
		vi.advanceTimersByTime(COLD);
		hl.hoverOut(); // warm, grace timer running
		hl.tapSource(0); // lit
		hl.tapSource(0); // off — warmth reset
		hl.hoverTarget(0);
		vi.advanceTimersByTime(WARM);
		expect(hl.hoveredMappingId).toBeNull(); // still warm would have lit by now
		vi.advanceTimersByTime(COLD - WARM);
		expect(hl.hoveredMappingId).toBe('m2');
	});

	it('cancels a pending hover light-up', () => {
		const hl = makeHighlight({ source: { 0: 'm1', 1: 'm2' } });
		hl.hoverSource(0); // cold timer pending for m1
		hl.tapSource(1);
		expect(hl.hoveredMappingId).toBe('m2');
		vi.advanceTimersByTime(COLD * 2);
		expect(hl.hoveredMappingId).toBe('m2'); // the m1 timer never fires
	});
});

describe('queries and reset', () => {
	it('isSourceHighlighted / isTargetHighlighted follow the lit mapping across panels', () => {
		const hl = makeHighlight({ source: { 0: 'm1' }, target: { 2: 'm1', 3: 'm2' } });
		hl.tapSource(0);
		expect(hl.isSourceHighlighted(0)).toBe(true);
		expect(hl.isTargetHighlighted(2)).toBe(true);
		expect(hl.isTargetHighlighted(3)).toBe(false);
	});

	it('clearHighlight cancels timers, unlights, and resets warmth', () => {
		const hl = makeHighlight({ source: { 0: 'm1' } });
		hl.hoverSource(0);
		vi.advanceTimersByTime(COLD);
		hl.hoverOut(); // grace timer running
		hl.hoverSource(0); // warm timer pending
		hl.clearHighlight();
		vi.advanceTimersByTime(COLD * 2);
		expect(hl.hoveredMappingId).toBeNull();
		hl.hoverSource(0);
		vi.advanceTimersByTime(WARM);
		expect(hl.hoveredMappingId).toBeNull(); // cold again, not warm
		vi.advanceTimersByTime(COLD - WARM);
		expect(hl.hoveredMappingId).toBe('m1');
	});
});
