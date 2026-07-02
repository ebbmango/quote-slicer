import { getContext, setContext } from 'svelte';
import { pinyin } from 'pinyin-pro';
import { toCanonical, toDisplay } from '$lib/pinyinConvert';
import type { SourceToken, TargetToken } from '$lib/tokenize';
import type { TokenAccess } from '$lib/context/tokenStore.svelte';
import {
	buildMappingIndex,
	buildTargetText,
	deriveSourceTokenState,
	deriveTargetTokenState,
	type Mapping,
	type MappingId,
	type QuoteExport,
	type QuoteExportMeta,
	type TokenState
} from '$lib/tokenState';
import { theme as appTheme } from '$lib/theme';
import { ViewHighlight } from './viewHighlight.svelte';

export type { Mapping, MappingId, QuoteExport, QuoteExportMeta, TokenState };

export type MappingView = {
	id: MappingId;
	colorIndex: number;
	sourceEntries: { tokenId: number; tokenIndex: number; text: string; pinyin: string }[];
	targetText: string;
};

function tokenPinyin(token: SourceToken | undefined): string {
	if (!token || token.type !== 'character') return '';
	const { text } = token;
	return pinyin(text, { toneType: 'num' });
}

const ALIGNMENT_KEY = Symbol('alignment');

export class Alignment {
	activeMappingId: MappingId | null = $state(null);
	// True while the MappingsList panel is animating (card entering or exiting). Written
	// by MappingsList via $effect when it is mounted; false when the panel is hidden/unmounted.
	// Checked by toggleSource/toggleTarget/delete* to throttle mutations during animation.
	listAnimating: boolean = $state(false);
	private mappings: Mapping[] = $state([]);
	private meta: QuoteExportMeta = $state({ sourceText: '', targetText: '', authorship: '' });

	// The token store is the single owner of the token arrays (with pinyin and the
	// split/merge cache). Alignment reads them as live derivations of the store
	// keyed by the current text — it no longer holds its own copy to keep in sync.
	// The view-mode hover/tap highlight machine. Exposed directly (callers use
	// `alignment.highlight.hoverSource(i)` etc.) — it's a CONTEXT.md term in its own
	// right, so re-wrapping its whole surface in pass-through forwarders earned nothing.
	readonly highlight: ViewHighlight;

	constructor(private store: TokenAccess) {
		this.highlight = new ViewHighlight((zone, i) => {
			const m = zone === 'source' ? this.sourceMappingIndex.get(i) : this.targetMappingIndex.get(i);
			return m?.id ?? null;
		});
	}

	private sourceTokens: SourceToken[] = $derived.by(() =>
		this.store.sourceTokens(this.meta.sourceText)
	);
	private targetTokens: TargetToken[] = $derived.by(() =>
		this.store.targetTokens(this.meta.targetText)
	);

	// Diacritic pinyin for display, parallel to `sourceTokens`. Memoized here so
	// `toDisplay()` (regex + pinyin-pro convert) only re-runs when the tokens
	// themselves change — not on every `sortedMappingViews` recompute, which fires
	// on broad mapping add/remove/select churn unrelated to pinyin.
	private sourceDisplayPinyin: string[] = $derived(
		this.sourceTokens.map((t) => toDisplay(t.pinyin ?? ''))
	);

	exportData: QuoteExport = $derived({
		meta: {
			sourceText: this.meta.sourceText.replace(/\n+/g, ''),
			targetText: this.meta.targetText.replace(/\n+/g, ' ').trim(),
			authorship: this.meta.authorship.replace(/\n+/g, ' ').trim()
		},
		sourceTokens: this.sourceTokens,
		targetTokens: this.targetTokens,
		mappings: this.mappings.map(({ colorIndex, ...rest }) => rest)
	});

	// id → current array index; re-derives whenever tokens update (e.g. after split/merge)
	private sourceIdToIndex: Map<number, number> = $derived(
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built fresh per recompute, never mutated
		new Map(this.sourceTokens.map((t, i) => [t.id, i]))
	);
	private targetIdToIndex: Map<number, number> = $derived(
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built fresh per recompute, never mutated
		new Map(this.targetTokens.map((t, i) => [t.id, i]))
	);

	private sortedMappings: Mapping[] = $derived(
		[...this.mappings].sort((a, b) => {
			const pos = (ids: number[], map: Map<number, number>) =>
				ids.length ? Math.min(...ids.map((id) => map.get(id) ?? Infinity)) : Infinity;
			return (
				pos(a.sourceTokenIds, this.sourceIdToIndex) - pos(b.sourceTokenIds, this.sourceIdToIndex)
			);
		})
	);

	sortedMappingViews: MappingView[] = $derived(
		this.sortedMappings.map((m) => this.buildMappingView(m))
	);

	private sourceMappingIndex: Map<number, Mapping> = $derived(
		buildMappingIndex(this.mappings, this.sourceIdToIndex, (m) => m.sourceTokenIds)
	);

	private targetMappingIndex: Map<number, Mapping> = $derived(
		buildMappingIndex(this.mappings, this.targetIdToIndex, (m) => m.targetTokenIds)
	);

	private get activeMapping(): Mapping | undefined {
		return this.mappings.find((m) => m.id === this.activeMappingId);
	}

	private createMapping(): Mapping {
		// Lowest free palette slot, so deleting a mapping releases its color for reuse.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built fresh per call, never mutated
		const used = new Set(this.mappings.map((m) => m.colorIndex));
		let colorIndex = 0;
		while (used.has(colorIndex)) colorIndex++;
		return {
			id: crypto.randomUUID(),
			colorIndex,
			sourceTokenIds: [],
			targetTokenIds: []
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
			sourceEntries: m.sourceTokenIds.map((tokenId) => {
				const idx = this.sourceIdToIndex.get(tokenId) ?? -1;
				return {
					tokenId,
					tokenIndex: idx,
					text: this.sourceTokens[idx]?.text ?? '',
					pinyin: this.sourceDisplayPinyin[idx] ?? ''
				};
			}),
			targetText: buildTargetText(resolvedTargetIndices, this.targetTokens)
		};
	}

	setMeta(meta: QuoteExportMeta): void {
		this.meta = meta;
	}

	setActive(id: MappingId | null): void {
		this.activeMappingId = id;
	}

	// `value` is the raw text the user typed (diacritic or numbered); the store
	// owns the canonicalization so the conversion lives here, not in the UI
	// component (single token owner — see docs/token-store.md). Unparseable text
	// is stored as-is, preserving free-text notes. Blank input clears the
	// annotation back to `undefined` so export omits it (vs. an empty string).
	// A `tokenId` not in the mapping's `sourceTokenIds` is ignored.
	setPinyin(id: MappingId, tokenId: number, value: string): void {
		const m = this.mappings.find((x) => x.id === id);
		if (!m?.sourceTokenIds.includes(tokenId)) return;
		const trimmed = value.trim();
		this.store.setPinyin(tokenId, trimmed ? (toCanonical(trimmed) ?? trimmed) : undefined);
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
			if (panel === 'source') this.store.setPinyin(tokenId, undefined);
			this.pruneActive();
		} else {
			this.activeMappingId = claimed.id;
		}
		return true;
	}

	toggleSource(i: number, opts: { force?: boolean } = {}): void {
		if (this.listAnimating) return;
		const type = this.sourceTokens[i]?.type;
		// Source tokens are never whitespace (only target streams carry whitespace);
		// punctuation can't anchor a mapping.
		if (type === 'punctuation') return;
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
		this.store.setPinyin(tokenId, tokenPinyin(this.sourceTokens[i]));
	}

	toggleTarget(i: number): void {
		if (this.listAnimating) return;
		const type = this.targetTokens[i]?.type;
		if (type === 'whitespace' || type === 'punctuation') return;
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
		if (this.listAnimating) return;
		if (this.activeMappingId === null) return;
		this.mappings = this.mappings.filter((m) => m.id !== this.activeMappingId);
		this.activeMappingId = null;
	}

	deleteById(id: MappingId): void {
		if (this.listAnimating) return;
		this.mappings = this.mappings.filter((m) => m.id !== id);
		if (this.activeMappingId === id) this.activeMappingId = null;
	}

	stateOfSource(i: number): TokenState {
		return deriveSourceTokenState(
			i,
			this.sourceMappingIndex,
			this.activeMappingId,
			appTheme.current
		);
	}

	stateOfTarget(i: number): TokenState {
		return deriveTargetTokenState(
			i,
			this.targetTokens,
			this.targetMappingIndex,
			this.activeMappingId,
			appTheme.current
		);
	}
}

export function setAlignmentContext(store: TokenAccess): Alignment {
	return setContext(ALIGNMENT_KEY, new Alignment(store));
}

export function getAlignmentContext(): Alignment {
	return getContext<Alignment>(ALIGNMENT_KEY);
}
