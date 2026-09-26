import { tick, onMount, getContext, setContext } from 'svelte';
import 'gsap'; // pulls in ambient gsap.* type namespace used by Flip's vars types
import { parseSource, parseTarget, type Tokenized } from '$lib/tokenize';
import type { SourceToken, TargetToken } from '$lib/tokenize';
import { editBreak } from '$lib/breaks';
import { FLIP_TOKEN_SELECTOR, type Zone } from '$lib/navigation/gridDom';

const DURATION = 0.35;
const EASE = 'power2.inOut';
const TOKEN_STORE_KEY = Symbol('tokenStore');

// Everything a single line edit animates over. The edited panel's tokens reflow
// individually (each carries data-flip-id, found via its scroll box); the edited
// panel's wrapper is the element whose height is tweened when the panel can grow.
// The panels below ride the flow (not flipped) — see animate(). The provenance
// field (provenanceEl) is carried here too: the workbench owns the layout, so it passes
// the ref in rather than the store walking the DOM up to find it.
export type EditScope = {
	sourceWrapperEl: HTMLElement | null;
	targetWrapperEl: HTMLElement | null;
	sourceScrollEl: HTMLElement | null;
	targetScrollEl: HTMLElement | null;
	provenanceEl: HTMLElement | null;
};

// The token store (see CONTEXT.md "tokens"). The single owner of the
// source/target token arrays: it tokenizes, owns independent break arrays,
// owns per-character pinyin as an id-keyed overlay, and runs the
// Flip around split/merge. Alignment derives mapping/colouring state from this
// store rather than holding its own copy, so there is no second token owner to
// keep in sync — split/merge can no longer be fed the "wrong" array.
export type TokenStore = ReturnType<typeof createTokenStore>;

// The read/annotate surface Alignment needs — excludes split/merge/animate/EditScope
// so changes to the animation-only members of TokenStore don't ripple into Alignment.
export type TokenAccess = Pick<
	TokenStore,
	'sourceTokens' | 'targetTokens' | 'sourceBreaks' | 'targetBreaks' | 'setPinyin' | 'lockText'
>;

export function createTokenStore() {
	let Flip: (typeof import('gsap/Flip'))['Flip'] | null = $state(null);
	let gsap: (typeof import('gsap'))['gsap'] | null = $state(null);
	let animating = $state(false);

	// Plain memoization avoids reactive writes inside callers' derived reads.
	let sourceCache: ({ text: string } & Tokenized<SourceToken>) | null = null;
	let targetCache: ({ text: string } & Tokenized<TargetToken>) | null = null;
	let nextSourceId = 0;
	let nextTargetId = 0;
	let locked = false;
	let sourceEdits: { text: string; breaks: number[] } | null = $state(null);
	let targetEdits: { text: string; breaks: number[] } | null = $state(null);

	// Pinyin overlay, keyed by stable token id. Kept separate from the text-keyed
	// cache because pinyin is annotated before any split exists to populate the
	// cache — a cache miss must still surface it. Applied on read; reassigned (not
	// mutated in place) so dependent $derived recompute.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- reassigned wholesale, never mutated in place
	let pinyin: Map<number, string | undefined> = $state(new Map());

	onMount(async () => {
		const [{ Flip: F }, { gsap: g }] = await Promise.all([import('gsap/Flip'), import('gsap')]);
		Flip = F;
		gsap = g;
	});

	function applyPinyin(tokens: SourceToken[]): SourceToken[] {
		return tokens.map((t) => {
			if (pinyin.has(t.id)) return { ...t, pinyin: pinyin.get(t.id) };
			if (t.pinyin !== undefined && t.pinyin !== null) return { ...t, pinyin: undefined };
			return t;
		});
	}

	// Cache-or-tokenize, then overlay pinyin: split/merge write a cache keyed by
	// the text they ran against; once the text changes the cache is stale and we
	// retokenize. Pinyin is reapplied from the id-keyed overlay either way.
	function sourceTokens(text: string): SourceToken[] {
		if (!sourceCache || sourceCache.text !== text) {
			if (locked) throw new Error('Mapped text requires an explicit identity-aware edit');
			if (sourceCache && pinyin.size)
				throw new Error('Annotated text requires an explicit identity-aware edit');
			const parsed = parseSource(text);
			sourceCache = {
				text,
				...parsed,
				tokens: parsed.tokens.map((t) => ({ ...t, id: nextSourceId++ }))
			};
		}
		return applyPinyin(sourceCache.tokens);
	}
	function targetTokens(text: string): TargetToken[] {
		if (!targetCache || targetCache.text !== text) {
			if (locked) throw new Error('Mapped text requires an explicit identity-aware edit');
			const parsed = parseTarget(text);
			targetCache = {
				text,
				...parsed,
				tokens: parsed.tokens.map((t) => ({ ...t, id: nextTargetId++ }))
			};
		}
		return targetCache.tokens;
	}
	function sourceBreaks(text: string): number[] {
		sourceTokens(text);
		return sourceEdits?.text === text ? sourceEdits.breaks : sourceCache!.breaks;
	}
	function targetBreaks(text: string): number[] {
		targetTokens(text);
		return targetEdits?.text === text ? targetEdits.breaks : targetCache!.breaks;
	}

	// Annotate (or clear, with undefined) a source token's pinyin by stable id.
	function setPinyin(tokenId: number, value: string | undefined): void {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- next immutable snapshot; the reassignment below drives reactivity
		const next = new Map(pinyin);
		if (value === undefined) next.delete(tokenId);
		else next.set(tokenId, value);
		pinyin = next;
	}

	// Flipped for an edit in `zone`: the whole vertical layout — both panel wrappers,
	// the provenance field, and the edited panel's tokens.
	function flipTargets(zone: Zone, scope: EditScope): HTMLElement[] {
		const editedScroll = zone === 'source' ? scope.sourceScrollEl : scope.targetScrollEl;
		const tokens = editedScroll
			? Array.from(editedScroll.querySelectorAll<HTMLElement>(FLIP_TOKEN_SELECTOR))
			: [];
		return [scope.sourceWrapperEl, scope.targetWrapperEl, scope.provenanceEl, ...tokens].filter(
			(el): el is HTMLElement => el !== null
		);
	}

	async function animate(zone: Zone, scope: EditScope, mutate: () => void): Promise<void> {
		if (!Flip || !gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			mutate();
			return;
		}

		const otherWrapper = zone === 'source' ? scope.targetWrapperEl : scope.sourceWrapperEl;
		// Capture other wrapper's height before the edit to detect constrained flex
		// redistribution (both wrappers change height when the outer-stack is capped).
		const otherBeforeH = otherWrapper?.offsetHeight ?? null;

		// Capture the pre-edit layout (wrapper sizes/positions + token positions).
		const state = Flip.getState(flipTargets(zone, scope));
		animating = true;

		// Apply the edit and let the DOM settle to its FINAL layout. A forced synchronous
		// reflow ensures flex has fully resolved before Flip reads the after-state, so the
		// captured "after" is the true settled layout (not a transient mid-settle one that
		// would make the panels overshoot).
		mutate();
		await tick();
		void (scope.sourceWrapperEl?.offsetHeight ?? 0); // flush layout

		const otherAfterH = otherWrapper?.offsetHeight ?? null;

		// One nested Flip animates everything from pre → settled: the wrappers' height and
		// the panel boundary slide, and the tokens reflow inside. nested:true accounts for
		// the wrapper transform when animating its child tokens. absolute:false keeps the
		// wrappers in flow so their height change drives the surrounding layout naturally.
		Flip.from(state, {
			duration: DURATION,
			ease: EASE,
			absolute: false,
			nested: true,
			onComplete: () => {
				animating = false;
			}
		});

		// Flip with absolute:false tweens the edited wrapper's height, driving layout
		// recomputation at each frame. Provenance and the "other" wrapper can pick up wrong
		// transforms: Flip computes their before→after delta based on the true settled
		// layout, but then its own height tween reverts the layout to before — so the
		// element is ALREADY at its before-flow position, and the Flip transform on top
		// double-counts the displacement.
		//
		// Provenance has no height of its own (it moves only with the stack re-centering), so
		// always clear its transform — in the constrained regime it was 0 anyway.
		//
		// The other wrapper is only safe to clear if it didn't change height: if it changed
		// height (flex redistribution in the constrained/overflow regime) its Flip transform
		// is load-bearing for the position animation that accompanies the height change.
		const otherHeightChanged =
			otherBeforeH !== null && otherAfterH !== null && Math.abs(otherBeforeH - otherAfterH) > 1;
		if (scope.provenanceEl) gsap.set(scope.provenanceEl, { clearProps: 'transform' });
		if (otherWrapper && !otherHeightChanged) gsap.set(otherWrapper, { clearProps: 'transform' });
	}

	function split(zone: Zone, text: string, afterIndex: number, scope: EditScope): void {
		changeBreak(zone, text, afterIndex + 1, true, scope);
	}

	function merge(zone: Zone, text: string, boundary: number, scope: EditScope): void {
		changeBreak(zone, text, boundary, false, scope);
	}

	function changeBreak(
		zone: Zone,
		text: string,
		boundary: number,
		present: boolean,
		scope: EditScope
	) {
		const tokens = zone === 'source' ? sourceTokens(text) : targetTokens(text);
		const breaks = zone === 'source' ? sourceBreaks(text) : targetBreaks(text);
		const next = editBreak(breaks, tokens.length, boundary, present);
		void animate(zone, scope, () => {
			if (zone === 'source') sourceEdits = { text, breaks: next };
			else targetEdits = { text, breaks: next };
		});
	}

	return {
		lockText() {
			locked = true;
		},
		sourceTokens,
		targetTokens,
		sourceBreaks,
		targetBreaks,
		setPinyin,
		split,
		merge,
		get animating() {
			return animating;
		}
	};
}

export function setTokenStoreContext(): TokenStore {
	return setContext(TOKEN_STORE_KEY, createTokenStore());
}

export function getTokenStoreContext(): TokenStore {
	return getContext<TokenStore>(TOKEN_STORE_KEY);
}
