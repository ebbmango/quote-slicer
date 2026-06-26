<script lang="ts">
	// version B
	import { tick } from 'svelte';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { SOURCE_INPUT_RE } from '$lib/tokenize';
	import { getTokenStoreContext, type EditScope } from '$lib/animation/tokenStore.svelte';
	import { createTokenGridNav } from '$lib/navigation/tokenGridNav';
	import {
		getZone,
		zoneSelector,
		divisorSelector,
		tokenIndexOf,
		divisorIndexOf,
		LINE_ITEM_SELECTOR,
		TOKEN_ITEM_SELECTOR,
		SCROLLBOX_SELECTOR,
		type Zone
	} from '$lib/navigation/gridDom';
	import InteractiveSourceText from '$lib/components/InteractiveSourceText.svelte';
	import InteractiveTargetText from '$lib/components/InteractiveTargetText.svelte';

	let {
		sourceText = $bindable(),
		targetText = $bindable(),
		authorship = $bindable(),
		arrowExiting = false,
		autosize
	} = $props();
	let composing = $state(false);

	let mode = getModeContext();
	let editing = $derived(mode.current === 'text');
	const alignment = getAlignmentContext();

	// The token store is the single owner of tokenization, the text-keyed split/merge
	// cache, per-character pinyin, and the unified Flip around each edit (see
	// tokenStore.svelte.ts / CONTEXT.md). Alignment derives its own token view from
	// the same store keyed by meta — so there's no token array to push into it here.
	const store = getTokenStoreContext();
	let sourceTokens = $derived(store.sourceTokens(sourceText));
	let targetTokens = $derived(store.targetTokens(targetText));

	$effect(() => {
		alignment.setMeta({ sourceText, targetText, authorship });
	});

	let sourceWrapperEl: HTMLDivElement | null = $state(null);
	let targetWrapperEl: HTMLDivElement | null = $state(null);

	// The DOM refs one line edit animates over. Scroll boxes (the overflow-y-auto
	// elements inside each panel) are tagged data-scrollbox by the Interactive*Text
	// components; the store height-tweens the edited one.
	function editScope(): EditScope {
		return {
			sourceWrapperEl,
			targetWrapperEl,
			sourceScrollEl: sourceWrapperEl?.querySelector<HTMLElement>(SCROLLBOX_SELECTOR) ?? null,
			targetScrollEl: targetWrapperEl?.querySelector<HTMLElement>(SCROLLBOX_SELECTOR) ?? null
		};
	}

	// sourceTokens/targetTokens already carry pinyin from the store's overlay, so
	// split/merge no longer need a special "live" array — the store owns it.
	function splitSource(afterIndex: number) {
		store.split('source', sourceText, sourceTokens, afterIndex, editScope());
	}
	function mergeSource(lineN: number) {
		store.merge('source', sourceText, sourceTokens, lineN, editScope());
	}
	function splitTarget(afterIndex: number) {
		store.split('target', targetText, targetTokens, afterIndex, editScope());
	}
	function mergeTarget(lineN: number) {
		store.merge('target', targetText, targetTokens, lineN, editScope());
	}

	// Touch line mode: which divisor is "highlighted" (first tap). Shared across
	// panels so only one is lit at a time; second tap on the same one activates.
	type TouchedDivisor = { panel: 'source' | 'target'; index: number } | null;
	let touchedDivisor: TouchedDivisor = $state(null);

	function onTouchDivisor(panel: 'source' | 'target', index: number) {
		touchedDivisor = { panel, index };
	}
	function clearTouchDivisor() {
		touchedDivisor = null;
	}

	// Drop any highlight when leaving line mode.
	$effect(() => {
		if (mode.current !== 'line') touchedDivisor = null;
	});

	// Drop any lit view-mode hover highlight when leaving view mode, and on unmount
	// (cancels pending light/grace timers so they don't fire on a detached instance).
	$effect(() => {
		if (mode.current !== 'view') alignment.clearHighlight();
		return () => alignment.clearHighlight();
	});

	let tokenContainer: HTMLDivElement = $state(null!);

	const tokenGridNav = createTokenGridNav(
		() => tokenContainer,
		{
			itemSelector: () => (mode.current === 'line' ? LINE_ITEM_SELECTOR : TOKEN_ITEM_SELECTOR),
			getDefaultIndex: (zone: Zone) =>
				mode.current === 'line' ? -1 : alignment.findDefaultTokenIndex(zone),
			onActivate: (el, e) => {
				if (mode.current === 'line') {
					const zone = getZone(el);
					const divisorIndex = divisorIndexOf(el);
					el.click();
					if (zone && !Number.isNaN(divisorIndex)) {
						tick().then(() => {
							const zoneEl = tokenContainer?.querySelector<HTMLElement>(zoneSelector(zone));
							let next =
								zoneEl?.querySelector<HTMLElement>(divisorSelector(divisorIndex)) ?? null;
							if (!next && zoneEl) {
								// The divisor can vanish when a base token and its punctuation
								// recombine into one group (they can no longer be split apart) — its
								// index is now intra-group and unrendered. Focus the nearest remaining
								// divisor so a keyboard merge doesn't drop focus to <body>.
								const all = [...zoneEl.querySelectorAll<HTMLElement>(LINE_ITEM_SELECTOR)];
								next =
									all.filter((d) => divisorIndexOf(d) <= divisorIndex).pop() ??
									all[0] ??
									null;
							}
							next?.focus();
						});
					}
					return;
				}
				const zone = getZone(el);
				const idx = tokenIndexOf(el);
				if (zone === 'source') alignment.toggleSource(idx, { force: e.shiftKey });
				else if (zone === 'target') alignment.toggleTarget(idx);
			},
			onEscape: () => {
				if (mode.current !== 'line') alignment.deselect();
			}
		}
	);
</script>

<!-- Quote stack: source/target/authorship as one rhythm (uniform gap). Capped at
     the band height (max-h-full) so when it's too tall the panels shrink to their
     floor and scroll internally; the scroll layer (in +page) centers it and takes
     over scrolling only once the panels bottom out. -->
<div class="flex w-full min-h-0 max-h-full flex-col items-center">
	{#if editing}
	<!-- Text mode mirrors the view-mode grid + panel box metrics (same px-1 grid,
	     px-2 py-3 padding, fade, text styling) so switching modes keeps every line
	     in place — the input boxes seamlessly become the quote workbench. The
	     textareas are direct flex-col children here (not wrapped like the view
	     panels): autosize puts an inline height on them, so they must sit on the
	     column's main axis for flex-shrink + min-h-0 + overflow-y-auto to bound and
	     scroll them instead of spilling over each other. Keep in sync with {:else}.

	     Seamless text→token handoff (no crossfade): the source text is tracked to
	     2px (tracking-[2px]) so its inter-glyph spacing already equals the token
	     row's effective per-pair gap (gap-px counts twice — a zero-width divisor
	     button sits between each token pair), plus translate-x-[1px] to cancel the
	     trailing letter-spacing that otherwise centres the glyph block 1px left of
	     the trailing-free token row; the text colours morph toward their token-mode
	     values during the 450ms arrow launch (.morph-* rules in <style>), so by the
	     time the DOM swaps nothing is left to snap. -->
	<div class="flex min-h-0 w-full flex-col px-1">
	<textarea
		id="source-text"
		name="source-text"
		bind:value={sourceText}
		rows="1"
		use:autosize
		oncompositionstart={() => (composing = true)}
		oninput={(e: InputEvent) => {
			if (e.isComposing) return;
			const el = e.currentTarget as HTMLTextAreaElement;
			const start = el.selectionStart ?? 0;
			const end = el.selectionEnd ?? 0;
			const filtered = el.value.replace(SOURCE_INPUT_RE, '');
			const removed = el.value.length - filtered.length;
			if (removed > 0) {
				el.value = filtered;
				sourceText = filtered;
				el.setSelectionRange(start - removed, end - removed);
			}
		}}
		oncompositionend={(e: CompositionEvent) => {
			composing = false;
			const el = e.currentTarget as HTMLTextAreaElement;
			const start = el.selectionStart ?? 0;
			const end = el.selectionEnd ?? 0;
			const filtered = el.value.replace(SOURCE_INPUT_RE, '');
			const removed = el.value.length - filtered.length;
			if (removed > 0) {
				el.value = filtered;
				sourceText = filtered;
				el.setSelectionRange(start - removed, end - removed);
			}
		}}
		class="morph-source fade-y relative min-h-0 w-full resize-none overflow-y-auto px-2 py-3 no-scrollbar bg-transparent text-center leading-10 tracking-[2px] translate-x-[1px] text-[1.75rem] font-light opacity-30 outline-none {composing
			? 'font-ss4'
			: 'font-wenkai'} {arrowExiting ? 'exiting' : ''}"
		placeholder="空"
	></textarea>
	<textarea
		id="target-text"
		name="target-text"
		bind:value={targetText}
		rows="1"
		use:autosize
		class="morph-target fade-y relative min-h-0 w-full resize-none overflow-y-auto px-2 py-3 no-scrollbar bg-transparent text-center font-ss4 text-base font-[350] italic outline-none {arrowExiting
			? 'exiting'
			: ''}"
		placeholder="Use this box to enter your translated text."
	></textarea>
	</div>
	{:else}
	<div
		bind:this={tokenContainer}
		role="grid"
		aria-label="Token workspace"
		class="flex min-h-0 w-full flex-col rounded-xl px-1 outline-0 duration-200 focus:bg-blue-50"
		tabindex="0"
		onkeydown={tokenGridNav.handleKeydown}
		onfocusin={tokenGridNav.handleFocusIn}
	>
		<!-- overflow-clip: during a split/merge the store locks the inner scroll box to an
		     explicit pixel height. If the stack is over capacity (max-h-full) the flex-col
		     shrinks this wrapper, but the explicit-height box does NOT stretch down to a
		     shrunk wrapper — so without clipping it paints straight through into the other
		     panel. Clipping the wrapper contains the box to its flex slot in every regime. -->
		<div bind:this={sourceWrapperEl} data-zone="source" data-flip-id="source-panel" class="flex min-h-0 w-full overflow-clip">
			<InteractiveSourceText
				tokens={sourceTokens}
				onSplit={splitSource}
				onMerge={mergeSource}
				animating={store.animating}
				touchedDivisorIndex={touchedDivisor?.panel === 'source' ? touchedDivisor.index : null}
				onTouchDivisor={(i) => onTouchDivisor('source', i)}
				onClearTouchDivisor={clearTouchDivisor}
			/>
		</div>
		<div bind:this={targetWrapperEl} data-zone="target" data-flip-id="target-panel" class="flex min-h-0 w-full overflow-clip">
			<InteractiveTargetText
				tokens={targetTokens}
				onSplit={splitTarget}
				onMerge={mergeTarget}
				animating={store.animating}
				divisorOffset={Math.max(0, sourceTokens.length - 1)}
				touchedDivisorIndex={touchedDivisor?.panel === 'target' ? touchedDivisor.index : null}
				onTouchDivisor={(i) => onTouchDivisor('target', i)}
				onClearTouchDivisor={clearTouchDivisor}
			/>
		</div>
	</div>
	{/if}
	<textarea
		id="authorship"
		name="authorship"
		autocomplete="off"
		bind:value={authorship}
		rows="1"
		use:autosize
		disabled={mode.current === 'view'}
		class="morph-author fade-y max-h-[10vh] no-scrollbar min-h-0 w-full shrink-0 resize-none overflow-y-auto bg-transparent py-3 text-center font-ss4 text-sm font-[350] opacity-40 outline-none disabled:cursor-default {arrowExiting
			? 'exiting'
			: ''}"
		placeholder="Source"
	></textarea>
</div>

<style>
	/* Seamless text→token handoff (no crossfade). Instead of dissolving two DOM
	   trees, each textarea PRE-MATCHES its token-mode appearance during the 450ms
	   arrow launch (.exiting === arrowExiting), so the DOM swap at 450ms has nothing
	   left to snap. Each field's TEXT (real or placeholder) is morphed to the exact
	   colour its token shows: currentColor × the field's resting element opacity.

	   Crucially the morph animates ONE multiplier per field (colour alpha) and leaves
	   the element opacity fixed at its resting value, so the placeholder's effective
	   opacity moves monotonically. (An earlier version faded the target's *element*
	   opacity 1→0.3 AND its placeholder colour 0.5→1 at once; the product overshot
	   brighter at the start before settling — the "up then down" flicker.)

	   - source: element stays opacity-30 (== source token). Filled text is already at
	     the token level; only the empty placeholder's colour rises 0.5 → full.
	   - authorship: element stays opacity-40 (== seeded value). Same: placeholder
	     colour rises 0.5 → full.
	   - target: element stays full; instead its text AND placeholder colour fade to
	     currentColor @ 30% (== target token's currentColor × opacity-30). No element
	     fade, so nothing compounds.
	   400ms ease-out settles flat just before the swap; resting look is untouched. */

	/* source + authorship: only the placeholder colour rises to full currentColor;
	   the element's own opacity (0.3 / 0.4) already provides the token dimming. */
	.morph-source::placeholder,
	.morph-author::placeholder {
		transition: color 400ms ease-out;
	}
	.morph-source.exiting::placeholder,
	.morph-author.exiting::placeholder {
		color: currentColor;
	}

	/* target text: element opacity stays at 1, so the dimming is carried by the text
	   colour fading to currentColor @ 30% (== target token's currentColor × 0.3).
	   currentColor here resolves to the stable inherited colour, so the typed text
	   dims monotonically. */
	.morph-target {
		transition: color 400ms ease-out;
	}
	.morph-target.exiting {
		color: color-mix(in oklab, currentColor 30%, transparent);
	}
	/* target placeholder: uses currentColor (the element's own computed colour)
	   rather than var(--page-fg) directly. var(--page-fg) is defined via
	   light-dark(), and browsers don't re-resolve that function on ::placeholder
	   when color-scheme changes — the colour would be frozen at the initial
	   theme value. currentColor properly inherits through the cascade, so it
	   updates and transitions with the rest of the page.
	   During .exiting the element's colour animates to 30% alpha (see above);
	   the placeholder explicitly resets to the full element colour (not the
	   50%-mixed value) so its effective opacity also lands at 30% and matches
	   the original intention. */
	.morph-target::placeholder {
		color: color-mix(in oklab, currentColor 50%, transparent);
		transition: color 400ms ease-out;
	}
	.morph-target.exiting::placeholder {
		color: currentColor;
	}

	/* Widen the target's colour transition to match the 500ms page background
	   during a theme flip. Scoped to the theme-switch window only; the 400ms
	   mode-crossfade above is untouched for normal arrow-exit morph. */
	:global(html.theme-anim) .morph-target,
	:global(html.theme-anim) .morph-target::placeholder {
		transition: color 500ms ease;
	}

	/* Reduced motion: keep the pre-match (so the swap is still seamless) but drop the
	   easing — the .exiting state applies instantly at click instead of animating. */
	@media (prefers-reduced-motion: reduce) {
		.morph-source::placeholder,
		.morph-author::placeholder,
		.morph-target,
		.morph-target::placeholder {
			transition: none;
		}
	}

	/* Small soft edge-fade on the authorship line, matching the source/target
	   panels (theirs is 0.75rem; authorship is smaller text so a touch less). The
	   py-3 padding lets the line clear the fade at rest and when it scrolls. */
	.fade-y {
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent 0,
			#000 0.5rem,
			#000 calc(100% - 0.5rem),
			transparent 100%
		);
		mask-image: linear-gradient(
			to bottom,
			transparent 0,
			#000 0.5rem,
			#000 calc(100% - 0.5rem),
			transparent 100%
		);
	}
</style>
