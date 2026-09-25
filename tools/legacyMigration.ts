import { canonicalText } from '../src/lib/breaks.ts';
import { validateQuotation } from '../src/lib/quotationValidation.ts';
import type {
	AttestationTranslationAlignment,
	SourceToken,
	TargetToken
} from '../src/lib/quotation.ts';

type LegacyToken = (SourceToken | TargetToken) & { line: number };

/** Offline conversion only. Textual discrepancies are reported, never repaired. */
export function migrateQuotation(input: unknown) {
	if (!input || typeof input !== 'object') throw new Error('Expected a quotation object');
	const data = input as Record<string, unknown>;
	let quotation: AttestationTranslationAlignment;
	const warnings: string[] = [];
	const meta = data.meta as Record<string, unknown> | undefined;
	let changed = false;
	function convert(value: unknown, side: string) {
		if (!Array.isArray(value)) throw new Error(`${side}: expected token array`);
		const breaks: number[] = [];
		let previous = 0;
		const tokens = value.map((value, i) => {
			if (!value || typeof value !== 'object') throw new Error(`${side}: invalid token ${i}`);
			const { line, ...token } = value as LegacyToken;
			if (
				!Number.isSafeInteger(line) ||
				line < 0 ||
				(i === 0 && line !== 0) ||
				line < previous ||
				line > previous + 1
			) {
				throw new Error(`${side} token ${i}: non-contiguous legacy line assignment ${line}`);
			}
			if (i > 0 && line !== previous) breaks.push(i);
			previous = line;
			return token;
		});
		return { tokens, breaks };
	}
	if ('attestation' in data) {
		validateQuotation(input);
		quotation = input;
	} else {
		const source = convert(data.sourceTokens, 'attestation');
		const target = convert(data.targetTokens, 'translation');
		quotation = {
			attestation: { tokens: source.tokens as SourceToken[] },
			translation: { tokens: target.tokens as TargetToken[] },
			alignment: {
				mappings: data.mappings as AttestationTranslationAlignment['alignment']['mappings'],
				breaks: { attestation: source.breaks, translation: target.breaks }
			}
		};
		validateQuotation(quotation);
		changed = true;
	}
	const text = {
		attestation: canonicalText(quotation.attestation.tokens),
		translation: canonicalText(quotation.translation.tokens)
	};
	for (const [side, field] of [
		['attestation', 'sourceText'],
		['translation', 'targetText']
	] as const) {
		if (meta && typeof meta[field] === 'string' && meta[field] !== text[side])
			warnings.push(`${side}: metadata differs from canonical token text`);
		if (/^\s|\s$/u.test(text[side]))
			warnings.push(`${side}: leading/trailing textual whitespace retained`);
		if (
			changed &&
			canonicalText(
				data[side === 'attestation' ? 'sourceTokens' : 'targetTokens'] as LegacyToken[]
			) !== text[side]
		)
			throw new Error(`${side}: reconstruction changed`);
	}
	return {
		quotation,
		metadata: meta,
		report: {
			changed,
			text,
			warnings,
			tokenIdsPreserved: true,
			mappingsPreserved: true,
			pinyinPreserved: true
		}
	};
}
