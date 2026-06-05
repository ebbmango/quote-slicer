import { getContext, setContext } from 'svelte';
import { MAPPING_COLORS, type MappingColor } from '$lib/constants/colors';
import type { RawSourceToken, RawTargetToken } from '$lib/tokenize';

export type MappingId = string;

export type Mapping = {
	id: MappingId;
	sourceIndices: number[];
	targetIndices: number[];
	pinyin: string[]; // parallel to sourceIndices
};

export type TokenState =
	| { kind: 'unmapped' }
	| { kind: 'idle'; color: string }
	| { kind: 'active'; color: string };

const LINK_KEY = Symbol('link');

class LinkContext {
	mappings: Mapping[] = $state([]);
	activeMappingId: MappingId | null = $state(null);
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

	private colorFor(m: Mapping): MappingColor {
		const idx = this.sortedMappings.indexOf(m);
		return MAPPING_COLORS[(idx >= 0 ? idx : 0) % MAPPING_COLORS.length];
	}

	private createMapping(): Mapping {
		return {
			id: crypto.randomUUID(),
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
				m.pinyin = [...m.pinyin, ''];
			} else {
				// mapping already has a source — create new mapping for this token
				const newM = this.createMapping();
				newM.sourceIndices = [i];
				newM.pinyin = [''];
				this.mappings = [...this.mappings, newM];
				this.activeMappingId = newM.id;
			}
		} else {
			// create new mapping
			const m = this.createMapping();
			m.sourceIndices = [i];
			m.pinyin = [''];
			this.mappings = [...this.mappings, m];
			this.activeMappingId = m.id;
		}
	}

	clickTarget(i: number): void {
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

	getSourceTokenState(i: number): TokenState {
		const claimed = this.sourceMappingIndex.get(i);
		if (claimed === undefined) return { kind: 'unmapped' };
		const m = this.mappings.find((x) => x.id === claimed)!;
		const color = this.colorFor(m).source;
		if (claimed === this.activeMappingId) return { kind: 'active', color };
		return { kind: 'idle', color };
	}

	getTargetTokenState(i: number): TokenState {
		const claimed = this.targetMappingIndex.get(i);
		if (claimed === undefined) return { kind: 'unmapped' };
		const m = this.mappings.find((x) => x.id === claimed)!;
		const color = this.colorFor(m).target;
		if (claimed === this.activeMappingId) return { kind: 'active', color };
		return { kind: 'idle', color };
	}
}

export function setLinkContext(): LinkContext {
	return setContext(LINK_KEY, new LinkContext());
}

export function getLinkContext(): LinkContext {
	return getContext<LinkContext>(LINK_KEY);
}
