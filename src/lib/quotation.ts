/** Canonical quotation contract, also consumed by Verbarium. */
export type SourceToken = {
	id: number;
	text: string;
	type: 'character' | 'punctuation' | 'number' | 'symbol';
	pinyin?: string | null;
};

export type TargetToken = {
	id: number;
	text: string;
	type: 'text' | 'hanzi' | 'punctuation' | 'whitespace';
};

export type QuoteMapping = {
	id: string;
	sourceTokenIds: number[];
	targetTokenIds: number[];
};

export type AttestationTranslationAlignment = {
	attestation: { tokens: SourceToken[] };
	translation: { tokens: TargetToken[] };
	alignment: {
		mappings: QuoteMapping[];
		breaks: { attestation: number[]; translation: number[] };
	};
};
