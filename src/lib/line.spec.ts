import { describe, it, expect } from 'vitest';
import { splitAfterToken, mergeLines } from './line';

// Both functions only read/write `.line`, so bare line numbers are enough.
const toks = (...lines: number[]) => lines.map((line) => ({ line }));
const linesOf = (tokens: { line: number }[]) => tokens.map((t) => t.line);

describe('splitAfterToken', () => {
	it('moves same-line tokens after the split point onto a new line', () => {
		expect(linesOf(splitAfterToken(toks(0, 0, 0), 0))).toEqual([0, 1, 1]);
	});

	it('shifts all subsequent lines down by one', () => {
		expect(linesOf(splitAfterToken(toks(0, 0, 1, 2), 0))).toEqual([0, 1, 2, 3]);
	});

	it('does not mutate the input tokens', () => {
		const input = toks(0, 0);
		splitAfterToken(input, 0);
		expect(linesOf(input)).toEqual([0, 0]);
	});

	it('throws on an out-of-range index (documented precondition)', () => {
		expect(() => splitAfterToken(toks(0), 5)).toThrow(TypeError);
	});
});

describe('mergeLines', () => {
	it('collapses line N+1 into line N and shifts later lines up', () => {
		expect(linesOf(mergeLines(toks(0, 1, 1, 2), 0))).toEqual([0, 0, 0, 1]);
	});

	it('leaves lines before N untouched when merging a middle line', () => {
		expect(linesOf(mergeLines(toks(0, 1, 2), 1))).toEqual([0, 1, 1]);
	});

	it('is a no-op when there is no line N+1', () => {
		expect(linesOf(mergeLines(toks(0, 1), 1))).toEqual([0, 1]);
	});

	it('does not mutate the input tokens', () => {
		const input = toks(0, 1);
		mergeLines(input, 0);
		expect(linesOf(input)).toEqual([0, 1]);
	});
});
