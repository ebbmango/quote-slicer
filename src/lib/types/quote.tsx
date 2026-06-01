// Since we start with a form-like object, we will begin by having two full texts:
// a quote and a translation.

// The decision to call it source and target as opposed to original and translation
// is because of the direction of interaction.

export type Quote = {
	sourceTokens: SourceToken[]; // original
	targetTokens: TargetToken[]; // translation
	alignments: Alignment[];
};

//// Source Text

type TokenBase = {
	id: number;
	line: number;
	text: string;
};

export type SourceToken =
	| (TokenBase & {
			type: 'punctuation' | 'number' | 'symbol';
	  })
	| (TokenBase & {
			type: 'character';
			transliteration: Transliteration;
	  });

export type Transliteration = {
	system: 'pinyin' | 'wade-giles' | 'zhuyin' | 'jyutping';
	text: string;
};

//// Target Text

export type TargetToken = TokenBase & {
	type: 'text' | 'hanzi' | 'punctuation' | 'whitespace';
};

// Whitespace is necessary:
// - For UX, since it allows the user to copy the text.
// - For rendering, since the correct spacing around punctuation is not easily automated.

export function isMappable(token: TargetToken): boolean {
	return token.type === 'text'; // Should hanzi be mappable, or is it self-evident?
}

export type Alignment = {
	id: number;
	sourceTokenIds: number[];
	targetTokenIds: number[];
};

//// MISC. (maybe later)

export type Language =
	| 'zh' //        Chinese, unspecified script
	| 'zh-Hans' //   Chinese, Simplified Han
	| 'zh-Hant' //   Chinese, Traditional Han
	| 'lzh-Hani' //  Literary Chinese / Classical Chinese, Han script
	| 'en'; //       English
