import { getContext, setContext } from 'svelte';
import { pinyin } from 'pinyin-pro';
import { toCanonical, toDisplay } from '$lib/pinyinConvert';
import type { SourceToken, TargetToken } from '$lib/tokenize';
import type { TokenAccess } from '$lib/animation/tokenStore.svelte';
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
import { theme as appTheme } from '$lib/theme';

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

// View-mode hover-highlight timing (ms). `COLD` is the wait before a mapping
// lights up when nothing was lit; `WARM` is the shorter wait when re-entering a
// mapping within `GRACE` ms of the previous highlight clearing. The delay stops
// the whole text flickering as the pointer glides across tokens; clearing is
// always immediate (the CSS color transition makes the fade-out gradual).
const HL_COLD_DELAY = 500;
const HL_WARM_DELAY = 300;
const HL_WARMTH_GRACE = 500;

export class Alignment {
	activeMappingId: MappingId | null = $state(null);
	// True while the MappingsList panel is animating (card entering or exiting). Written
	// by MappingsList via $effect when it is mounted; false when the panel is hidden/unmounted.
	// Checked by toggleSource/toggleTarget/delete* to throttle mutations during animation.
	listAnimating: boolean = $state(false);
	private nextColorIndex: number = $state(0);
	private mappings: Mapping[] = $state([]);
	private meta: QuoteExportMeta = $state({ sourceText: '', targetText: '', authorship: '' });

	// The token store is the single owner of the token arrays (with pinyin and the
	// split/merge cache). Alignment reads them as live derivations of the store
	// keyed by the current text — it no longer holds its own copy to keep in sync.
	constructor(private store: TokenAccess) {}

	private sourceTokens: SourceToken[] = $derived.by(() => this.store.sourceTokens(this.meta.sourceText));
	private targetTokens: TargetToken[] = $derived.by(() => this.store.targetTokens(this.meta.targetText));

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
			authorship: this.meta.authorship.replace(/\n+/g, ' ').trim(),
		},
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
					pinyin: this.sourceDisplayPinyin[idx] ?? '',
				};
			}),
			targetText: buildTargetText(resolvedTargetIndices, this.targetTokens),
		};
	}

	getMappingView(id: MappingId): MappingView {
		return this.buildMappingView(this.mappings.find((x) => x.id === id)!);
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
	//
	// `position` indexes into `sourceTokenIds`. This could instead take the stable
	// `tokenId` directly (more robust against reorder/split/merge) — if pinyin
	// edits ever commit to the wrong token, look here first.
	setPinyin(id: MappingId, position: number, value: string): void {
		const m = this.mappings.find((x) => x.id === id);
		const tokenId = m?.sourceTokenIds[position];
		if (tokenId === undefined) return;
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
		return deriveSourceTokenState(i, this.sourceMappingIndex, this.mappings, this.activeMappingId, appTheme.current);
	}

	stateOfTarget(i: number): TokenState {
		return deriveTargetTokenState(
			i,
			this.targetTokens,
			this.targetMappingIndex,
			this.mappings,
			this.activeMappingId,
			appTheme.current
		);
	}

	// ── View-mode hover highlight ──────────────────────────────────────────────
	// `hoveredMappingId` is the mapping currently lit; both panels read it via
	// `isSourceHighlighted` / `isTargetHighlighted`. `pointerMapping` is the
	// mapping under the pointer right now (may differ while a light-up timer is
	// pending). `warm` is the grace flag — true while lit and for `HL_WARMTH_GRACE`
	// ms after clearing — which selects the shorter `HL_WARM_DELAY`.
	hoveredMappingId: MappingId | null = $state(null);
	private pointerMapping: MappingId | null = null;
	private warm = false;
	private lightTimer: ReturnType<typeof setTimeout> | null = null;
	private graceTimer: ReturnType<typeof setTimeout> | null = null;

	private sourceMappingAt(i: number): MappingId | null {
		return this.sourceMappingIndex.get(i) ?? null;
	}
	private targetMappingAt(i: number): MappingId | null {
		return this.targetMappingIndex.get(i) ?? null;
	}

	// Mouse hover. `next` is the mapping under the pointer (null = unmapped token,
	// whitespace, or the pointer left the text). Light-up is delayed; clearing is
	// immediate. No-op when the pointer hasn't actually changed mapping — this is
	// what keeps a move between two tokens of the *same* mapping lit without a
	// flash, and lets the clear come only from entering a non-mapping or leaving.
	private movePointer(next: MappingId | null): void {
		if (next === this.pointerMapping) return;
		this.pointerMapping = next;
		this.clearLightTimer();

		if (next === null) {
			if (this.hoveredMappingId !== null) {
				this.hoveredMappingId = null;
				this.startGrace();
			}
			return;
		}
		if (next === this.hoveredMappingId) return; // already lit — instant stay

		const delay = this.warm ? HL_WARM_DELAY : HL_COLD_DELAY;
		this.lightTimer = setTimeout(() => {
			this.lightTimer = null;
			this.hoveredMappingId = next;
			this.warm = true;
			this.clearGrace();
		}, delay);
	}

	hoverSource(i: number): void {
		this.movePointer(this.sourceMappingAt(i));
	}
	hoverTarget(i: number): void {
		this.movePointer(this.targetMappingAt(i));
	}
	hoverOut(): void {
		this.movePointer(null);
	}

	// Touch tap. Instant, no delay: tap the lit mapping again to dismiss, tap a
	// different mapping to switch, tap nothing (null) to clear.
	private tapMapping(m: MappingId | null): void {
		this.clearLightTimer();
		// A grace timer left running from a prior hover-away would keep `warm` true
		// through the tap, so the next mouse hover would use the 300ms warm delay
		// instead of the 500ms cold delay. Reset both for consistent timing.
		this.clearGrace();
		this.warm = false;
		// Keep `pointerMapping` in lockstep with what ends up lit, not the tapped
		// id: a toggle-off lands on null, so a later mouse hover of the same token
		// won't hit movePointer's `next === pointerMapping` early-return and stay dark.
		const next = m === this.hoveredMappingId ? null : m;
		this.pointerMapping = next;
		this.hoveredMappingId = next;
	}
	tapSource(i: number): void {
		this.tapMapping(this.sourceMappingAt(i));
	}
	tapTarget(i: number): void {
		this.tapMapping(this.targetMappingAt(i));
	}

	isSourceHighlighted(i: number): boolean {
		return this.hoveredMappingId !== null && this.sourceMappingAt(i) === this.hoveredMappingId;
	}
	isTargetHighlighted(i: number): boolean {
		return this.hoveredMappingId !== null && this.targetMappingAt(i) === this.hoveredMappingId;
	}

	// Reset everything — call when leaving view mode.
	clearHighlight(): void {
		this.clearLightTimer();
		this.clearGrace();
		this.pointerMapping = null;
		this.warm = false;
		this.hoveredMappingId = null;
	}

	private clearLightTimer(): void {
		if (this.lightTimer !== null) {
			clearTimeout(this.lightTimer);
			this.lightTimer = null;
		}
	}
	private startGrace(): void {
		this.clearGrace();
		this.graceTimer = setTimeout(() => {
			this.graceTimer = null;
			this.warm = false;
		}, HL_WARMTH_GRACE);
	}
	private clearGrace(): void {
		if (this.graceTimer !== null) {
			clearTimeout(this.graceTimer);
			this.graceTimer = null;
		}
	}
}

export function setAlignmentContext(store: TokenAccess): Alignment {
	return setContext(ALIGNMENT_KEY, new Alignment(store));
}

export function getAlignmentContext(): Alignment {
	return getContext<Alignment>(ALIGNMENT_KEY);
}
