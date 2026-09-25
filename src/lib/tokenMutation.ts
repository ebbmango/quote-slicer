import { canonicalText, replaceBreaks, validateBreaks } from './breaks';
import type { QuoteMapping, SourceToken, TargetToken } from './quotation';

type Token = SourceToken | TargetToken;
type Side = 'sourceTokenIds' | 'targetTokenIds';
export type TokenSequence<T extends Token> = { tokens: T[]; breaks: number[]; nextId: number };

/** nextId is retained across deletions and full replacements; retired IDs are never reused. */
export function replaceTokens<T extends Token, M extends QuoteMapping>(
	sequence: TokenSequence<T>,
	mappings: M[],
	side: Side,
	start: number,
	end: number,
	replacement: Omit<T, 'id'>[],
	options: {
		affinity?: 'before-break' | 'after-break';
		/** Explicit old ID -> replacement indexes. Required for any removed mapped/annotated token. */
		correspondence?: Map<number, number[]>;
	} = {}
): { sequence: TokenSequence<T>; mappings: M[] } {
	const { tokens, breaks, nextId } = sequence;
	const nextBreaks = replaceBreaks(
		breaks,
		tokens.length,
		start,
		end,
		replacement.length,
		options.affinity
	);
	const ids = new Set(tokens.map((t) => t.id));
	if (
		ids.size !== tokens.length ||
		!Number.isSafeInteger(nextId) ||
		nextId < 0 ||
		tokens.some((t) => !Number.isSafeInteger(t.id) || t.id < 0 || t.id >= nextId) ||
		!Number.isSafeInteger(nextId + replacement.length)
	)
		throw new Error('Invalid token ID allocator');
	const removed = tokens.slice(start, end);
	const removedIds = new Set(removed.map((t) => t.id));
	const correspondence = options.correspondence ?? new Map<number, number[]>();
	for (const [id, indexes] of correspondence) {
		if (
			!removedIds.has(id) ||
			new Set(indexes).size !== indexes.length ||
			indexes.some((i) => !Number.isInteger(i) || i < 0 || i >= replacement.length)
		) {
			throw new Error('Invalid token correspondence');
		}
	}
	for (const token of removed) {
		const annotated = 'pinyin' in token && typeof token.pinyin === 'string';
		if (
			(annotated || mappings.some((m) => m[side].includes(token.id))) &&
			!correspondence.has(token.id)
		) {
			throw new Error('Mapped or annotated replacement requires explicit correspondence');
		}
		const targets = correspondence.get(token.id) ?? [];
		if (
			annotated &&
			targets.length > 0 &&
			(targets.length !== 1 ||
				!('pinyin' in replacement[targets[0]]) ||
				(replacement[targets[0]] as Omit<SourceToken, 'id'>).pinyin !== (token as SourceToken).pinyin)
		) {
			throw new Error('Cannot distribute pinyin across replacement tokens');
		}
	}
	const resultTokens = replacement.map((t, index) => ({ ...t, id: nextId + index }) as T);
	const retained = new Set<number>();
	// Preserve the first old identity for a replacement token; one-to-many retains on its first child.
	for (const token of removed) {
		const index = correspondence.get(token.id)?.[0];
		if (index !== undefined && !retained.has(index)) {
			resultTokens[index].id = token.id;
			retained.add(index);
		}
	}
	const nextMappings = mappings
		.map((m) => ({
			...m,
			[side]: [
				...new Set(
					m[side].flatMap((id) => {
						if (!removedIds.has(id)) return [id];
						return (correspondence.get(id) ?? []).map((i) => resultTokens[i].id);
					})
				)
			]
		}))
		.filter((m) => m.sourceTokenIds.length + m.targetTokenIds.length > 0);
	const ownership = new Set<number>();
	for (const m of nextMappings)
		for (const id of m[side]) {
			if (ownership.has(id)) throw new Error('Replacement merges incompatible mappings');
			ownership.add(id);
		}
	return {
		sequence: {
			tokens: [...tokens.slice(0, start), ...resultTokens, ...tokens.slice(end)],
			breaks: nextBreaks,
			nextId: nextId + replacement.length
		},
		mappings: nextMappings
	};
}

export function deleteTokens<T extends Token, M extends QuoteMapping>(
	sequence: TokenSequence<T>,
	mappings: M[],
	side: Side,
	start: number,
	end: number
) {
	return replaceTokens(sequence, mappings, side, start, end, [], {
		correspondence: new Map(sequence.tokens.slice(start, end).map((t) => [t.id, []]))
	});
}

export function splitToken<T extends Token, M extends QuoteMapping>(
	sequence: TokenSequence<T>,
	mappings: M[],
	side: Side,
	index: number,
	parts: Omit<T, 'id'>[]
) {
	const token = sequence.tokens[index];
	if (!token || parts.length < 2 || canonicalText(parts) !== token.text)
		throw new Error('Split must preserve text');
	if (side === 'sourceTokenIds')
		throw new Error('Source character splitting requires an explicit metadata edit');
	return replaceTokens(sequence, mappings, side, index, index + 1, parts, {
		correspondence: new Map([[token.id, parts.map((_, i) => i)]])
	});
}

export function mergeTokens<T extends Token, M extends QuoteMapping>(
	sequence: TokenSequence<T>,
	mappings: M[],
	side: Side,
	start: number,
	end: number,
	replacement: Omit<T, 'id'>
) {
	validateBreaks(sequence.breaks, sequence.tokens.length);
	const removed = sequence.tokens.slice(start, end);
	if (removed.length < 2 || canonicalText(removed) !== replacement.text)
		throw new Error('Merge must preserve text');
	if (side === 'sourceTokenIds')
		throw new Error('Source character merging requires an explicit metadata edit');
	const owners = removed.map((t) => mappings.find((m) => m[side].includes(t.id))?.id);
	if (new Set(owners).size > 1)
		throw new Error('Cannot merge tokens with different mapping ownership');
	return replaceTokens(sequence, mappings, side, start, end, [replacement], {
		correspondence: new Map(removed.map((t) => [t.id, [0]]))
	});
}
