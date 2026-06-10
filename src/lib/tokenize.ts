// Allowlist for source text input: Han characters, CJK punctuation blocks, and newlines.
export const SOURCE_INPUT_RE = /[^\p{Script=Han}　-〿＀-￯\n]/gu;

export type SourceToken = {
	id: number; // stable across split/merge; assigned once at tokenization as array position
	text: string;
	line: number;
	type: 'character' | 'punctuation' | 'number' | 'symbol';
	pinyin?: string | null; // undefined: character not yet annotated; null: not applicable
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

// ── Target — V1: all punctuation separate ────────────────────────────────────

// Matches, in priority order:
//   1. single Han character
//   2. Latin word, optionally with one internal apostrophe (contractions: don't, it's)
//   3. whitespace run (excluding newlines)
//   4. any remaining non-letter non-digit run (punctuation, symbols, em-dashes, etc.)
const SEPARATE_RE = /\p{Script=Han}|[A-Za-z]+(?:'[A-Za-z]+)*|[^\S\n]+|[^\p{L}\p{N}\s]+/gu;

/**
 * Tokenizes target text with every punctuation run as its own token.
 * Newlines delimit lines; they are not emitted as tokens.
 *
 * `There's nothing "simple" in programming.`
 * → [There's][ ][nothing][ ]["][simple]["][ ][in][ ][programming][.]
 */
export function tokenizeTargetSeparate(text: string): TargetToken[] {
	const lines = text.split('\n');
	return lines.flatMap((lineText, line) => {
		const tokens: Omit<TargetToken, 'id'>[] = [];
		for (const { 0: t } of lineText.matchAll(SEPARATE_RE)) {
			if (/^\s+$/.test(t)) {
				tokens.push({ text: t, line, type: 'whitespace' });
			} else if (/^\p{Script=Han}$/u.test(t)) {
				tokens.push({ text: t, line, type: 'hanzi' });
			} else if (/^[A-Za-z]/u.test(t)) {
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

// ── Target — V2: punctuation attaches to adjacent words ──────────────────────

// Matches, in priority order:
//   1. optional leading punct + Latin word + optional trailing punct  (e.g. "simple", programming.)
//   2. single Han character
//   3. whitespace run (excluding newlines)
//   4. standalone punctuation not adjacent to any word
const COMBINED_RE =
	/[^\p{L}\p{N}\s]*[A-Za-z]+(?:'[A-Za-z]+)*[^\p{L}\p{N}\s]*|\p{Script=Han}|[^\S\n]+|[^\p{L}\p{N}\s]+/gu;

/**
 * Tokenizes target text with flanking punctuation absorbed into word tokens.
 * Newlines delimit lines; they are not emitted as tokens.
 *
 * `There's nothing "simple" in programming.`
 * → [There's][ ][nothing][ ]["simple"][ ][in][ ][programming.]
 */
export function tokenizeTargetCombined(text: string): TargetToken[] {
	const lines = text.split('\n');
	return lines.flatMap((lineText, line) => {
		const tokens: Omit<TargetToken, 'id'>[] = [];
		for (const { 0: t } of lineText.matchAll(COMBINED_RE)) {
			if (/^\s+$/.test(t)) {
				tokens.push({ text: t, line, type: 'whitespace' });
			} else if (/^\p{Script=Han}$/u.test(t)) {
				tokens.push({ text: t, line, type: 'hanzi' });
			} else if (/\p{L}/u.test(t)) {
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
