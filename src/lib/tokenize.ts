// Allowlist for source text input: Han characters, CJK punctuation blocks, and newlines.
export const SOURCE_INPUT_RE = /[^\p{Script=Han}　-〿＀-￯\n]/gu;

export type SourceToken = {
	id: number; // stable across split/merge; assigned once at tokenization as array position
	text: string;
	line: number;
	type: 'character' | 'punctuation' | 'number' | 'symbol';
	pinyin?: string | null; // canonical numbered pinyin ("zhi1") when parseable, raw text otherwise; undefined: character not yet annotated; null: not applicable
};

export type TargetToken = {
	id: number; // stable across split/merge; assigned once at tokenization as array position
	text: string;
	line: number;
	type: 'text' | 'hanzi' | 'punctuation' | 'whitespace';
};

// ── Source ────────────────────────────────────────────────────────────────────

/**
 * Tokenizes Chinese source text: every character is its own token.
 * Newlines delimit lines; they are not emitted as tokens.
 */
export function tokenizeSource(text: string): SourceToken[] {
	return text.split('\n').flatMap((lineText, line) =>
		[...lineText].map((char) => {
			if (/\p{Script=Han}/u.test(char))
				return { text: char, line, type: 'character' as const, pinyin: undefined };
			if (/\p{N}/u.test(char)) return { text: char, line, type: 'number' as const, pinyin: null };
			if (/[\p{P}\p{S}]/u.test(char))
				return { text: char, line, type: 'punctuation' as const, pinyin: null };
			return { text: char, line, type: 'symbol' as const, pinyin: null };
		})
	).map((t, id) => ({ ...t, id }));
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
 * Grouping never crosses a `.line` boundary: a punct on a different line than its
 * would-be base splits off into its own group, so a line-mode split between a
 * char and its punctuation separates them naturally (they fall onto different
 * lines → different groups).
 */
export function groupSourceTokens(tokens: SourceToken[]): number[][] {
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
		if (isLeading(t)) {
			// Binds to the NEXT base → buffer it. A line change orphans any earlier
			// buffered leading puncts into their own group.
			if (pending.length && tokens[pending[0]].line !== t.line) flushPending();
			flushCur();
			pending.push(i);
		} else if (isPunct(t)) {
			// Trailing punct: binds to the PREVIOUS base on the same line, if any.
			if (cur && tokens[cur[0]].line === t.line) {
				cur.push(i);
			} else {
				flushCur();
				flushPending();
				groups.push([i]); // stray trailing punct with no base to its left
			}
		} else {
			// Base token: absorb same-line leading puncts buffered ahead of it.
			flushCur();
			if (pending.length && tokens[pending[0]].line === t.line) {
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
	const lines = text.split('\n');
	return lines.flatMap((lineText, line) => {
		const tokens: Omit<TargetToken, 'id'>[] = [];
		for (const { 0: t } of lineText.matchAll(TARGET_RE)) {
			if (/^\s+$/.test(t)) {
				tokens.push({ text: t, line, type: 'whitespace' });
			} else if (/^\p{Script=Han}$/u.test(t)) {
				tokens.push({ text: t, line, type: 'hanzi' });
			} else if (/[\p{L}\p{N}]/u.test(t)) {
				tokens.push({ text: t, line, type: 'text' });
			} else {
				tokens.push({ text: t, line, type: 'punctuation' });
			}
		}
		// Boundary whitespace: acts as merge affordance in line mode.
		if (line < lines.length - 1) tokens.push({ text: ' ', line, type: 'whitespace' });
		return tokens;
	}).map((t, id) => ({ ...t, id }));
}
