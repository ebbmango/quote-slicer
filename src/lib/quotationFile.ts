import type {
	AttestationTranslationAlignment,
	QuoteMapping,
	SourceToken,
	TargetToken
} from './quotation.ts';

/**
 * The file Verbarium commits for a quotation, as `docs/quotation-contract.md`
 * in ebbmango/verbarium defines it: a format version, the provenance, the
 * source link when there is one, and the export.
 */
export const QUOTATION_FORMAT_VERSION = 1;

export type QuotationFile = AttestationTranslationAlignment & {
	formatVersion: typeof QUOTATION_FORMAT_VERSION;
	provenance: string;
	sourceLink?: string;
};

export type QuotationFileMeta = { provenance: string; sourceLink?: string };

/**
 * Builds the file from the export. JSON has no `undefined`: an unannotated
 * character simply has no `pinyin` key, `null` stays for not applicable, and a
 * blank source link is left out.
 */
export function buildQuotationFile(
	data: AttestationTranslationAlignment,
	meta: QuotationFileMeta
): QuotationFile {
	const sourceLink = meta.sourceLink?.trim();
	return {
		formatVersion: QUOTATION_FORMAT_VERSION,
		provenance: meta.provenance.trim(),
		...(sourceLink ? { sourceLink } : {}),
		attestation: {
			tokens: data.attestation.tokens.map(({ pinyin, ...token }) =>
				pinyin === undefined ? token : { ...token, pinyin }
			)
		},
		translation: { tokens: data.translation.tokens.map((token) => ({ ...token })) },
		alignment: {
			mappings: data.alignment.mappings.map(({ id, sourceTokenIds, targetTokenIds }) => ({
				id,
				sourceTokenIds: [...sourceTokenIds],
				targetTokenIds: [...targetTokenIds]
			})),
			breaks: {
				attestation: [...data.alignment.breaks.attestation],
				translation: [...data.alignment.breaks.translation]
			}
		}
	};
}

/**
 * Writes the file in the layout Verbarium commits, byte for byte: two-space
 * indentation, one token and one mapping per line, number arrays on one line,
 * `id`, `text`, `pinyin`, `type` inside a token, a final newline.
 */
export function formatQuotationFile(file: QuotationFile): string {
	const lines = [
		'{',
		`  "formatVersion": ${file.formatVersion},`,
		`  "provenance": ${JSON.stringify(file.provenance)},`,
		...(file.sourceLink === undefined ? [] : [`  "sourceLink": ${JSON.stringify(file.sourceLink)},`]),
		'  "attestation": {',
		'    "tokens": [',
		...oneObjectPerLine(file.attestation.tokens.map(sourceTokenEntries)),
		'    ]',
		'  },',
		'  "translation": {',
		'    "tokens": [',
		...oneObjectPerLine(file.translation.tokens.map(targetTokenEntries)),
		'    ]',
		'  },',
		'  "alignment": {',
		'    "mappings": [',
		...oneObjectPerLine(file.alignment.mappings.map(mappingEntries)),
		'    ],',
		'    "breaks": {',
		`      "attestation": ${numberArray(file.alignment.breaks.attestation)},`,
		`      "translation": ${numberArray(file.alignment.breaks.translation)}`,
		'    }',
		'  }',
		'}'
	];
	return `${lines.join('\n')}\n`;
}

type Entries = Array<[key: string, json: string]>;

function sourceTokenEntries(token: SourceToken): Entries {
	return [
		['id', String(token.id)],
		['text', JSON.stringify(token.text)],
		...(token.pinyin === undefined ? [] : [['pinyin', JSON.stringify(token.pinyin)] as [string, string]]),
		['type', JSON.stringify(token.type)]
	];
}

function targetTokenEntries(token: TargetToken): Entries {
	return [
		['id', String(token.id)],
		['text', JSON.stringify(token.text)],
		['type', JSON.stringify(token.type)]
	];
}

function mappingEntries(mapping: QuoteMapping): Entries {
	return [
		['id', JSON.stringify(mapping.id)],
		['sourceTokenIds', numberArray(mapping.sourceTokenIds)],
		['targetTokenIds', numberArray(mapping.targetTokenIds)]
	];
}

function numberArray(values: number[]): string {
	return `[${values.join(', ')}]`;
}

function oneObjectPerLine(objects: Entries[]): string[] {
	return objects.map((entries, index) => {
		const body = entries.map(([key, json]) => `"${key}": ${json}`).join(', ');
		return `      { ${body} }${index < objects.length - 1 ? ',' : ''}`;
	});
}
