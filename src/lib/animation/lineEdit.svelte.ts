import { tick, onMount } from 'svelte';
import 'gsap'; // pulls in ambient gsap.* type namespace used by Flip's vars types
import { tokenizeSource, tokenizeTarget } from '$lib/tokenize';
import type { SourceToken, TargetToken } from '$lib/tokenize';
import { splitAfterToken, mergeLines } from '$lib/line';
import type { Zone } from '$lib/navigation/tokenGridNav';

const DURATION = 0.35;
const EASE = 'power2.inOut';

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

// The line-edit module (see CONTEXT.md). Owns split/merge of line breaks, the
// text-keyed token cache that keeps a split/merged array alive until the text
// changes, and the single unified Flip around the mutation. Replaces the former
// arrangement of an intra-panel Flip (flipTransition) plus a separate cross-panel
// Y-shift (QuoteWorkbench.withShiftAnimation) and their two competing height locks.
export function createLineEdit() {
	let Flip: (typeof import('gsap/Flip'))['Flip'] | null = $state(null);
	let gsap: (typeof import('gsap'))['gsap'] | null = $state(null);
	let animating = $state(false);

	let sourceCache: { text: string; tokens: SourceToken[] } | null = $state(null);
	let targetCache: { text: string; tokens: TargetToken[] } | null = $state(null);

	onMount(async () => {
		const [{ Flip: F }, { gsap: g }] = await Promise.all([import('gsap/Flip'), import('gsap')]);
		Flip = F;
		gsap = g;
	});

	// Cache-or-tokenize: split/merge write a cache keyed by the text they ran
	// against; once the text changes the cache is stale and we retokenize. Pinyin
	// lives on the token objects in this cache and so survives a split/merge.
	function sourceTokens(text: string): SourceToken[] {
		return sourceCache !== null && sourceCache.text === text
			? sourceCache.tokens
			: tokenizeSource(text);
	}
	function targetTokens(text: string): TargetToken[] {
		return targetCache !== null && targetCache.text === text
			? targetCache.tokens
			: tokenizeTarget(text);
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
		split,
		merge,
		get animating() {
			return animating;
		}
	};
}
