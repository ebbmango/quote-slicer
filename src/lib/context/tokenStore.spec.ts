import { describe, it, expect } from 'vitest';
import { createTokenStore, type EditScope } from './tokenStore.svelte';

// Runs in the server project (node): there onMount is a no-op, so createTokenStore
// works outside component init and gsap never loads — animate() falls through to a
// plain sync mutate. The store has no $derived, so the server-compiled $state
// (plain variables) is fine for these direct-call tests.

// No DOM to animate against — split/merge only exercise the cache write.
const scope: EditScope = {
	sourceWrapperEl: null,
	targetWrapperEl: null,
	sourceScrollEl: null,
	targetScrollEl: null,
	authEl: null
};

const linesOf = (tokens: { line: number }[]) => tokens.map((t) => t.line);

describe('token cache', () => {
	it('tokenizes fresh text when the cache is empty', () => {
		const store = createTokenStore();
		expect(store.sourceTokens('我爱').map((t) => t.text)).toEqual(['我', '爱']);
	});

	it('split writes a text-keyed cache that survives re-reads, ids stable', () => {
		const store = createTokenStore();
		const text = '我爱';
		store.split('source', text, store.sourceTokens(text), 0, scope);
		const after = store.sourceTokens(text);
		expect(linesOf(after)).toEqual([0, 1]);
		expect(after.map((t) => t.id)).toEqual([0, 1]);
	});

	it('a text change invalidates the cache and retokenizes', () => {
		const store = createTokenStore();
		store.split('source', '我爱', store.sourceTokens('我爱'), 0, scope);
		expect(linesOf(store.sourceTokens('我爱你'))).toEqual([0, 0, 0]);
	});

	it('merge collapses the split back through the same cache', () => {
		const store = createTokenStore();
		const text = '我爱';
		store.split('source', text, store.sourceTokens(text), 0, scope);
		store.merge('source', text, store.sourceTokens(text), 0, scope);
		expect(linesOf(store.sourceTokens(text))).toEqual([0, 0]);
	});

	it('target tokens use their own cache', () => {
		const store = createTokenStore();
		const text = 'a b';
		store.split('target', text, store.targetTokens(text), 0, scope);
		expect(linesOf(store.targetTokens(text))).toEqual([0, 1, 1]);
		expect(linesOf(store.targetTokens('a b c'))).toEqual([0, 0, 0, 0, 0]);
	});
});

describe('pinyin overlay', () => {
	it('setPinyin overlays by stable id on every read', () => {
		const store = createTokenStore();
		store.setPinyin(0, 'wo3');
		const tokens = store.sourceTokens('我爱');
		expect(tokens[0].pinyin).toBe('wo3');
		expect(tokens[1].pinyin).toBeUndefined();
	});

	it('survives a cache rewrite (split) without re-annotating', () => {
		const store = createTokenStore();
		const text = '我爱';
		store.setPinyin(0, 'wo3');
		store.split('source', text, store.sourceTokens(text), 0, scope);
		expect(store.sourceTokens(text)[0].pinyin).toBe('wo3');
	});

	it('clearing pinyin wins over a stale value baked into the cache', () => {
		const store = createTokenStore();
		const text = '我。';
		store.setPinyin(0, 'wo3');
		// Bake the annotated tokens into the cache via a split...
		store.split('source', text, store.sourceTokens(text), 0, scope);
		// ...then clear: the overlay must override the cached 'wo3'.
		store.setPinyin(0, undefined);
		const [char, punct] = store.sourceTokens(text);
		expect(char.pinyin).toBeUndefined();
		expect(punct.pinyin).toBeNull(); // not-applicable stays null
	});
});
