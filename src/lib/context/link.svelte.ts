import { getContext, setContext } from 'svelte';
import { pinyin } from 'pinyin-pro';
import type { SourceToken, TargetToken } from '$lib/tokenize';
import {
	buildTargetText,
	deriveSourceTokenState,
	deriveTargetTokenState,
	type Mapping,
	type MappingId,
	type TokenState,
} from '$lib/tokenState';

export type { Mapping, MappingId, TokenState };

export type MappingView = {
	id: MappingId;
	colorIndex: number;
	sourceEntries: { tokenIndex: number; text: string; pinyin: string }[];
	targetText: string;
};

function tokenPinyin(token: SourceToken | undefined): string {
	if (!token || token.type !== 'character') return '';
	const { text } = token;
	return pinyin(text, { toneType: 'symbol', separator: ' ' });
}

const LINK_KEY = Symbol('link');

class LinkContext {
	activeMappingId: MappingId | null = $state(null);
	private nextColorIndex: number = $state(0);
	private mappings: Mapping[] = $state([]);
	private sourceTokens: SourceToken[] = $state([]);
	private targetTokens: TargetToken[] = $state([]);

	// id → current array index; re-derives whenever tokens update (e.g. after split/merge)
	private sourceIdToIndex: Map<number, number> = $derived(
		new Map(this.sourceTokens.map((t, i) => [t.id, i]))
	);
	private targetIdToIndex: Map<number, number> = $derived(
		new Map(this.targetTokens.map((t, i) => [t.id, i]))
	);

	private sortedMappings: Mapping[] = $derived(
		[...this.mappings].sort((a, b) => {
			const pos = (ids: number[], map: Map<number, number>) =>
				ids.length ? Math.min(...ids.map((id) => map.get(id) ?? Infinity)) : Infinity;
			return pos(a.sourceTokenIds, this.sourceIdToIndex) - pos(b.sourceTokenIds, this.sourceIdToIndex);
		})
	);

	sortedMappingViews: MappingView[] = $derived(
		this.sortedMappings.map((m) => this.buildMappingView(m))
	);

	private sourceMappingIndex: Map<number, MappingId> = $derived(
		new Map(
			this.mappings.flatMap((m) =>
				m.sourceTokenIds.flatMap((id) => {
					const idx = this.sourceIdToIndex.get(id);
					return idx !== undefined ? [[idx, m.id] as [number, MappingId]] : [];
				})
			)
		)
	);

	private targetMappingIndex: Map<number, MappingId> = $derived(
		new Map(
			this.mappings.flatMap((m) =>
				m.targetTokenIds.flatMap((id) => {
					const idx = this.targetIdToIndex.get(id);
					return idx !== undefined ? [[idx, m.id] as [number, MappingId]] : [];
				})
			)
		)
	);

	private get activeMapping(): Mapping | undefined {
		return this.mappings.find((m) => m.id === this.activeMappingId);
	}

	private createMapping(): Mapping {
		return {
			id: crypto.randomUUID(),
			colorIndex: this.nextColorIndex++,
			sourceTokenIds: [],
			targetTokenIds: [],
			pinyin: [],
		};
	}

	private pruneActive(): void {
		const m = this.activeMapping;
		if (m && m.sourceTokenIds.length + m.targetTokenIds.length === 0) {
			this.mappings = this.mappings.filter((x) => x.id !== m.id);
			this.activeMappingId = null;
		}
	}

	private buildMappingView(m: Mapping): MappingView {
		const resolvedTargetIndices = m.targetTokenIds
			.map((id) => this.targetIdToIndex.get(id))
			.filter((i): i is number => i !== undefined);
		return {
			id: m.id,
			colorIndex: m.colorIndex,
			sourceEntries: m.sourceTokenIds.map((tokenId, i) => {
				const idx = this.sourceIdToIndex.get(tokenId) ?? -1;
				return {
					tokenIndex: idx,
					text: this.sourceTokens[idx]?.text ?? '',
					pinyin: m.pinyin[i] ?? '',
				};
			}),
			targetText: buildTargetText(resolvedTargetIndices, this.targetTokens),
		};
	}

	getMappingView(id: MappingId): MappingView {
		return this.buildMappingView(this.mappings.find((x) => x.id === id)!);
	}

	setSourceTokens(tokens: SourceToken[]): void {
		this.sourceTokens = tokens;
	}

	setTargetTokens(tokens: TargetToken[]): void {
		this.targetTokens = tokens;
	}

	setActive(id: MappingId | null): void {
		this.activeMappingId = id;
	}

	setPinyin(id: MappingId, position: number, value: string): void {
		const m = this.mappings.find((x) => x.id === id);
		if (m) m.pinyin[position] = value;
	}

	findDefaultTokenIndex(zone: 'source' | 'target'): number {
		const tokens = zone === 'source' ? this.sourceTokens : this.targetTokens;
		const isWord = (t: { type: string }) => t.type !== 'whitespace' && t.type !== 'punctuation';
		const getState =
			zone === 'source'
				? (i: number) => this.getSourceTokenState(i)
				: (i: number) => this.getTargetTokenState(i);
		let idx = tokens.findIndex((t, i) => isWord(t) && getState(i).kind === 'unmapped');
		if (idx === -1) idx = tokens.findIndex(isWord);
		return idx;
	}

	clickSource(i: number, shift = false): void {
		const claimed = this.sourceMappingIndex.get(i);
		if (claimed !== undefined) {
			if (claimed === this.activeMappingId) {
				// remove from active mapping (shift irrelevant here)
				const m = this.activeMapping!;
				const tokenId = this.sourceTokens[i].id;
				const pos = m.sourceTokenIds.indexOf(tokenId);
				m.pinyin = m.pinyin.filter((_, j) => j !== pos);
				m.sourceTokenIds = m.sourceTokenIds.filter((id) => id !== tokenId);
				this.pruneActive();
			} else {
				// switch to that mapping
				this.activeMappingId = claimed;
			}
		} else if (this.activeMappingId !== null) {
			const m = this.activeMapping!;
			if (shift || m.sourceTokenIds.length === 0) {
				// shift = force-add; no sources yet = first source slot, add freely
				const tokenId = this.sourceTokens[i].id;
				m.sourceTokenIds = [...m.sourceTokenIds, tokenId];
				m.pinyin = [...m.pinyin, tokenPinyin(this.sourceTokens[i])];
			} else {
				// mapping already has a source — create new mapping for this token
				const newM = this.createMapping();
				const tokenId = this.sourceTokens[i].id;
				newM.sourceTokenIds = [tokenId];
				newM.pinyin = [tokenPinyin(this.sourceTokens[i])];
				this.mappings = [...this.mappings, newM];
				this.activeMappingId = newM.id;
			}
		} else {
			// create new mapping
			const m = this.createMapping();
			const tokenId = this.sourceTokens[i].id;
			m.sourceTokenIds = [tokenId];
			m.pinyin = [tokenPinyin(this.sourceTokens[i])];
			this.mappings = [...this.mappings, m];
			this.activeMappingId = m.id;
		}
	}

	clickTarget(i: number): void {
		if (this.targetTokens[i]?.type === 'whitespace') return;
		const claimed = this.targetMappingIndex.get(i);
		if (claimed !== undefined) {
			if (claimed === this.activeMappingId) {
				// remove from active mapping
				const m = this.activeMapping!;
				const tokenId = this.targetTokens[i].id;
				m.targetTokenIds = m.targetTokenIds.filter((id) => id !== tokenId);
				this.pruneActive();
			} else {
				// switch to that mapping
				this.activeMappingId = claimed;
			}
		} else if (this.activeMappingId !== null) {
			// add to active mapping
			const tokenId = this.targetTokens[i].id;
			this.activeMapping!.targetTokenIds = [...this.activeMapping!.targetTokenIds, tokenId];
		} else {
			// create new mapping
			const m = this.createMapping();
			const tokenId = this.targetTokens[i].id;
			m.targetTokenIds = [tokenId];
			this.mappings = [...this.mappings, m];
			this.activeMappingId = m.id;
		}
	}

	deselect(): void {
		this.activeMappingId = null;
	}

	deleteActive(): void {
		if (this.activeMappingId === null) return;
		this.mappings = this.mappings.filter((m) => m.id !== this.activeMappingId);
		this.activeMappingId = null;
	}

	deleteById(id: MappingId): void {
		this.mappings = this.mappings.filter((m) => m.id !== id);
		if (this.activeMappingId === id) this.activeMappingId = null;
	}

	getSourceTokenState(i: number): TokenState {
		return deriveSourceTokenState(i, this.sourceMappingIndex, this.mappings, this.activeMappingId);
	}

	getTargetTokenState(i: number): TokenState {
		return deriveTargetTokenState(
			i,
			this.targetTokens,
			this.targetMappingIndex,
			this.mappings,
			this.activeMappingId
		);
	}
}

export function setLinkContext(): LinkContext {
	return setContext(LINK_KEY, new LinkContext());
}

export function getLinkContext(): LinkContext {
	return getContext<LinkContext>(LINK_KEY);
}
