import { describe, it, expect } from 'vitest';
import { MAPPING_COLORS } from '$lib/constants/colors';
import type { TargetToken } from '$lib/tokenize';
import {
	buildTargetText,
	deriveSourceTokenState,
	deriveTargetTokenState,
	type Mapping,
} from './tokenState';

function mapping(overrides: Partial<Mapping> = {}): Mapping {
	return { id: 'm1', colorIndex: 0, sourceTokenIds: [], targetTokenIds: [], ...overrides };
}

function targetToken(overrides: Partial<TargetToken> = {}): TargetToken {
	return { id: 0, text: '', line: 0, type: 'text', ...overrides };
}

describe('deriveSourceTokenState', () => {
	const m1 = mapping({ id: 'm1', colorIndex: 0 });
	const sourceMappingIndex = new Map([[0, 'm1']]);

	it('returns unmapped for a token in no mapping', () => {
		expect(deriveSourceTokenState(1, sourceMappingIndex, [m1], null)).toEqual({
			kind: 'unmapped',
		});
	});

	it('returns idle for a token in a non-active mapping', () => {
		expect(deriveSourceTokenState(0, sourceMappingIndex, [m1], null)).toEqual({
			kind: 'idle',
			color: MAPPING_COLORS[0].source,
		});
	});

	it('returns active for a token in the active mapping', () => {
		expect(deriveSourceTokenState(0, sourceMappingIndex, [m1], 'm1')).toEqual({
			kind: 'active',
			color: MAPPING_COLORS[0].source,
		});
	});
});

describe('deriveTargetTokenState', () => {
	const m1 = mapping({ id: 'm1', colorIndex: 0 });

	it('returns unmapped for a token in no mapping', () => {
		const tokens = [targetToken({ id: 0, type: 'text' })];
		expect(deriveTargetTokenState(0, tokens, new Map(), [m1], null)).toEqual({
			kind: 'unmapped',
		});
	});

	it('returns idle/active for a token in a mapping', () => {
		const tokens = [targetToken({ id: 0, type: 'text' })];
		const targetMappingIndex = new Map([[0, 'm1']]);
		expect(deriveTargetTokenState(0, tokens, targetMappingIndex, [m1], null)).toEqual({
			kind: 'idle',
			color: MAPPING_COLORS[0].target,
		});
		expect(deriveTargetTokenState(0, tokens, targetMappingIndex, [m1], 'm1')).toEqual({
			kind: 'active',
			color: MAPPING_COLORS[0].target,
		});
	});

	it('bridges a whitespace token flanked by the same mapping on both sides', () => {
		const tokens = [
			targetToken({ id: 0, text: 'one', type: 'text' }),
			targetToken({ id: 1, text: ' ', type: 'whitespace' }),
			targetToken({ id: 2, text: 'two', type: 'text' }),
		];
		const targetMappingIndex = new Map([
			[0, 'm1'],
			[2, 'm1'],
		]);
		expect(deriveTargetTokenState(1, tokens, targetMappingIndex, [m1], null)).toEqual({
			kind: 'idle',
			color: MAPPING_COLORS[0].target,
		});
		expect(deriveTargetTokenState(1, tokens, targetMappingIndex, [m1], 'm1')).toEqual({
			kind: 'active',
			color: MAPPING_COLORS[0].target,
		});
	});

	it('does not bridge a whitespace token flanked by different mappings', () => {
		const m2 = mapping({ id: 'm2', colorIndex: 1 });
		const tokens = [
			targetToken({ id: 0, text: 'one', type: 'text' }),
			targetToken({ id: 1, text: ' ', type: 'whitespace' }),
			targetToken({ id: 2, text: 'two', type: 'text' }),
		];
		const targetMappingIndex = new Map([
			[0, 'm1'],
			[2, 'm2'],
		]);
		expect(deriveTargetTokenState(1, tokens, targetMappingIndex, [m1, m2], null)).toEqual({
			kind: 'unmapped',
		});
	});

	it('does not bridge a whitespace token at the start of the array (no left neighbor)', () => {
		const tokens = [
			targetToken({ id: 0, text: ' ', type: 'whitespace' }),
			targetToken({ id: 1, text: 'one', type: 'text' }),
		];
		const targetMappingIndex = new Map([[1, 'm1']]);
		expect(deriveTargetTokenState(0, tokens, targetMappingIndex, [m1], null)).toEqual({
			kind: 'unmapped',
		});
	});
});

describe('buildTargetText', () => {
	it('returns empty string for no indices', () => {
		expect(buildTargetText([], [])).toBe('');
	});

	it('returns the text of a single token', () => {
		const tokens = [targetToken({ id: 0, text: 'hello', type: 'text' })];
		expect(buildTargetText([0], tokens)).toBe('hello');
	});

	it('bridges across whitespace within the distance threshold', () => {
		const tokens = [
			targetToken({ id: 0, text: 'There', type: 'text' }),
			targetToken({ id: 1, text: ' ', type: 'whitespace' }),
			targetToken({ id: 2, text: 'is', type: 'text' }),
		];
		expect(buildTargetText([0, 2], tokens)).toBe('There is');
	});

	it('splits into separate groups when an intervening token is not whitespace/punctuation', () => {
		const tokens = [
			targetToken({ id: 0, text: 'one', type: 'text' }),
			targetToken({ id: 1, text: 'two', type: 'text' }),
			targetToken({ id: 2, text: 'three', type: 'text' }),
		];
		expect(buildTargetText([0, 2], tokens)).toBe('one, three');
	});

	it('splits into separate groups when indices are more than 5 apart', () => {
		const tokens = Array.from({ length: 8 }, (_, i) =>
			targetToken({ id: i, text: `a${i}`, type: 'text' })
		);
		expect(buildTargetText([0, 7], tokens)).toBe('a0, a7');
	});
});
