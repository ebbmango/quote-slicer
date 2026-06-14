import { tick, onMount, getContext, setContext } from 'svelte';
import 'gsap'; // pulls in ambient gsap.* type namespace used by Flip's vars types
import { tokenizeSource, tokenizeTarget } from '$lib/tokenize';
import type { SourceToken, TargetToken } from '$lib/tokenize';
import { splitAfterToken, mergeLines } from '$lib/line';
import type { Zone } from '$lib/navigation/tokenGridNav';

const DURATION = 0.35;
const EASE = 'power2.inOut';
const TOKEN_STORE_KEY = Symbol('tokenStore');

// Everything a single line edit animates over. The edited panel's tokens reflow
// individually (each carries data-flip-id) and its scroll box's height tweens so
// the reflow isn't clipped; the panels that merely reposition (centered-stack
// rebalance) are flipped as whole wrappers so their inner tokens don't slide out
// of their own overflow box. Authorship rides along as one more wrapper.
export type EditScope = {
	sourceWrapperEl: HTMLElement | null;
	targetWrapperEl: HTMLElement | null;
	authorshipEl: HTMLElement | null;
	sourceScrollEl: HTMLElement | null;
	targetScrollEl: HTMLElement | null;
};

// The token store (see CONTEXT.md "tokens"). The single owner of the
// source/target token arrays: it tokenizes, holds the text-keyed split/merge
// cache, owns per-character pinyin as an id-keyed overlay, and runs the unified
// Flip around split/merge. Alignment derives mapping/colouring state from this
// store rather than holding its own copy, so there is no second token owner to
// keep in sync — split/merge can no longer be fed the "wrong" array.
export type TokenStore = ReturnType<typeof createTokenStore>;

// The read/annotate surface Alignment needs — excludes split/merge/animate/EditScope
// so changes to the animation-only members of TokenStore don't ripple into Alignment.
export type TokenAccess = Pick<TokenStore, 'sourceTokens' | 'targetTokens' | 'setPinyin'>;

export function createTokenStore() {
	let Flip: (typeof import('gsap/Flip'))['Flip'] | null = $state(null);
	let gsap: (typeof import('gsap'))['gsap'] | null = $state(null);
	let animating = $state(false);

	let sourceCache: { text: string; tokens: SourceToken[] } | null = $state(null);
	let targetCache: { text: string; tokens: TargetToken[] } | null = $state(null);

	// Pinyin overlay, keyed by stable token id. Kept separate from the text-keyed
	// cache because pinyin is annotated before any split exists to populate the
	// cache — a cache miss must still surface it. Applied on read; reassigned (not
	// mutated in place) so dependent $derived recompute.
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
		const base =
			sourceCache !== null && sourceCache.text === text
				? sourceCache.tokens
				: tokenizeSource(text);
		return applyPinyin(base);
	}
	function targetTokens(text: string): TargetToken[] {
		return targetCache !== null && targetCache.text === text
			? targetCache.tokens
			: tokenizeTarget(text);
	}

	// Annotate (or clear, with undefined) a source token's pinyin by stable id.
	function setPinyin(tokenId: number, value: string | undefined): void {
		const next = new Map(pinyin);
		if (value === undefined) next.delete(tokenId);
		else next.set(tokenId, value);
		pinyin = next;
	}

	// Elements flipped for an edit in `zone`: the edited panel's tokens (reflow)
	// plus the *other* panel's wrapper and authorship (reposition as units).
	function flipTargets(zone: Zone, scope: EditScope): HTMLElement[] {
		const editedScroll = zone === 'source' ? scope.sourceScrollEl : scope.targetScrollEl;
		const otherWrapper = zone === 'source' ? scope.targetWrapperEl : scope.sourceWrapperEl;
		const tokens = editedScroll
			? Array.from(editedScroll.querySelectorAll<HTMLElement>('[data-flip-id]'))
			: [];
		return [...tokens, otherWrapper, scope.authorshipEl].filter(
			(el): el is HTMLElement => el !== null
		);
	}

	async function animate(zone: Zone, scope: EditScope, mutate: () => void): Promise<void> {
		const heightEl = zone === 'source' ? scope.sourceScrollEl : scope.targetScrollEl;
		if (!Flip || !gsap) {
			mutate();
			return;
		}
		const state = Flip.getState(flipTargets(zone, scope));

		// Lock the edited scroll box to its current height and flag animating so the
		// panel's instant-fit $effect can't snap it to the new size mid-flight.
		const oldHeight = heightEl ? heightEl.offsetHeight : 0;
		if (heightEl) heightEl.style.height = oldHeight + 'px';
		animating = true;

		mutate();
		await tick();

		if (heightEl) {
			// Measure the settled height without a visible jump, then tween to it.
			heightEl.style.height = 'auto';
			const target = heightEl.scrollHeight;
			heightEl.style.height = oldHeight + 'px';
			gsap.to(heightEl, {
				height: target,
				duration: DURATION,
				ease: EASE,
				onComplete: () => {
					// Release to auto so the box can follow later content / mode-change
					// separator transitions in flow.
					heightEl.style.height = '';
				}
			});
		}

		// One Flip over tokens + repositioning wrappers; absolute:false so the boxes
		// keep their room while transforms resolve (the height tween supplies it).
		Flip.from(state, {
			duration: DURATION,
			ease: EASE,
			absolute: false,
			onComplete: () => {
				animating = false;
			}
		});
	}

	function split(zone: Zone, text: string, tokens: SourceToken[], afterIndex: number, scope: EditScope): void;
	function split(zone: Zone, text: string, tokens: TargetToken[], afterIndex: number, scope: EditScope): void;
	function split(
		zone: Zone,
		text: string,
		tokens: (SourceToken | TargetToken)[],
		afterIndex: number,
		scope: EditScope
	): void {
		const next = splitAfterToken(tokens, afterIndex);
		animate(zone, scope, () => writeCache(zone, text, next));
	}

	function merge(zone: Zone, text: string, tokens: SourceToken[], lineN: number, scope: EditScope): void;
	function merge(zone: Zone, text: string, tokens: TargetToken[], lineN: number, scope: EditScope): void;
	function merge(
		zone: Zone,
		text: string,
		tokens: (SourceToken | TargetToken)[],
		lineN: number,
		scope: EditScope
	): void {
		const next = mergeLines(tokens, lineN);
		animate(zone, scope, () => writeCache(zone, text, next));
	}

	function writeCache(zone: Zone, text: string, tokens: (SourceToken | TargetToken)[]): void {
		if (zone === 'source') sourceCache = { text, tokens: tokens as SourceToken[] };
		else targetCache = { text, tokens: tokens as TargetToken[] };
	}

	return {
		sourceTokens,
		targetTokens,
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
