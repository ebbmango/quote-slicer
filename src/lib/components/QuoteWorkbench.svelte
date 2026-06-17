<script lang="ts">
	// version B
	import { tick } from 'svelte';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { SOURCE_INPUT_RE } from '$lib/tokenize';
	import { getTokenStoreContext, type EditScope } from '$lib/animation/tokenStore.svelte';
	import { createTokenGridNav, getZone, type Zone } from '$lib/navigation/tokenGridNav';
	import InteractiveSourceText from '$lib/components/InteractiveSourceText.svelte';
	import InteractiveTargetText from '$lib/components/InteractiveTargetText.svelte';

	const LINE_ITEM_SELECTOR = '.split-zone, .merge-zone, .ws-split';

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
	let authorshipEl: HTMLTextAreaElement | null = $state(null);

	// The DOM refs one line edit animates over. Scroll boxes (the overflow-y-auto
	// elements inside each panel) are tagged data-scrollbox by the Interactive*Text
	// components; the store height-tweens the edited one.
	function editScope(): EditScope {
		return {
			sourceWrapperEl,
			targetWrapperEl,
			authorshipEl,
			sourceScrollEl: sourceWrapperEl?.querySelector<HTMLElement>('[data-scrollbox]') ?? null,
			targetScrollEl: targetWrapperEl?.querySelector<HTMLElement>('[data-scrollbox]') ?? null
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
			itemSelector: () => (mode.current === 'line' ? LINE_ITEM_SELECTOR : '[role="option"]'),
			getDefaultIndex: (zone: Zone) =>
				mode.current === 'line' ? -1 : alignment.findDefaultTokenIndex(zone),
			onActivate: (el, e) => {
				if (mode.current === 'line') {
					const zone = getZone(el);
					const divisorIndex = el.dataset.divisorIndex;
					el.click();
					if (zone && divisorIndex !== undefined) {
						tick().then(() => {
							const next = tokenContainer?.querySelector<HTMLElement>(
								`[data-zone="${zone}"] [data-divisor-index="${divisorIndex}"]`
							);
							next?.focus();
						});
					}
					return;
				}
				const zone = getZone(el);
				const idx = Number(el.dataset.tokenIndex);
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
		<div bind:this={sourceWrapperEl} data-zone="source" data-flip-id="source-panel" class="flex min-h-0 w-full">
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
		<div bind:this={targetWrapperEl} data-zone="target" data-flip-id="target-panel" class="flex min-h-0 w-full">
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
		bind:this={authorshipEl}
		data-flip-id="authorship"
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
	/* target placeholder: driven by a FIXED black alpha, NOT currentColor. The
	   element's own colour is animating (above); a currentColor-based placeholder
	   would reference that moving value and compound, dipping its effective opacity
	   below the target before settling. Tokens render at solid black, so black @ 0.5
	   (resting, == Tailwind's default placeholder tint) → black @ 0.3 (== token) is
	   the exact, monotonic path. */
	.morph-target::placeholder {
		color: rgb(0 0 0 / 0.5);
		transition: color 400ms ease-out;
	}
	.morph-target.exiting::placeholder {
		color: rgb(0 0 0 / 0.3);
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
