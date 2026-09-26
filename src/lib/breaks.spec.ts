import { describe, expect, it } from 'vitest';
import { canonicalText, editBreak, normalizeBreaks, replaceBreaks, validateBreaks } from './breaks';

describe('editorial boundaries', () => {
	it('validates interior sorted unique integer positions, including empty streams', () => {
		for (const n of [0, 1, 5]) expect(() => validateBreaks([], n)).not.toThrow();
		validateBreaks([1, 2, 3], 4);
		for (const breaks of [[0], [4], [-1], [1.5], [2, 1], [1, 1], [NaN], [Infinity]]) {
			expect(() => validateBreaks(breaks, 4)).toThrow();
		}
		expect(normalizeBreaks([3, 1, 1], 4)).toEqual([1, 3]);
		expect(() => normalizeBreaks([0], 4)).toThrow();
	});
	it('edits only breaks and keeps canonical whitespace and punctuation', () => {
		const tokens = [{ text: 'A.' }, { text: ' ' }, { text: 'B.' }];
		const breaks = editBreak([], tokens.length, 2, true);
		expect(editBreak(breaks, 3, 2, true)).toEqual([2]);
		expect(editBreak(breaks, 3, 2, false)).toEqual([]);
		expect(canonicalText(tokens)).toBe('A. B.');
	});
	it('requires explicit insertion affinity at an existing break', () => {
		expect(() => replaceBreaks([2], 4, 2, 2, 1)).toThrow(/affinity/);
		expect(replaceBreaks([2], 4, 2, 2, 1, 'before-break')).toEqual([3]);
		expect(replaceBreaks([2], 4, 2, 2, 1, 'after-break')).toEqual([2]);
		expect(replaceBreaks([2], 4, 1, 1, 2)).toEqual([4]);
		expect(replaceBreaks([2], 4, 3, 3, 2)).toEqual([2]);
	});
	it.each([
		[[2], 4, 0, 1, 0, [1]],
		[[2], 4, 3, 4, 0, [2]],
		[[2], 4, 1, 2, 0, [1]],
		[[2], 4, 2, 3, 0, [2]],
		[[1, 2, 3, 4], 5, 1, 4, 0, [1]],
		[[1, 2], 3, 0, 2, 0, []],
		[[1, 2], 3, 1, 3, 0, []],
		[[1, 2], 3, 0, 3, 0, []],
		[[1, 2], 3, 1, 2, 3, [1, 4]],
		[[1, 2, 3], 4, 1, 3, 1, [1, 2]]
	] as [number[], number, number, number, number, number[]][])(
		'transforms %j for count %i, range [%i,%i), replacement count %i',
		(breaks, count, start, end, inserted, expected) => {
			expect(replaceBreaks(breaks, count, start, end, inserted)).toEqual(expected);
		}
	);
	it('keeps every small deletion/split replacement valid', () => {
		for (let count = 0; count <= 8; count++) {
			const breaks = Array.from({ length: Math.max(0, count - 1) }, (_, i) => i + 1);
			for (let start = 0; start <= count; start++)
				for (let end = start; end <= count; end++) {
					for (let inserted = 0; inserted < 4; inserted++) {
						const result = replaceBreaks(breaks, count, start, end, inserted, 'after-break');
						expect(() => validateBreaks(result, count - end + start + inserted)).not.toThrow();
					}
				}
		}
	});
});
