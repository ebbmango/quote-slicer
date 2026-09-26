import { parseTarget } from './tokenize';
import { expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';
import { formatExport } from './exportFormat';
import type { QuoteExport } from './tokenState';
const base: QuoteExport = {
	attestation: {
		tokens: [
			{ id: 0, text: '你', type: 'character', pinyin: 'ni3' },
			{ id: 1, text: '好', type: 'character', pinyin: undefined },
			{ id: 2, text: '。', type: 'punctuation', pinyin: null }
		]
	},
	translation: { tokens: [{ id: 0, text: 'hello', type: 'text' }] },
	alignment: {
		mappings: [{ id: 'm1', sourceTokenIds: [0, 1], targetTokenIds: [0] }],
		breaks: { attestation: [], translation: [] }
	}
};
it('formats the directly consumable quotation contract', () => {
	const out = formatExport(base);
	expect(out).toContain('"attestation": {');
	expect(out).toContain('"sourceTokenIds": [0, 1]');
	expect(out).toContain('"breaks": {');
	expect(out).not.toContain('"line":');
	expect(out).not.toContain('"meta":');
	expect(out).toContain('undefined');
	expect(out).toContain('null');
	const rows = out.split('\n').filter((l) => l.includes('"text"'));
	expect(new Set(rows.map((r) => r.indexOf('"text"'))).size).toBe(1);
	expect(out.slice(out.indexOf('"translation": {'))).not.toContain('"pinyin"');
});
it('preserves omitted, undefined, null and string pinyin independently', () => {
	const quote = structuredClone(base);
	quote.attestation.tokens.push({ id: 3, text: '一', type: 'character' });
	const restored = runInNewContext(`(${formatExport(quote)})`);
	expect(structuredClone(restored)).toStrictEqual(quote);
	expect(Object.hasOwn(restored.attestation.tokens[1], 'pinyin')).toBe(true);
	expect(Object.hasOwn(restored.attestation.tokens[3], 'pinyin')).toBe(false);
});

it.each([
	['hello ', 'hello'],
	[' hello', 'hello'],
	['  hello  ', 'hello'],
	['hello world', 'hello world'],
	[' hello\nworld ', 'hello world'],
	[' hello  \n  world ', 'hello     world']
])(
	'exports canonical target text without independent string sanitization: %j',
	(raw, canonical) => {
		const parsed = parseTarget(raw);
		const quote: QuoteExport = {
			...base,
			translation: { tokens: parsed.tokens },
			alignment: { mappings: [], breaks: { attestation: [], translation: parsed.breaks } }
		};
		const restored = runInNewContext(`(${formatExport(quote)})`) as QuoteExport;
		expect(restored.translation.tokens.map((t) => t.text).join('')).toBe(canonical);
		expect(structuredClone(restored)).toStrictEqual(quote);
	}
);
