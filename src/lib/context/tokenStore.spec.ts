import { describe, it, expect } from 'vitest';
import { createTokenStore, type EditScope } from './tokenStore.svelte';
const scope: EditScope = {
	sourceWrapperEl: null,
	targetWrapperEl: null,
	sourceScrollEl: null,
	targetScrollEl: null,
	provenanceEl: null
};
describe('canonical tokens and independent editorial breaks', () => {
	it('split/merge changes only breaks, preserving pinyin and whitespace', () => {
		const store = createTokenStore();
		store.sourceTokens('我爱');
		store.setPinyin(0, 'wo3');
		const source = store.sourceTokens('我爱');
		const target = store.targetTokens('a\nb');
		store.split('source', '我爱', 0, scope);
		expect(store.sourceBreaks('我爱')).toEqual([1]);
		expect(store.targetBreaks('a\nb')).toEqual([2]);
		store.merge('target', 'a\nb', 2, scope);
		expect(store.targetBreaks('a\nb')).toEqual([]);
		expect(store.sourceTokens('我爱')).toEqual(source);
		expect(store.targetTokens('a\nb')).toEqual(target);
		store.merge('source', '我爱', 1, scope);
		expect(store.sourceBreaks('我爱')).toEqual([]);
		expect(store.sourceTokens('我爱')).toEqual(source);
	});
	it('allocates fresh IDs on retokenization and memoizes repeated reads', () => {
		const store = createTokenStore();
		expect(store.sourceTokens('我爱').map((t) => t.id)).toEqual([0, 1]);
		expect(store.sourceTokens('我爱').map((t) => t.id)).toEqual([0, 1]);
		expect(store.sourceTokens('我爱你').map((t) => t.id)).toEqual([2, 3, 4]);
		expect(store.sourceBreaks('我爱你')).toEqual([]);
	});
	it('rejects retokenization after mapping or annotation', () => {
		const store = createTokenStore();
		store.sourceTokens('我');
		store.targetTokens('I');
		store.setPinyin(0, 'wo3');
		expect(() => store.sourceTokens('你')).toThrow(/identity/);
		store.lockText();
		expect(() => store.targetTokens('you')).toThrow(/identity/);
	});
	it('clears pinyin without changing null or lineation', () => {
		const store = createTokenStore();
		store.sourceTokens('我。');
		store.setPinyin(0, 'wo3');
		store.split('source', '我。', 0, scope);
		store.setPinyin(0, undefined);
		expect(store.sourceTokens('我。').map((t) => t.pinyin)).toEqual([undefined, null]);
		expect(store.sourceBreaks('我。')).toEqual([1]);
	});
});

it('normalizes draft text before allocation and preserves mapped IDs through line edits', () => {
	const store = createTokenStore();
	const text = '  hello\nworld  ';
	const tokens = store.targetTokens(text);
	expect(tokens.map((t) => t.text)).toEqual(['hello', ' ', 'world']);
	expect(tokens.map((t) => t.id)).toEqual([0, 1, 2]);
	store.lockText();
	store.merge('target', text, 2, scope);
	expect(store.targetBreaks(text)).toEqual([]);
	store.split('target', text, 1, scope);
	expect(store.targetBreaks(text)).toEqual([2]);
	expect(store.targetTokens(text)).toBe(tokens);
	expect(() => store.targetTokens('hello\nworld')).toThrow(/identity/);
});
