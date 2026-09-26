export function canonicalText(tokens: readonly { text: string }[]): string {
	return tokens.map((token) => token.text).join('');
}

export function validateBreaks(breaks: readonly number[], tokenCount: number): void {
	if (!Number.isSafeInteger(tokenCount) || tokenCount < 0) throw new Error('Invalid token count');
	let previous = 0;
	for (const boundary of breaks) {
		if (!Number.isSafeInteger(boundary) || boundary <= previous || boundary >= tokenCount) {
			throw new Error(
				`Invalid boundary ${boundary} for ${tokenCount} tokens: expected sorted, unique interior positions`
			);
		}
		previous = boundary;
	}
}

/** Explicit normalization for generated positions; imported data must be validated first. */
export function normalizeBreaks(breaks: readonly number[], tokenCount: number): number[] {
	const result = [...new Set(breaks)].sort((a, b) => a - b);
	validateBreaks(result, tokenCount);
	return result;
}

export function editBreak(
	breaks: readonly number[],
	tokenCount: number,
	boundary: number,
	present: boolean
): number[] {
	validateBreaks(breaks, tokenCount);
	validateBreaks([boundary], tokenCount);
	return present
		? normalizeBreaks([...breaks, boundary], tokenCount)
		: breaks.filter((value) => value !== boundary);
}

/** Replace [start,end). Insertion at an existing break requires a side choice. */
export function replaceBreaks(
	breaks: readonly number[],
	tokenCount: number,
	start: number,
	end: number,
	insertedCount: number,
	affinity?: 'before-break' | 'after-break'
): number[] {
	validateBreaks(breaks, tokenCount);
	if (
		![start, end, insertedCount].every(Number.isSafeInteger) ||
		start < 0 ||
		end < start ||
		end > tokenCount ||
		insertedCount < 0
	) {
		throw new Error('Invalid replacement range');
	}
	const insertion = start === end;
	if (insertion && insertedCount > 0 && breaks.includes(start) && !affinity) {
		throw new Error('Insertion at a break requires affinity');
	}
	const newCount = tokenCount + insertedCount - (end - start);
	const positions = breaks.map((b) => {
		if (b < start) return b;
		if (b > end) return b + insertedCount - (end - start);
		if (insertion) return affinity === 'before-break' ? b + insertedCount : b;
		if (b === end) return start + insertedCount;
		if (b === start || insertedCount === 0) return start;
		return -1; // A replacement has no implicit correspondence for an interior break.
	});
	return normalizeBreaks(
		positions.filter((b) => b > 0 && b < newCount),
		newCount
	);
}
