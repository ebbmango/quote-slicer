import { getContext, setContext } from 'svelte';
import { pinyin } from 'pinyin-pro';
import type { SourceToken, TargetToken } from '$lib/tokenize';
import {
	buildTargetText,
	deriveSourceTokenState,
	deriveTargetTokenState,
	type Mapping,
	type MappingId,
	type QuoteExport,
	type QuoteExportMeta,
	type TokenState,
} from '$lib/tokenState';

export type { Mapping, MappingId, QuoteExport, QuoteExportMeta, TokenState };

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

const ALIGNMENT_KEY = Symbol('alignment');

class Alignment {
	activeMappingId: MappingId | null = $state(null);
	private nextColorIndex: number = $state(0);
	private mappings: Mapping[] = $state([]);
	private sourceTokens: SourceToken[] = $state([]);
	private targetTokens: TargetToken[] = $state([]);
	private meta: QuoteExportMeta = $state({ sourceText: '', targetText: '', authorship: '' });

	exportData: QuoteExport = $derived({
		meta: this.meta,
		sourceTokens: this.sourceTokens,
		targetTokens: this.targetTokens,
		mappings: this.mappings.map(({ colorIndex, ...rest }) => rest),
	});

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
		};
	}

	private setSourceTokenPinyin(tokenId: number, value: string | undefined): void {
		const idx = this.sourceIdToIndex.get(tokenId);
		if (idx !== undefined) this.sourceTokens[idx].pinyin = value;
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
			sourceEntries: m.sourceTokenIds.map((tokenId) => {
				const idx = this.sourceIdToIndex.get(tokenId) ?? -1;
				return {
					tokenIndex: idx,
					text: this.sourceTokens[idx]?.text ?? '',
					pinyin: this.sourceTokens[idx]?.pinyin ?? '',
				};
			}),
			targetText: buildTargetText(resolvedTargetIndices, this.targetTokens),
		};
	}

	getMappingView(id: MappingId): MappingView {
		return this.buildMappingView(this.mappings.find((x) => x.id === id)!);
	}

	// Live source tokens carrying pinyin. Pinyin is written into these reactive
	// signals (not into QuoteWorkbench's raw tokenize() output), so split/merge
	// must operate on this array to preserve it — see setSourceTokenPinyin.
	get sourceTokenList(): SourceToken[] {
		return this.sourceTokens;
	}

	setSourceTokens(tokens: SourceToken[]): void {
		this.sourceTokens = tokens;
	}

	setTargetTokens(tokens: TargetToken[]): void {
		this.targetTokens = tokens;
	}

	setMeta(meta: QuoteExportMeta): void {
		this.meta = meta;
	}

	setActive(id: MappingId | null): void {
		this.activeMappingId = id;
	}

	setPinyin(id: MappingId, position: number, value: string): void {
		const m = this.mappings.find((x) => x.id === id);
		const tokenId = m?.sourceTokenIds[position];
		if (tokenId !== undefined) this.setSourceTokenPinyin(tokenId, value);
	}

	findDefaultTokenIndex(zone: 'source' | 'target'): number {
		const tokens = zone === 'source' ? this.sourceTokens : this.targetTokens;
		const isWord = (t: { type: string }) => t.type !== 'whitespace' && t.type !== 'punctuation';
		const getState =
			zone === 'source'
				? (i: number) => this.stateOfSource(i)
				: (i: number) => this.stateOfTarget(i);
		let idx = tokens.findIndex((t, i) => isWord(t) && getState(i).kind === 'unmapped');
		if (idx === -1) idx = tokens.findIndex(isWord);
		return idx;
	}

	// Shared by toggleSource/toggleTarget: if `tokenId` already belongs to a mapping,
	// either remove it (active mapping) or switch the active mapping to it (other mapping).
	// Returns true if either happened, so the caller stops there.
	private tryRemoveOrSwitch(panel: 'source' | 'target', tokenId: number): boolean {
		const key = panel === 'source' ? 'sourceTokenIds' : 'targetTokenIds';
		const claimed = this.mappings.find((m) => m[key].includes(tokenId));
		if (!claimed) return false;
		if (claimed.id === this.activeMappingId) {
			claimed[key] = claimed[key].filter((id) => id !== tokenId);
			if (panel === 'source') this.setSourceTokenPinyin(tokenId, undefined);
			this.pruneActive();
		} else {
			this.activeMappingId = claimed.id;
		}
		return true;
	}

	toggleSource(i: number, opts: { force?: boolean } = {}): void {
		const tokenId = this.sourceTokens[i].id;
		if (this.tryRemoveOrSwitch('source', tokenId)) return;

		const m = this.activeMapping;
		if (m && (opts.force || m.sourceTokenIds.length === 0)) {
			// force-add, or first source slot — add freely
			m.sourceTokenIds = [...m.sourceTokenIds, tokenId];
		} else {
			// active mapping already has a source — create new mapping for this token
			const newM = this.createMapping();
			newM.sourceTokenIds = [tokenId];
			this.mappings = [...this.mappings, newM];
			this.activeMappingId = newM.id;
		}
		this.setSourceTokenPinyin(tokenId, tokenPinyin(this.sourceTokens[i]));
	}

	toggleTarget(i: number): void {
		if (this.targetTokens[i]?.type === 'whitespace') return;
		const tokenId = this.targetTokens[i].id;
		if (this.tryRemoveOrSwitch('target', tokenId)) return;

		if (this.activeMapping) {
			this.activeMapping.targetTokenIds = [...this.activeMapping.targetTokenIds, tokenId];
		} else {
			const m = this.createMapping();
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

	stateOfSource(i: number): TokenState {
		return deriveSourceTokenState(i, this.sourceMappingIndex, this.mappings, this.activeMappingId);
	}

	stateOfTarget(i: number): TokenState {
		return deriveTargetTokenState(
			i,
			this.targetTokens,
			this.targetMappingIndex,
			this.mappings,
			this.activeMappingId
		);
	}
}

export function setAlignmentContext(): Alignment {
	return setContext(ALIGNMENT_KEY, new Alignment());
}

export function getAlignmentContext(): Alignment {
	return getContext<Alignment>(ALIGNMENT_KEY);
}
