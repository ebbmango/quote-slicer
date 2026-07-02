<script lang="ts">
	// version B
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { SOURCE_INPUT_RE } from '$lib/tokenize';
	import { getTokenStoreContext, type EditScope } from '$lib/animation/tokenStore.svelte';
	import { createTokenGridNav } from '$lib/navigation/tokenGridNav';
	import {
		getZone,
		tokenIndexOf,
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

	// Strip disallowed characters (SOURCE_INPUT_RE) from the source textarea,
	// shifting the caret left by however many were removed so it stays put
	// relative to the surviving text. Shared by oninput and oncompositionend —
	// IME input only settles on compositionend, so both paths must filter.
	function filterSourceInput(el: HTMLTextAreaElement) {
		const start = el.selectionStart ?? 0;
		const end = el.selectionEnd ?? 0;
		const filtered = el.value.replace(SOURCE_INPUT_RE, '');
		const removed = el.value.length - filtered.length;
		if (removed > 0) {
			el.value = filtered;
			sourceText = filtered;
			el.setSelectionRange(start - removed, end - removed);
		}
	}

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
	let authEl: HTMLTextAreaElement | null = $state(null);

	// The DOM refs one line edit animates over. Scroll boxes (the overflow-y-auto
	// elements inside each panel) are tagged data-scrollbox by the Interactive*Text
	// components; the store height-tweens the edited one.
	function editScope(): EditScope {
		return {
			sourceWrapperEl,
			targetWrapperEl,
			sourceScrollEl: sourceWrapperEl?.querySelector<HTMLElement>(SCROLLBOX_SELECTOR) ?? null,
			targetScrollEl: targetWrapperEl?.querySelector<HTMLElement>(SCROLLBOX_SELECTOR) ?? null,
			authEl
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
		if (mode.current !== 'view') alignment.highlight.clearHighlight();
		return () => alignment.highlight.clearHighlight();
	});

	let tokenContainer: HTMLDivElement = $state(null!);

	const tokenGridNav = createTokenGridNav(() => tokenContainer, {
		itemSelector: () => (mode.current === 'line' ? LINE_ITEM_SELECTOR : TOKEN_ITEM_SELECTOR),
		getDefaultIndex: (zone: Zone) =>
			mode.current === 'line' ? -1 : alignment.findDefaultTokenIndex(zone),
		onActivate: (el, e) => {
			// Line mode: the divisor's own click handler runs the split/merge. The nav
			// re-acquires focus after (restoresFocusOnActivate below) — the divisor is
			// re-rendered away by the edit.
			if (mode.current === 'line') {
				el.click();
				return;
			}
			const zone = getZone(el);
			const idx = tokenIndexOf(el);
			if (zone === 'source') alignment.toggleSource(idx, { force: e.shiftKey });
			else if (zone === 'target') alignment.toggleTarget(idx);
		},
		restoresFocusOnActivate: () => mode.current === 'line',
		onEscape: () => {
			if (mode.current !== 'line') alignment.deselect();
		}
	});
</script>

<!-- Quote stack: source/target/authorship as one rhythm (uniform gap). Capped at
     the band height (max-h-full) so when it's too tall the panels shrink to their
     floor and scroll internally; the scroll layer (in +page) centers it and takes
     over scrolling only once the panels bottom out. -->
<div class="flex max-h-full min-h-0 w-full flex-col items-center">
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
					filterSourceInput(e.currentTarget as HTMLTextAreaElement);
				}}
				oncompositionend={(e: CompositionEvent) => {
					composing = false;
					filterSourceInput(e.currentTarget as HTMLTextAreaElement);
				}}
				class="morph-source fade-y relative no-scrollbar min-h-0 w-full translate-x-[1px] resize-none overflow-y-auto bg-transparent px-2 py-3 text-center text-[1.75rem] leading-10 font-light tracking-[2px] opacity-30 outline-none {composing
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
				class="morph-target fade-y relative no-scrollbar min-h-0 w-full resize-none overflow-y-auto bg-transparent px-2 py-3 text-center font-ss4 text-base font-[350] italic outline-none {arrowExiting
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
			class="flex min-h-0 w-full flex-col rounded-xl px-1 outline-0 transition-[background-color] duration-200 focus:bg-blue-50 dark:focus:bg-gray-700/30"
			tabindex={mode.current === 'view' ? undefined : 0}
			onkeydown={tokenGridNav.handleKeydown}
			onfocusin={tokenGridNav.handleFocusIn}
		>
			<!-- overflow-clip: during a split/merge the store locks the inner scroll box to an
		     explicit pixel height. If the stack is over capacity (max-h-full) the flex-col
		     shrinks this wrapper, but the explicit-height box does NOT stretch down to a
		     shrunk wrapper — so without clipping it paints straight through into the other
		     panel. Clipping the wrapper contains the box to its flex slot in every regime. -->
			<div
				bind:this={sourceWrapperEl}
				data-zone="source"
				data-flip-id="source-panel"
				class="flex min-h-0 w-full overflow-clip"
			>
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
			<div
				bind:this={targetWrapperEl}
				data-zone="target"
				data-flip-id="target-panel"
				class="flex min-h-0 w-full overflow-clip"
			>
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
		bind:this={authEl}
		autocomplete="off"
		bind:value={authorship}
		rows="1"
		use:autosize
		disabled={mode.current === 'view'}
		class="morph-author fade-y no-scrollbar max-h-[10vh] min-h-0 w-full shrink-0 resize-none overflow-y-auto bg-transparent py-3 text-center font-ss4 text-sm font-[350] opacity-40 outline-none disabled:cursor-default {arrowExiting
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

	/* The colour transitions live ONLY under .exiting (the destination state of the
	   morph, which is where the engine reads transition-* from), never on the resting
	   field. A resting `transition: color` on an element whose colour is inherited
	   makes it EASE TOWARD <body>'s already-easing value on a theme flip, so it
	   settles at ~2× the page's 500ms — the "target text lags" bug. WebKit shows the
	   chase in computed style; Chromium hides it there but paints it anyway (painted
	   pixels sat at ~50% when the page was done). Same rule as .tok in layout.css:
	   inherited colour must ride inheritance untransitioned. .exiting is one-way
	   (advanceToLinkMode seeds every field and swaps mode), so there is no
	   remove-the-class path that would need the reverse transition. */

	/* Placeholder colour is PLAIN currentColor with the 50% dimming carried by the
	   pseudo-element's opacity — never a colour *function* of currentColor. When the
	   root color-scheme is dark (dark-OS users: the app.html prepaint stamps it),
	   Chromium fails to recompute ::placeholder colours built from currentColor via
	   color-mix() / relative-color syntax when the inherited colour changes — the
	   placeholder stays at the PREVIOUS theme's ink and camouflages into the new
	   background (the UA default is exactly such a color-mix, so leaving it to the
	   UA has the same bug). Plain currentColor and var()-based colours recompute
	   correctly; plain currentColor also rides <body>'s theme transition in
	   lockstep, and opacity is theme-invariant so nothing here needs a transition
	   on a flip. (var(--page-fg) is avoided for the older reason: light-dark()
	   inside it never re-resolves on ::placeholder.) */
	.morph-source::placeholder,
	.morph-target::placeholder,
	.morph-author::placeholder {
		color: currentColor;
		opacity: 0.5;
	}

	/* The morph animates the placeholder's OPACITY (0.5 → 1), not its colour: same
	   visual as the old colour-alpha rise, without arming any colour transition. */
	.morph-source.exiting::placeholder,
	.morph-author.exiting::placeholder {
		transition: opacity 400ms ease-out;
		opacity: 1;
	}

	/* target text: element opacity stays at 1, so the dimming is carried by the text
	   colour fading to currentColor @ 30% (== target token's currentColor × 0.3).
	   currentColor here resolves to the stable inherited colour, so the typed text
	   dims monotonically. (Element-level color-mix, not ::placeholder — the Chromium
	   staleness above is placeholder-specific, and this state is one-way and
	   unmounts 450ms later.) */
	.morph-target.exiting {
		transition: color 400ms ease-out;
		color: color-mix(in oklab, currentColor 30%, transparent);
	}
	/* target placeholder under .exiting: rises to the element's full (animating)
	   colour — currentColor at opacity 1 — so its effective opacity lands at 30%
	   with the element, matching the token-mode look at the swap. */
	.morph-target.exiting::placeholder {
		transition: opacity 400ms ease-out;
		opacity: 1;
	}

	/* Reduced motion: keep the pre-match (so the swap is still seamless) but drop the
	   easing — the .exiting state applies instantly at click instead of animating. */
	@media (prefers-reduced-motion: reduce) {
		.morph-source.exiting::placeholder,
		.morph-author.exiting::placeholder,
		.morph-target.exiting,
		.morph-target.exiting::placeholder {
			transition: none;
		}
	}

	/* Same soft edge-fade as the token panels (.fade-y in routes/layout.css),
	   a touch tighter — smaller text here; py-3 still clears the fade at rest
	   and when the line scrolls. */
	.fade-y {
		--fade-pad: 0.5rem;
	}
</style>
