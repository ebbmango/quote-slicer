import { expect, it } from 'vitest';
import { migrateQuotation } from './legacyMigration';
import { validateQuotation } from './quotationValidation';

const legacy = {
	meta: { sourceText: '道一', targetText: 'The Way. One.', provenance: 'Book' },
	sourceTokens: [
		{ id: 9, text: '道', type: 'character', pinyin: 'dao4', line: 0 },
		{ id: 2, text: '一', type: 'character', pinyin: undefined, line: 1 }
	],
	targetTokens: [
		{ id: 0, text: 'The Way.', type: 'text', line: 0 },
		{ id: 26, text: ' ', type: 'whitespace', line: 0 },
		{ id: 1, text: 'One.', type: 'text', line: 1 }
	],
	mappings: [
		{ id: 'a', sourceTokenIds: [9], targetTokenIds: [0] },
		{ id: 'b', sourceTokenIds: [2], targetTokenIds: [1] }
	]
};
it('converts independently without changing IDs, mappings, text, or optional metadata', () => {
	const result = migrateQuotation(legacy);
	expect(result.quotation.alignment.breaks).toEqual({ attestation: [1], translation: [2] });
	expect(result.quotation.alignment.mappings).toEqual(legacy.mappings);
	expect(result.quotation.attestation.tokens).toEqual(
		legacy.sourceTokens.map(({ line, ...t }) => t)
	);
	expect(result.report.text.translation).toBe('The Way. One.');
	expect(result.report.warnings).toEqual([]);
	expect(migrateQuotation(result.quotation).quotation).toEqual(result.quotation);
	expect(migrateQuotation(result.quotation).report.changed).toBe(false);
});
it('reports content defects without concealing them', () => {
	const bad = structuredClone(legacy);
	bad.targetTokens.splice(1, 1);
	expect(migrateQuotation(bad).report.warnings).toContain(
		'translation: metadata differs from canonical token text'
	);
	expect(migrateQuotation(bad).report.text.translation).toBe('The Way.One.');
	bad.sourceTokens[1].line = 3;
	expect(() => migrateQuotation(bad)).toThrow(/line assignment/);
});
it('rejects invalid identities, mapping ownership, endpoints, and line-bearing target data', () => {
	const good = migrateQuotation(legacy).quotation;
	for (const mutate of [
		(q: typeof good) => {
			q.attestation.tokens[1].id = 9;
		},
		(q: typeof good) => {
			q.alignment.mappings[0].sourceTokenIds = [123];
		},
		(q: typeof good) => {
			q.alignment.mappings[1].sourceTokenIds = [9];
		},
		(q: typeof good) => {
			q.alignment.breaks.translation = [0];
		},
		(q: typeof good) => {
			Object.assign(q.attestation.tokens[0], { line: 0 });
		}
	]) {
		const bad = structuredClone(good);
		mutate(bad);
		expect(() => validateQuotation(bad)).toThrow();
	}
});
