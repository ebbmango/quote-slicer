import { validateBreaks } from './breaks.ts';
import type { AttestationTranslationAlignment } from './quotation.ts';

function record(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error('Expected an object');
	return value as Record<string, unknown>;
}
function array(value: unknown): unknown[] {
	if (!Array.isArray(value)) throw new Error('Expected an array');
	return value;
}

/** Trust-boundary validation; never normalizes or repairs the supplied data. */
export function validateQuotation(
	value: unknown
): asserts value is AttestationTranslationAlignment {
	const quote = record(value);
	const alignment = record(quote.alignment);
	const breaks = record(alignment.breaks);
	const ids: Set<number>[] = [];
	for (const [index, side] of ['attestation', 'translation'].entries()) {
		const tokens = array(record(quote[side]).tokens);
		const seen = new Set<number>();
		const types =
			index === 0
				? ['character', 'punctuation', 'number', 'symbol']
				: ['text', 'hanzi', 'punctuation', 'whitespace'];
		for (const [i, value] of tokens.entries()) {
			const token = record(value);
			if (
				!Number.isSafeInteger(token.id) ||
				(token.id as number) < 0 ||
				seen.has(token.id as number)
			)
				throw new Error(`${side} token ${i}: invalid or duplicate ID`);
			if (
				typeof token.text !== 'string' ||
				token.text.length === 0 ||
				!types.includes(token.type as string)
			)
				throw new Error(`${side} token ${i}: invalid text/type`);
			if ('line' in token) throw new Error(`${side} token ${i}: legacy line state`);
			if (token.pinyin !== undefined && token.pinyin !== null && typeof token.pinyin !== 'string')
				throw new Error(`${side} token ${i}: invalid pinyin`);
			if (index === 1 && 'pinyin' in token)
				throw new Error('Translation tokens cannot carry pinyin');
			seen.add(token.id as number);
		}
		try {
			validateBreaks(array(breaks[side]) as number[], tokens.length);
		} catch (error) {
			throw new Error(`${side} breaks: ${(error as Error).message}`);
		}
		ids.push(seen);
	}
	const mappingIds = new Set<string>();
	const claimed = [new Set<number>(), new Set<number>()];
	for (const value of array(alignment.mappings)) {
		const mapping = record(value);
		if (typeof mapping.id !== 'string' || !mapping.id || mappingIds.has(mapping.id))
			throw new Error('Invalid or duplicate mapping ID');
		mappingIds.add(mapping.id);
		for (const [index, side] of ['sourceTokenIds', 'targetTokenIds'].entries()) {
			for (const id of array(mapping[side])) {
				if (!ids[index].has(id as number))
					throw new Error(`Mapping ${mapping.id}: unresolved ${side} ID ${id}`);
				if (claimed[index].has(id as number))
					throw new Error(`Mapping ${mapping.id}: duplicate ownership of ${side} ID ${id}`);
				claimed[index].add(id as number);
			}
		}
	}
}
