import { getContext, setContext } from 'svelte';
import { pinyin } from 'pinyin-pro';
import type { RawSourceToken, RawTargetToken } from '$lib/tokenize';
import {
	deriveSourceTokenState,
	deriveTargetTokenState,
	type Mapping,
	type MappingId,
	type TokenState,
} from '$lib/tokenState';

export type { Mapping, MappingId, TokenState };

function tokenPinyin(token: RawSourceToken | undefined): string {
	if (!token || token.type !== 'character') return '';
	const { text } = token;
	return pinyin(text, { toneType: 'symbol', separator: ' ' });
}

const LINK_KEY = Symbol('link');

class LinkContext {
	mappings: Mapping[] = $state([]);
	activeMappingId: MappingId | null = $state(null);
	private nextColorIndex: number = $state(0);
	sourceTokens: RawSourceToken[] = $state([]);
	targetTokens: RawTargetToken[] = $state([]);

	// Sorted by first source token position; mappings with no source tokens go last.
	sortedMappings: Mapping[] = $derived(
		[...this.mappings].sort((a, b) => {
			const aMin = a.sourceIndices.length ? Math.min(...a.sourceIndices) : Infinity;
			const bMin = b.sourceIndices.length ? Math.min(...b.sourceIndices) : Infinity;
			return aMin - bMin;
		})
	);

	private sourceMappingIndex: Map<number, MappingId> = $derived(
		new Map(this.mappings.flatMap((m) => m.sourceIndices.map((i) => [i, m.id])))
	);

	private targetMappingIndex: Map<number, MappingId> = $derived(
		new Map(this.mappings.flatMap((m) => m.targetIndices.map((i) => [i, m.id])))
	);

	private get activeMapping(): Mapping | undefined {
		return this.mappings.find((m) => m.id === this.activeMappingId);
	}

	private createMapping(): Mapping {
		return {
			id: crypto.randomUUID(),
			colorIndex: this.nextColorIndex++,
			sourceIndices: [],
			targetIndices: [],
			pinyin: [],
		};
	}

	private pruneActive(): void {
		const m = this.activeMapping;
		if (m && m.sourceIndices.length + m.targetIndices.length === 0) {
			this.mappings = this.mappings.filter((x) => x.id !== m.id);
			this.activeMappingId = null;
		}
	}

	clickSource(i: number, shift = false): void {
		const claimed = this.sourceMappingIndex.get(i);
		if (claimed !== undefined) {
			if (claimed === this.activeMappingId) {
				// remove from active mapping (shift irrelevant here)
				const m = this.activeMapping!;
				const pos = m.sourceIndices.indexOf(i);
				m.pinyin = m.pinyin.filter((_, j) => j !== pos);
				m.sourceIndices = m.sourceIndices.filter((x) => x !== i);
				this.pruneActive();
			} else {
				// switch to that mapping
				this.activeMappingId = claimed;
			}
		} else if (this.activeMappingId !== null) {
			const m = this.activeMapping!;
			if (shift || m.sourceIndices.length === 0) {
				// shift = force-add; no sources yet = first source slot, add freely
				m.sourceIndices = [...m.sourceIndices, i];
				m.pinyin = [...m.pinyin, tokenPinyin(this.sourceTokens[i])];
			} else {
				// mapping already has a source — create new mapping for this token
				const newM = this.createMapping();
				newM.sourceIndices = [i];
				newM.pinyin = [tokenPinyin(this.sourceTokens[i])];
				this.mappings = [...this.mappings, newM];
				this.activeMappingId = newM.id;
			}
		} else {
			// create new mapping
			const m = this.createMapping();
			m.sourceIndices = [i];
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
				m.targetIndices = m.targetIndices.filter((x) => x !== i);
				this.pruneActive();
			} else {
				// switch to that mapping
				this.activeMappingId = claimed;
			}
		} else if (this.activeMappingId !== null) {
			// add to active mapping
			this.activeMapping!.targetIndices = [...this.activeMapping!.targetIndices, i];
		} else {
			// create new mapping
			const m = this.createMapping();
			m.targetIndices = [i];
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
