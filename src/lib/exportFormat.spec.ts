import { describe, it, expect } from 'vitest';
import { formatExport } from './exportFormat';
import type { QuoteExport } from './tokenState';

const base: QuoteExport = {
	meta: { sourceText: '你好', targetText: 'hello', authorship: 'me' },
	sourceTokens: [
		{ id: 0, text: '你', line: 0, type: 'character', pinyin: 'nǐ' },
		{ id: 1, text: '好', line: 0, type: 'character', pinyin: undefined }
	],
	targetTokens: [
		{ id: 0, text: 'hello', line: 0, type: 'text' },
		{ id: 1, text: ' ', line: 0, type: 'whitespace' }
	],
	mappings: [{ id: 'm1', sourceTokenIds: [0, 1], targetTokenIds: [0] }]
};

describe('formatExport', () => {
	it('keeps primitive id arrays on one line', () => {
		const out = formatExport(base);
		expect(out).toContain('"sourceTokenIds": [0, 1]');
		expect(out).toContain('"targetTokenIds": [0]');
	});

	it('renders unannotated pinyin as literal undefined', () => {
		const out = formatExport(base);
		expect(out).toContain('undefined');
	});

	it('column-aligns token fields across an array', () => {
		const out = formatExport(base);
		const rows = out.split('\n').filter((l) => l.includes('"text"'));
		expect(rows.length).toBeGreaterThan(1);
		// Each token row pads "id" to equal width, so the "text" key starts at the
		// same column on every row.
		const cols = rows.map((r) => r.indexOf('"text"'));
		expect(new Set(cols).size).toBe(1);
	});

	it('omits the pinyin column when no token carries it', () => {
		const out = formatExport(base);
		// targetTokens have no pinyin field → no "pinyin" key in their rows.
		const targetSection = out.slice(out.indexOf('"targetTokens"'));
		expect(targetSection).not.toContain('"pinyin"');
	});

	it('renders empty arrays inline', () => {
		const out = formatExport({ ...base, mappings: [] });
		expect(out).toContain('"mappings": []');
	});
});
