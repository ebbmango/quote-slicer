// Allowlist for source text input: Han characters, CJK punctuation blocks, and newlines.
// \u3000-\u303F: CJK Symbols and Punctuation (ideographic space through 〿); \uFF00-\uFFEF: Halfwidth
// and Fullwidth Forms (＀ to ￯). Escapes, not literals — the raw characters are
// invisible/confusable in an editor (and trip no-irregular-whitespace).
export const SOURCE_INPUT_RE = /[^\p{Script=Han}\u3000-\u303F\uFF00-\uFFEF\s]/gu;

import type { SourceToken, TargetToken } from './quotation';
export type { SourceToken, TargetToken } from './quotation';

export type Tokenized<T> = { tokens: T[]; breaks: number[]; errors: string[] };

function tokenizeLines<T extends { id: number }>(
	text: string,
	tokenize: (line: string) => T[],
	separator?: () => T
): Tokenized<T> {
	const tokens: T[] = [];
	const breaks: number[] = [];
	const errors: string[] = [];
	const lines = text.split('\n');
	lines.forEach((line, i) => {
		tokens.push(...tokenize(line));
		if (text && !line.length && (!separator || i === lines.length - 1))
			errors.push(
				`Empty authored line ${i + 1} cannot be represented; remove it or enter textual content.`
			);
		if (i < lines.length - 1) {
			if (separator) tokens.push(separator());
			breaks.push(tokens.length);
		}
	});
	return {
		tokens: tokens.map((token, id) => ({ ...token, id })),
		// A draft may temporarily contain incomplete lines. Errors block committing it.
		breaks: [...new Set(breaks)].filter((b) => b > 0 && b < tokens.length),
		errors
	};
}

// ── Source ────────────────────────────────────────────────────────────────────

/**
 * Tokenizes Chinese source text: every character is its own token.
 * Newlines delimit lines; they are not emitted as tokens.
 */
export function tokenizeSource(text: string): SourceToken[] {
	return parseSource(text).tokens;
}

export function parseSource(text: string): Tokenized<SourceToken> {
	return tokenizeLines<SourceToken>(text, (lineText) =>
		[...lineText].map((char) => {
			if (/\p{Script=Han}/u.test(char))
				return { id: 0, text: char, type: 'character', pinyin: undefined };
			if (/\p{N}/u.test(char)) return { id: 0, text: char, type: 'number', pinyin: null };
			if (/[\p{P}\p{S}]/u.test(char))
				return { id: 0, text: char, type: 'punctuation', pinyin: null };
			return { id: 0, text: char, type: 'symbol', pinyin: null };
		})
	);
}

// Leading punctuation — opening brackets (`\p{Ps}`: 「『《【（) and initial quotes
// (`\p{Pi}`: “‘«). These bind to the token that FOLLOWS them; every other
// punctuation (closing brackets, terminal marks like 。，！？) binds to the token
// that PRECEDES it. Lets the grouper decide each punct's side from the character
// itself rather than a hand-kept list.
const LEADING_PUNCT_RE = /^[\p{Ps}\p{Pi}]/u;

const isPunct = (t: SourceToken) => t.type === 'punctuation';
const isLeading = (t: SourceToken) => isPunct(t) && LEADING_PUNCT_RE.test(t.text);

/**
 * Groups source tokens so punctuation never wraps apart from the base token
 * (character / number / symbol) it belongs to. Returns arrays of token indices —
 * each group is one base token plus its glued leading/trailing punctuation, or a
 * standalone punctuation run with no base to bind to.
 *
 * Grouping never crosses an explicit sequence boundary. Imported breaks can
 * separate punctuation from its base without changing canonical tokens.
 */
export function groupSourceTokens(
	tokens: SourceToken[],
	breaks: readonly number[] = []
): number[][] {
	const groups: number[][] = [];
	let cur: number[] | null = null; // open group anchored by a base token
	let pending: number[] = []; // buffered leading puncts awaiting their base

	const flushPending = () => {
		if (pending.length) groups.push(pending);
		pending = [];
	};
	const flushCur = () => {
		if (cur) groups.push(cur);
		cur = null;
	};

	for (let i = 0; i < tokens.length; i++) {
		const t = tokens[i];
		if (breaks.includes(i)) {
			flushCur();
			flushPending();
		}
		if (isLeading(t)) {
			// Binds to the NEXT base → buffer it. A line change orphans any earlier
			// buffered leading puncts into their own group.
			flushCur();
			pending.push(i);
		} else if (isPunct(t)) {
			// Trailing punct: binds to the PREVIOUS base on the same line, if any.
			if (cur) {
				cur.push(i);
			} else {
				flushCur();
				flushPending();
				groups.push([i]); // stray trailing punct with no base to its left
			}
		} else {
			// Base token: absorb same-line leading puncts buffered ahead of it.
			flushCur();
			if (pending.length) {
				cur = [...pending, i];
				pending = [];
			} else {
				flushPending();
				cur = [i];
			}
		}
	}
	flushCur();
	flushPending();
	return groups;
}

// ── Target ────────────────────────────────────────────────────────────────────

// Matches, in priority order:
//   1. single Han character
//   2. a word (Latin letters or digits) with any flanking punctuation absorbed:
//      optional leading punct + word + optional contraction groups + optional trailing punct.
//      Lookbehind/lookahead `(?<![A-Za-z0-9])` / `(?![A-Za-z0-9])` stop punctuation that is
//      flanked by word-chars on BOTH sides (hyphens, decimal points, thousands separators)
//      from being absorbed — those split out as standalone tokens. The contraction group
//      `(?:['’][A-Za-z0-9]+)*` is the exception: a straight or curly apostrophe between
//      word-chars stays merged (don't, it’s, James').
//   3. whitespace run (excluding newlines)
//   4. standalone punctuation run not adjacent to any word
const TARGET_RE =
	/\p{Script=Han}|(?<![A-Za-z0-9])[^\p{L}\p{N}\s]*[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*[^\p{L}\p{N}\s]*(?![A-Za-z0-9])|[^\S\n]+|[^\p{L}\p{N}\s]+/gu;

/**
 * Tokenizes target text. Punctuation touching a word (letters or digits) is absorbed into
 * that word's token, EXCEPT punctuation flanked by word-chars on both sides — hyphens
 * (well-known → [well][-][known]) and decimal/thousands separators (3.14 → [3][.][14]) —
 * which split out so the user can map each piece. Apostrophes inside contractions stay merged.
 * Newlines delimit lines; they are not emitted as tokens.
 *
 * `There's nothing "simple" in programming.`
 * → [There's][ ][nothing][ ]["simple"][ ][in][ ][programming.]
 */
export function tokenizeTarget(text: string): TargetToken[] {
	return parseTarget(text).tokens;
}

export function parseTarget(text: string): Tokenized<TargetToken> {
	// Authoring boundary: discard only outer non-newline whitespace before allocating
	// tokens/IDs. Keep authored newlines (and their validation) and internal text intact.
	text = text.replace(/^[^\S\n]+|[^\S\n]+$/gu, '');
	return tokenizeLines<TargetToken>(
		text,
		(lineText) => {
			const tokens: TargetToken[] = [];
			let cursor = 0;
			for (const { 0: t } of lineText.matchAll(TARGET_RE)) {
				const index = lineText.indexOf(t, cursor);
				// Preserve letters outside the legacy Latin/Han matcher, including diacritics.
				if (index > cursor)
					tokens.push({ id: 0, text: lineText.slice(cursor, index), type: 'text' });
				cursor = index + t.length;
				if (/^\s+$/.test(t)) {
					tokens.push({ id: 0, text: t, type: 'whitespace' });
				} else if (/^\p{Script=Han}$/u.test(t)) {
					tokens.push({ id: 0, text: t, type: 'hanzi' });
				} else if (/[\p{L}\p{N}]/u.test(t)) {
					tokens.push({ id: 0, text: t, type: 'text' });
				} else {
					tokens.push({ id: 0, text: t, type: 'punctuation' });
				}
			}
			if (cursor < lineText.length)
				tokens.push({ id: 0, text: lineText.slice(cursor), type: 'text' });
			return tokens;
		},
		() => ({ id: 0, text: ' ', type: 'whitespace' })
	);
}
