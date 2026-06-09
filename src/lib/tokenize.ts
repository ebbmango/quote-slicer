/**
 * Raw tokenizer output types — lightweight intermediates before alignment
 * and transliteration are added to produce the full SourceToken/TargetToken.
 */

// Allowlist for source text input: Han characters, CJK punctuation blocks, and newlines.
export const SOURCE_INPUT_RE = /[^\p{Script=Han}　-〿＀-￯\n]/gu;

export type RawSourceToken = {
	text: string;
	type: 'character' | 'punctuation' | 'number' | 'symbol';
};

export type RawTargetToken = {
	text: string;
	type: 'text' | 'hanzi' | 'punctuation' | 'whitespace';
};

// ── Source ────────────────────────────────────────────────────────────────────

/**
 * Tokenizes Chinese source text: every character is its own token.
 */
export function tokenizeSource(text: string): RawSourceToken[] {
	return [...text].map((char) => {
		if (/\p{Script=Han}/u.test(char)) return { text: char, type: 'character' };
		if (/\p{N}/u.test(char)) return { text: char, type: 'number' };
		if (/[\p{P}\p{S}]/u.test(char)) return { text: char, type: 'punctuation' };
		return { text: char, type: 'symbol' };
	});
}

// ── Target — V1: all punctuation separate ────────────────────────────────────

// Matches, in priority order:
//   1. single Han character
//   2. Latin word, optionally with one internal apostrophe (contractions: don't, it's)
//   3. whitespace run
//   4. any remaining non-letter non-digit run (punctuation, symbols, em-dashes, etc.)
const SEPARATE_RE = /\p{Script=Han}|[A-Za-z]+(?:'[A-Za-z]+)*|\s+|[^\p{L}\p{N}\s]+/gu;

/**
 * Tokenizes target text with every punctuation run as its own token.
 *
 * `There's nothing "simple" in programming.`
 * → [There's][ ][nothing][ ]["][simple]["][ ][in][ ][programming][.]
 */
export function tokenizeTargetSeparate(text: string): RawTargetToken[] {
	const tokens: RawTargetToken[] = [];
	for (const { 0: t } of text.matchAll(SEPARATE_RE)) {
		if (/^\s+$/.test(t)) {
			tokens.push({ text: t, type: 'whitespace' });
		} else if (/^\p{Script=Han}$/u.test(t)) {
			tokens.push({ text: t, type: 'hanzi' });
		} else if (/^[A-Za-z]/u.test(t)) {
			tokens.push({ text: t, type: 'text' });
		} else {
			tokens.push({ text: t, type: 'punctuation' });
		}
	}
	return tokens;
}

// ── Target — V2: punctuation attaches to adjacent words ──────────────────────

// Matches, in priority order:
//   1. optional leading punct + Latin word + optional trailing punct  (e.g. "simple", programming.)
//   2. single Han character
//   3. whitespace run
//   4. standalone punctuation not adjacent to any word
const COMBINED_RE =
	/[^\p{L}\p{N}\s]*[A-Za-z]+(?:'[A-Za-z]+)*[^\p{L}\p{N}\s]*|\p{Script=Han}|\s+|[^\p{L}\p{N}\s]+/gu;

/**
 * Tokenizes target text with flanking punctuation absorbed into word tokens.
 *
 * `There's nothing "simple" in programming.`
 * → [There's][ ][nothing][ ]["simple"][ ][in][ ][programming.]
 */
export function tokenizeTargetCombined(text: string): RawTargetToken[] {
	const tokens: RawTargetToken[] = [];
	for (const { 0: t } of text.matchAll(COMBINED_RE)) {
		if (/^\s+$/.test(t)) {
			tokens.push({ text: t, type: 'whitespace' });
		} else if (/^\p{Script=Han}$/u.test(t)) {
			tokens.push({ text: t, type: 'hanzi' });
		} else if (/\p{L}/u.test(t)) {
			// contains at least one letter — word token (possibly with attached punct)
			tokens.push({ text: t, type: 'text' });
		} else {
			tokens.push({ text: t, type: 'punctuation' });
		}
	}
	return tokens;
}
