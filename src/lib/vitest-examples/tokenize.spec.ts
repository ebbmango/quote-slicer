import { describe, it, expect } from 'vitest';
import { tokenizeTarget } from '$lib/tokenize';

// Helper: tokenize and project to [text, type] pairs for terse assertions.
const toks = (s: string) => tokenizeTarget(s).map((t) => [t.text, t.type] as const);

describe('tokenizeTarget — flanking punctuation', () => {
	it('absorbs surrounding quotes into the word', () => {
		expect(toks('"simple"')).toEqual([['"simple"', 'text']]);
	});

	it('absorbs a trailing period', () => {
		expect(toks('programming.')).toEqual([['programming.', 'text']]);
	});

	it('absorbs a trailing comma', () => {
		expect(toks('cat, dog')).toEqual([
			['cat,', 'text'],
			[' ', 'whitespace'],
			['dog', 'text']
		]);
	});

	it('absorbs leading and trailing punctuation together', () => {
		expect(toks('(hello)')).toEqual([['(hello)', 'text']]);
	});
});

describe('tokenizeTarget — interior punctuation splits out', () => {
	it('splits hyphenated compounds into three tokens', () => {
		expect(toks('well-known')).toEqual([
			['well', 'text'],
			['-', 'punctuation'],
			['known', 'text']
		]);
	});

	it('splits an em-dash between words', () => {
		expect(toks('word—word')).toEqual([
			['word', 'text'],
			['—', 'punctuation'],
			['word', 'text']
		]);
	});
});

describe('tokenizeTarget — contractions stay merged', () => {
	it('keeps a straight-apostrophe contraction whole', () => {
		expect(toks("don't")).toEqual([["don't", 'text']]);
	});

	it('keeps a curly-apostrophe contraction whole', () => {
		expect(toks('it’s')).toEqual([['it’s', 'text']]);
	});

	it('absorbs a trailing possessive apostrophe', () => {
		expect(toks("dogs'")).toEqual([["dogs'", 'text']]);
	});
});

describe('tokenizeTarget — numbers', () => {
	it('absorbs a leading currency symbol', () => {
		expect(toks('$5')).toEqual([['$5', 'text']]);
	});

	it('absorbs a trailing percent sign', () => {
		expect(toks('5%')).toEqual([['5%', 'text']]);
	});

	it('absorbs a sentence-final period after a number', () => {
		expect(toks('5.')).toEqual([['5.', 'text']]);
	});

	it('splits a decimal point flanked by digits', () => {
		expect(toks('3.14')).toEqual([
			['3', 'text'],
			['.', 'punctuation'],
			['14', 'text']
		]);
	});

	it('splits each interior separator in a currency amount', () => {
		expect(toks('$5,000.00')).toEqual([
			['$5', 'text'],
			[',', 'punctuation'],
			['000', 'text'],
			['.', 'punctuation'],
			['00', 'text']
		]);
	});
});

describe('tokenizeTarget — standalone punctuation', () => {
	it('treats a punctuation run with no adjacent word as punctuation', () => {
		expect(toks('hi ... bye')).toEqual([
			['hi', 'text'],
			[' ', 'whitespace'],
			['...', 'punctuation'],
			[' ', 'whitespace'],
			['bye', 'text']
		]);
	});
});

describe('tokenizeTarget — hanzi and lines', () => {
	it('keeps target hanzi as single-char tokens, punctuation standalone', () => {
		expect(toks('你好!')).toEqual([
			['你', 'hanzi'],
			['好', 'hanzi'],
			['!', 'punctuation']
		]);
	});

	it('appends a boundary whitespace token between lines', () => {
		expect(toks('a\nb')).toEqual([
			['a', 'text'],
			[' ', 'whitespace'],
			['b', 'text']
		]);
	});
});

describe('tokenizeTarget — full sentence', () => {
	it('matches the documented example', () => {
		expect(tokenizeTarget(`There's nothing "simple" in programming.`).map((t) => t.text)).toEqual([
			"There's",
			' ',
			'nothing',
			' ',
			'"simple"',
			' ',
			'in',
			' ',
			'programming.'
		]);
	});
});
