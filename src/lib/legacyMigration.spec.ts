import { expect, it } from 'vitest';
import { migrateQuotation } from '../../tools/legacyMigration';
import { validateQuotation } from './quotationValidation';
import { execFileSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

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

it('converts a real historical TypeScript export deterministically through the offline CLI', () => {
	const args = [
		'--experimental-strip-types',
		'tools/migrate-quotation.ts',
		'tools/fixtures/legacy-dao-one.txt'
	];
	const first = execFileSync(process.execPath, args, { encoding: 'utf8' });
	expect(execFileSync(process.execPath, args, { encoding: 'utf8' })).toBe(first);
	const result = runInNewContext(`(${first})`);
	expect(result.report.changed).toBe(true);
	expect(result.report.warnings).toEqual([]);
	expect(result.quotation.alignment.breaks).toEqual({
		attestation: [10],
		translation: [16, 28, 42]
	});
	expect(result.quotation.alignment.mappings).toHaveLength(14);
	expect(result.quotation.alignment.mappings[0].id).toBe('fb8ab1d6-2171-47c7-99ac-d0101ef8be9e');
	expect(result.metadata.provenance).toBe('Shuowen Jiezi');
	expect(Object.hasOwn(result.quotation.attestation.tokens[0], 'pinyin')).toBe(true);
	expect(result.quotation.attestation.tokens[0].pinyin).toBeUndefined();
	expect(result.quotation.attestation.tokens[4].pinyin).toBeNull();
	expect(Object.hasOwn(result.quotation.translation.tokens[0], 'pinyin')).toBe(false);
	validateQuotation(result.quotation);
});
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
