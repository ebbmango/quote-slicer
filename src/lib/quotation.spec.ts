import { expect, it } from 'vitest';
import type { AttestationTranslationAlignment } from './quotation';

it('represents independent lineation with opaque IDs and canonical whitespace', () => {
	const quote = {
		attestation: {
			tokens: [
				{ id: 8, text: '道', type: 'character', pinyin: 'dao4' },
				{ id: 2, text: '。', type: 'punctuation', pinyin: null }
			]
		},
		translation: {
			tokens: [
				{ id: 10, text: 'The', type: 'text' },
				{ id: 1, text: ' ', type: 'whitespace' },
				{ id: 5, text: 'Way.', type: 'text' }
			]
		},
		alignment: {
			mappings: [{ id: 'mapping', sourceTokenIds: [8], targetTokenIds: [10, 5] }],
			breaks: { attestation: [], translation: [2] }
		}
	} satisfies AttestationTranslationAlignment;
	expect(quote.translation.tokens.map((t) => t.text).join('')).toBe('The Way.');
	expect(quote.alignment.breaks.translation[0]).not.toBe(quote.translation.tokens[2].id);
});
