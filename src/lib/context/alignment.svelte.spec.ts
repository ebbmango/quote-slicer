import { describe, expect, it } from 'vitest';
import { Alignment } from './alignment.svelte';
import { tokenizeSource, tokenizeTarget } from '$lib/tokenize';
import { MAPPING_COLORS } from '$lib/constants/colors';
import type { TokenAccess } from '$lib/context/tokenStore.svelte';

// Minimal stand-in for the token store's TokenAccess surface: the real
// tokenizers (ids are deterministic per text) plus a reactive pinyin overlay,
// so Alignment's $derived chains re-run exactly as against the real store.
function makeStore() {
	let overlay = $state(new Map<number, string | undefined>());
	const store: TokenAccess = {
		sourceTokens: (text) =>
			tokenizeSource(text).map((t) =>
				overlay.has(t.id) ? { ...t, pinyin: overlay.get(t.id) } : t
			),
		targetTokens: (text) => tokenizeTarget(text),
		setPinyin: (id, value) => {
			const next = new Map(overlay);
			next.set(id, value);
			overlay = next;
		}
	};
	return { store, pinyinOf: (id: number) => overlay.get(id) };
}

// Source '我爱你' → 我(0) 爱(1) 你(2). Target 'I love you' → I(0) ␣(1) love(2) ␣(3) you(4).
function setup(sourceText = '我爱你', targetText = 'I love you') {
	const { store, pinyinOf } = makeStore();
	const alignment = new Alignment(store);
	alignment.setMeta({ sourceText, targetText, authorship: '' });
	return { alignment, pinyinOf };
}

describe('mapping lifecycle', () => {
	it('clicking an unmapped source token creates an active mapping with auto pinyin', () => {
		const { alignment, pinyinOf } = setup();
		alignment.toggleSource(0);
		expect(alignment.activeMappingId).not.toBeNull();
		expect(alignment.stateOfSource(0)).toEqual({
			kind: 'active',
			color: MAPPING_COLORS[0].light.source
		});
		expect(pinyinOf(0)).toBe('wo3');
		const [view] = alignment.sortedMappingViews;
		expect(view.sourceEntries).toEqual([{ tokenId: 0, tokenIndex: 0, text: '我', pinyin: 'wǒ' }]);
	});

	it("clicking the active mapping's token removes it and prunes the empty mapping", () => {
		const { alignment } = setup();
		alignment.toggleSource(0);
		alignment.toggleSource(0);
		expect(alignment.activeMappingId).toBeNull();
		expect(alignment.sortedMappingViews).toEqual([]);
		expect(alignment.stateOfSource(0)).toEqual({ kind: 'unmapped' });
	});

	it('clicking a token of a non-active mapping switches the active mapping instead of unmapping', () => {
		const { alignment } = setup();
		alignment.toggleSource(0); // mapping A
		alignment.toggleSource(1); // mapping B, now active
		const [a, b] = alignment.sortedMappingViews.map((v) => v.id);
		expect(alignment.activeMappingId).toBe(b);
		alignment.toggleSource(0); // token of A
		expect(alignment.activeMappingId).toBe(a);
		expect(alignment.sortedMappingViews).toHaveLength(2); // nothing removed
	});

	it('a plain second source click starts a new mapping; force extends the active one', () => {
		const { alignment } = setup();
		alignment.toggleSource(0);
		const first = alignment.activeMappingId;
		alignment.toggleSource(1);
		expect(alignment.activeMappingId).not.toBe(first);
		expect(alignment.sortedMappingViews).toHaveLength(2);
		alignment.toggleSource(2, { force: true });
		expect(alignment.sortedMappingViews).toHaveLength(2);
		expect(alignment.sortedMappingViews[1].sourceEntries.map((e) => e.text)).toEqual(['爱', '你']);
	});

	it('target clicks join the active mapping; adjacent runs merge, gaps join with commas', () => {
		const { alignment } = setup();
		alignment.toggleSource(0);
		alignment.toggleTarget(0); // 'I'
		alignment.toggleTarget(4); // 'you' — unmapped 'love' in between blocks bridging
		expect(alignment.sortedMappingViews[0].targetText).toBe('I, you');
		alignment.toggleTarget(2); // 'love' — now contiguous
		expect(alignment.sortedMappingViews[0].targetText).toBe('I love you');
	});

	it('punctuation and whitespace are not selectable', () => {
		const { alignment } = setup('我。', 'I , you');
		alignment.toggleSource(1); // 。
		alignment.toggleTarget(1); // whitespace
		alignment.toggleTarget(2); // standalone comma
		expect(alignment.sortedMappingViews).toEqual([]);
		expect(alignment.activeMappingId).toBeNull();
	});

	it('deleteActive and deleteById remove the mapping and clear the active selection', () => {
		const { alignment } = setup();
		alignment.toggleSource(0);
		const a = alignment.activeMappingId!;
		alignment.toggleSource(1); // B, active
		alignment.deleteActive();
		expect(alignment.sortedMappingViews.map((v) => v.id)).toEqual([a]);
		expect(alignment.activeMappingId).toBeNull();
		alignment.deleteById(a);
		expect(alignment.sortedMappingViews).toEqual([]);
	});

	it('mutations are ignored while the mappings list is animating', () => {
		const { alignment } = setup();
		alignment.toggleSource(0);
		alignment.listAnimating = true;
		alignment.toggleSource(1);
		alignment.toggleTarget(0);
		alignment.deleteActive();
		expect(alignment.sortedMappingViews).toHaveLength(1);
		expect(alignment.activeMappingId).not.toBeNull();
		alignment.listAnimating = false;
		alignment.deleteActive();
		expect(alignment.sortedMappingViews).toEqual([]);
	});
});

describe('derived views and token states', () => {
	it('mappings sort by earliest source token position, target-only mappings last', () => {
		const { alignment } = setup();
		alignment.toggleSource(2); // 你 — created first
		alignment.deselect();
		alignment.toggleTarget(0); // target-only mapping
		alignment.deselect();
		alignment.toggleSource(0); // 我 — created last, sorts first
		const texts = alignment.sortedMappingViews.map((v) => v.sourceEntries[0]?.text ?? null);
		expect(texts).toEqual(['我', '你', null]);
	});

	it('whitespace flanked by the same mapping bridges its color', () => {
		const { alignment } = setup();
		alignment.toggleSource(0);
		alignment.toggleTarget(2); // love
		alignment.toggleTarget(4); // you
		expect(alignment.stateOfTarget(3).kind).toBe('active'); // bridged whitespace
		expect(alignment.stateOfTarget(1).kind).toBe('unmapped'); // 'I' unmapped → no bridge
	});

	it('findDefaultTokenIndex returns the first unmapped word, falling back to the first word', () => {
		const { alignment } = setup();
		expect(alignment.findDefaultTokenIndex('target')).toBe(0);
		alignment.toggleSource(0);
		expect(alignment.findDefaultTokenIndex('source')).toBe(1);
		alignment.toggleSource(1, { force: true });
		alignment.toggleSource(2, { force: true });
		expect(alignment.findDefaultTokenIndex('source')).toBe(0); // all mapped → first word
	});

	it('setPinyin canonicalizes through the store; free text is kept raw; blank clears', () => {
		const { alignment, pinyinOf } = setup();
		// 爱 — tokenId 1 at mapping position 0, so an index-vs-id mixup would show
		alignment.toggleSource(1);
		const id = alignment.activeMappingId!;
		alignment.setPinyin(id, 1, 'ài');
		expect(pinyinOf(1)).toBe('ai4');
		alignment.setPinyin(id, 1, 'note');
		expect(pinyinOf(1)).toBe('note');
		expect(alignment.sortedMappingViews[0].sourceEntries[0].pinyin).toBe('note');
		alignment.setPinyin(id, 1, '   ');
		expect(pinyinOf(1)).toBeUndefined();
	});

	it('setPinyin ignores a tokenId outside the mapping', () => {
		const { alignment, pinyinOf } = setup();
		alignment.toggleSource(1);
		alignment.setPinyin(alignment.activeMappingId!, 0, 'wǒ'); // 我 is unmapped
		expect(pinyinOf(0)).toBeUndefined();
	});
});

describe('export', () => {
	it('flattens line breaks in meta and drops colorIndex from mappings', () => {
		const { alignment } = setup('我爱\n你', 'I love\nyou');
		alignment.toggleSource(0);
		alignment.toggleTarget(0);
		const data = alignment.exportData;
		expect(data.meta).toEqual({ sourceText: '我爱你', targetText: 'I love you', authorship: '' });
		expect(data.mappings).toHaveLength(1);
		expect(data.mappings[0]).not.toHaveProperty('colorIndex');
		expect(data.mappings[0].sourceTokenIds).toEqual([0]);
	});
});

describe('view highlight wiring', () => {
	it('resolves token indices through the live mapping indices', () => {
		const { alignment } = setup();
		alignment.toggleSource(0);
		alignment.toggleTarget(2);
		alignment.highlight.tapSource(0);
		expect(alignment.highlight.isTargetHighlighted(2)).toBe(true);
		expect(alignment.highlight.isSourceHighlighted(1)).toBe(false);
	});
});
