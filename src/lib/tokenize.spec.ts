import { describe, it, expect } from 'vitest';
import { groupSourceTokens, tokenizeSource, tokenizeTarget } from '$lib/tokenize';

// Helper: tokenize and project to [text, type] pairs for terse assertions.
const toks = (s: string) => tokenizeTarget(s).map((t) => [t.text, t.type] as const);

// Helper: group and project each group's indices back to a joined text string.
const groups = (s: string) => {
	const tokens = tokenizeSource(s);
	return groupSourceTokens(tokens).map((g) => g.map((i) => tokens[i].text).join(''));
};

describe('tokenizeSource', () => {
	it('makes every character its own token with sequential stable ids', () => {
		expect(tokenizeSource('我爱你')).toEqual([
			{ id: 0, text: '我', line: 0, type: 'character', pinyin: undefined },
			{ id: 1, text: '爱', line: 0, type: 'character', pinyin: undefined },
			{ id: 2, text: '你', line: 0, type: 'character', pinyin: undefined }
		]);
	});

	it('classifies numbers and punctuation with pinyin not applicable', () => {
		const [num, punct] = tokenizeSource('5。');
		expect(num).toMatchObject({ type: 'number', pinyin: null });
		expect(punct).toMatchObject({ type: 'punctuation', pinyin: null });
	});

	it('stamps lines from newlines without emitting newline tokens', () => {
		expect(tokenizeSource('我\n你').map((t) => [t.text, t.line, t.id])).toEqual([
			['我', 0, 0],
			['你', 1, 1]
		]);
	});
});

describe('groupSourceTokens', () => {
	it('returns groups of token indices', () => {
		expect(groupSourceTokens(tokenizeSource('我。'))).toEqual([[0, 1]]);
	});

	it('glues trailing punctuation to the preceding base token', () => {
		expect(groups('我，你。')).toEqual(['我，', '你。']);
	});

	it('binds leading punctuation to the following base token', () => {
		expect(groups('「我」你')).toEqual(['「我」', '你']);
	});

	it('keeps a stray trailing punct with no base as its own group', () => {
		expect(groups('。我')).toEqual(['。', '我']);
	});

	it('flushes buffered leading puncts left dangling at the end', () => {
		expect(groups('我「')).toEqual(['我', '「']);
	});

	it('does not glue trailing punctuation across a line boundary', () => {
		expect(groups('我\n。')).toEqual(['我', '。']);
	});

	it('orphans a leading punct whose base lands on the next line', () => {
		expect(groups('你「\n我')).toEqual(['你', '「', '我']);
	});

	it('orphans buffered leading puncts when a newer leading punct starts a new line', () => {
		expect(groups('「\n『我')).toEqual(['「', '『我']);
	});
});

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
