export function splitAfterToken<T extends { line: number }>(tokens: T[], afterIndex: number): T[] {
	const splitLine = tokens[afterIndex].line;
	return tokens.map((token, i) => {
		if (token.line > splitLine) return { ...token, line: token.line + 1 };
		if (i > afterIndex && token.line === splitLine) return { ...token, line: splitLine + 1 };
		return token;
	});
}

export function mergeLines<T extends { line: number }>(tokens: T[], lineN: number): T[] {
	return tokens.map((token) => {
		if (token.line === lineN + 1) return { ...token, line: lineN };
		if (token.line > lineN + 1) return { ...token, line: token.line - 1 };
		return token;
	});
}

export function groupByLine<T extends { line: number }>(
	tokens: T[]
): { lineNum: number; group: { token: T; globalIndex: number }[] }[] {
	const map = new Map<number, { token: T; globalIndex: number }[]>();
	tokens.forEach((token, i) => {
		const arr = map.get(token.line) ?? [];
		arr.push({ token, globalIndex: i });
		map.set(token.line, arr);
	});
	return [...map.entries()]
		.sort(([a], [b]) => a - b)
		.map(([lineNum, group]) => ({ lineNum, group }));
}
