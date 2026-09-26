import { expect, it } from 'vitest';
import {
	deleteTokens,
	mergeTokens,
	replaceTokens,
	splitToken,
	type TokenSequence
} from './tokenMutation';
import type { QuoteMapping, TargetToken, SourceToken } from './quotation';
import { canonicalText } from './breaks';

const sequence: TokenSequence<TargetToken> = {
	tokens: [
		{ id: 9, text: 'well-known', type: 'text' },
		{ id: 2, text: ' ', type: 'whitespace' },
		{ id: 12, text: 'word.', type: 'text' }
	],
	breaks: [1, 2],
	nextId: 20
};
const mappings: QuoteMapping[] = [{ id: 'a', sourceTokenIds: [1], targetTokenIds: [9] }];

it('splits and merges mapped tokens with stable identities and unchanged text', () => {
	const split = splitToken(sequence, mappings, 'targetTokenIds', 0, [
		{ text: 'well', type: 'text' },
		{ text: '-', type: 'punctuation' },
		{ text: 'known', type: 'text' }
	]);
	expect(split.sequence.tokens.map((t) => t.id)).toEqual([9, 21, 22, 2, 12]);
	expect(split.sequence.breaks).toEqual([3, 4]);
	expect(split.mappings[0].targetTokenIds).toEqual([9, 21, 22]);
	const merged = mergeTokens(split.sequence, split.mappings, 'targetTokenIds', 0, 3, {
		text: 'well-known',
		type: 'text'
	});
	expect(merged.sequence.tokens).toEqual(sequence.tokens);
	expect(merged.sequence.breaks).toEqual(sequence.breaks);
	expect(merged.mappings).toEqual(mappings);
	expect(canonicalText(split.sequence.tokens)).toBe(canonicalText(sequence.tokens));
});

it('removes deleted memberships, preserves mapping IDs, and never reuses retired IDs', () => {
	const deleted = deleteTokens(sequence, mappings, 'targetTokenIds', 0, 1);
	expect(deleted.mappings).toEqual([{ id: 'a', sourceTokenIds: [1], targetTokenIds: [] }]);
	expect(deleted.sequence.breaks).toEqual([1]);
	const inserted = replaceTokens(deleted.sequence, deleted.mappings, 'targetTokenIds', 0, 0, [
		{ text: 'new', type: 'text' }
	]);
	expect(inserted.sequence.tokens[0].id).toBe(20);
	expect(inserted.sequence.breaks).toEqual([2]);
	expect(
		deleteTokens(sequence, [{ ...mappings[0], sourceTokenIds: [] }], 'targetTokenIds', 0, 1)
			.mappings
	).toEqual([]);
});

it('merges across a boundary explicitly and rejects incompatible ownership', () => {
	const merged = mergeTokens(sequence, [], 'targetTokenIds', 0, 2, {
		text: 'well-known ',
		type: 'text'
	});
	expect(merged.sequence.breaks).toEqual([1]);
	expect(merged.sequence.tokens[0].id).toBe(9);
	expect(() =>
		mergeTokens(sequence, mappings, 'targetTokenIds', 0, 2, { text: 'well-known ', type: 'text' })
	).toThrow(/ownership/);
	expect(() =>
		replaceTokens(sequence, mappings, 'targetTokenIds', 0, 3, [
			{ text: 'replacement', type: 'text' }
		])
	).toThrow(/correspondence/);
});

it('rejects ambiguous identity, invalid allocators, and source metadata distribution', () => {
	expect(() => replaceTokens({ ...sequence, nextId: 12 }, [], 'targetTokenIds', 0, 0, [])).toThrow(
		/allocator/
	);
	expect(() =>
		replaceTokens(sequence, mappings, 'targetTokenIds', 0, 1, [], {
			correspondence: new Map([[9, [0]]])
		})
	).toThrow(/correspondence/);
	const source: TokenSequence<SourceToken> = {
		tokens: [{ id: 4, text: '道', type: 'character', pinyin: 'dao4' }],
		breaks: [],
		nextId: 5
	};
	expect(() =>
		replaceTokens(source, [], 'sourceTokenIds', 0, 1, [{ text: '人', type: 'character' }])
	).toThrow(/correspondence/);
	expect(() =>
		replaceTokens(source, [], 'sourceTokenIds', 0, 1, [{ text: '人', type: 'character' }], {
			correspondence: new Map([[4, [0]]])
		})
	).toThrow(/pinyin/);
	expect(deleteTokens(source, [], 'sourceTokenIds', 0, 1).sequence.tokens).toEqual([]);
});
