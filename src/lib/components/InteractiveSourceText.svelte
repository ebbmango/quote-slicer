<script lang="ts">
	import { groupSourceTokens, type SourceToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { longpress } from '$lib/actions/longpress';
	import { redistributeRow, clearRedistribute } from '$lib/actions/redistribute';
	import { divisorColor, HIGHLIGHT_COLOR, type MappingColor } from '$lib/constants/colors';
	import { interactionMode } from '$lib/context/interactionMode.svelte';

	// Row-spread params for this panel's split zones (see redistribute.ts).
	const SPREAD = { max: 8, perGap: 2 } as const;

	// Palette field the divisor indicators draw from. Swap to give source vs
	// target (or vertical vs horizontal) divisors a different hue later.
	const DIVISOR_FIELD: keyof MappingColor = 'source';

	// Token opacity in view mode. Options: 'opacity-100' | 'opacity-70' | 'opacity-30'
	const VIEW_TOKEN_OPACITY = 'opacity-80';

	let {
		tokens,
		onSplit,
		onMerge,
		animating,
		touchedDivisorIndex = null,
		onTouchDivisor = () => {},
		onClearTouchDivisor = () => {}
	}: {
		tokens: SourceToken[];
		onSplit: (afterIndex: number) => void;
		onMerge: (lineN: number) => void;
		animating: boolean;
		// Touch line mode: the divisor index currently highlighted in THIS panel
		// (null if none / the other panel owns the highlight). First tap highlights,
		// second tap on the same index activates.
		touchedDivisorIndex?: number | null;
		onTouchDivisor?: (index: number) => void;
		onClearTouchDivisor?: () => void;
	} = $props();

	let container: HTMLDivElement = $state()!;
	let lineContainer: HTMLDivElement = $state()!;
	let mode = getModeContext();
	let alignment = getAlignmentContext();
	let isLinkMode = $derived(mode.current === 'link');
	let isLineMode = $derived(mode.current === 'line');
	let isViewMode = $derived(!isLinkMode && !isLineMode);
	let isTouch = $derived(interactionMode.current === 'touch');
	// Hover-highlight reset on view-mode exit/unmount lives in QuoteWorkbench (one
	// owner) — see its clearHighlight $effect.
	let focusedIndex: number | null = $state(null);

	// Punctuation glued to its base token so it never wraps onto its own line.
	// Each group renders inside one inline-flex wrapper (an atomic flex item of the
	// row); divisors between same-group tokens stay inside it, divisors between
	// groups stay direct children of the row container. See groupSourceTokens.
	let groups = $derived(groupSourceTokens(tokens));

	function handleSplit(globalIndex: number) {
		onSplit(globalIndex);
	}

	function handleMerge(lineN: number) {
		onMerge(lineN);
	}

	// Touch divisor tap: first tap highlights (+ spread, split zones only); second
	// tap on the same divisor activates. Mouse/keyboard activate immediately.
	function handleDivisorClick(
		e: MouseEvent,
		index: number,
		kind: 'split' | 'merge',
		activate: () => void
	) {
		e.stopPropagation();
		if (!isLineMode) return;
		if (!isTouch) {
			activate();
			return;
		}
		if (touchedDivisorIndex === index) {
			// activate() runs clearRedistribute({ instant: true }) before the edit, so
			// any first-tap spread snaps back exactly as the line splits/merges.
			onClearTouchDivisor();
			activate();
		} else {
			onTouchDivisor(index);
			if (kind === 'split') redistributeRow(lineContainer, index, SPREAD);
		}
	}

	// Clear any lingering divisor-hover redistribution when leaving line mode.
	$effect(() => {
		if (!isLineMode) clearRedistribute(lineContainer);
	});

	// Touch: whenever this panel holds no highlight, collapse any spread it left.
	// Covers tap-elsewhere, cross-panel switch, and post-activate. Skipped while a
	// Flip runs so it never fights the instant clear that precedes the edit.
	$effect(() => {
		if (isTouch && touchedDivisorIndex === null && !animating) clearRedistribute(lineContainer);
	});

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		tokens;
		// Leave the scroll box at `auto` height so it follows content in flow —
		// including the line-separator height transitions that animate the mode
		// change. The token store owns an explicit pixel height while a split/merge tweens;
		// don't fight it.
		if (!container || animating) return;
		container.style.height = '';
	});

	function handleClick(e: MouseEvent, i: number) {
		if (!isLinkMode) {
			// Tapping a token in line mode clears any touch highlight.
			if (isLineMode) onClearTouchDivisor();
			// View mode: tap-to-highlight on touch (mouse uses hover).
			else if (isTouch) alignment.tapSource(i);
			return;
		}
		alignment.toggleSource(i, { force: e.metaKey || e.ctrlKey });
	}

	function handleContainerClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClearTouchDivisor();
			alignment.deselect();
			// View mode: tapping empty space clears the highlight.
			if (isViewMode && isTouch) alignment.clearHighlight();
		}
	}

	function tokenStyle(i: number): string {
		// View mode: hovered mapping lights up in the flat highlight color.
		if (isViewMode) return alignment.isSourceHighlighted(i) ? `color: ${HIGHLIGHT_COLOR};` : '';
		// Color only in link mode; leaving link mode unsets color so the span
		// transitions back to the default text color (see the `.tok` transition).
		if (!isLinkMode) return '';
		const token = tokens[i];
		if (token.type === 'punctuation') return '';
		const s = alignment.stateOfSource(i);
		const focused = focusedIndex === i;
		if (s.kind === 'active' && focused) return `color: ${s.color}; filter: brightness(0.75);`;
		if (s.kind === 'active') return `color: ${s.color};`;
		if (s.kind === 'idle' && focused) return `color: ${s.color};`;
		return '';
	}

	function tokenOpacity(i: number): string {
		if (isLineMode) return 'opacity-70';
		// view: hovered mapping pops to full opacity, rest stays at the flat resting level
		if (isViewMode) return alignment.isSourceHighlighted(i) ? 'opacity-100' : VIEW_TOKEN_OPACITY;
		if (!isLinkMode) return VIEW_TOKEN_OPACITY; // view
		const token = tokens[i];
		if (token.type === 'punctuation') return 'opacity-30';
		const s = alignment.stateOfSource(i);
		const focused = focusedIndex === i;
		if (s.kind === 'unmapped') return focused ? 'opacity-50' : 'opacity-30';
		if (s.kind === 'idle') return 'opacity-70';
		return '';
	}
</script>

<!-- One DOM tree for every mode so spans/separators persist across mode changes
     and their color/height transitions can animate instead of snapping. The
     line-mode split/merge buttons are always present (net-zero width / collapsed
     height) and only become interactive in line mode. -->
<div bind:this={container} data-scrollbox class="fade-y relative min-h-0 w-full overflow-y-auto px-2 py-3 no-scrollbar">
	<!-- click-outside-to-deselect kept; Escape covers the keyboard path, see docs/implementation-notes/click-outside-deselect.md -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		bind:this={lineContainer}
		role={isLineMode ? undefined : 'listbox'}
		tabindex={isLineMode ? undefined : -1}
		aria-multiselectable={isLineMode ? undefined : true}
		aria-label={isLineMode ? undefined : 'Source tokens'}
		// change text to 1.75rem
		class="flex w-full flex-wrap content-start leading-10 gap-px justify-center bg-transparent font-wenkai text-3xl font-light"
		class:select-none={isLinkMode}
		class:flipping={animating}
		onclick={handleContainerClick}
		onmouseleave={() => {
			if (isViewMode && !isTouch) alignment.hoverOut();
		}}
	>
		{#snippet divisor(i)}
			{#if tokens[i + 1].line !== tokens[i].line}
				<button
					class="merge-zone"
					class:line-active={isLineMode}
					class:touch-lit={isLineMode && isTouch && touchedDivisorIndex === i}
					data-divisor-index={i}
					style="--line-tool-color: {divisorColor(i, DIVISOR_FIELD)}"
					tabindex={-1}
					onclick={(e) =>
						handleDivisorClick(e, i, 'merge', () => {
							clearRedistribute(lineContainer, { instant: true });
							handleMerge(tokens[i].line);
						})}
					aria-label="Merge with next line"
				>
					<span class="merge-indicator"></span>
				</button>
			{:else}
				<button
					class="split-zone"
					class:line-active={isLineMode}
					class:touch-lit={isLineMode && isTouch && touchedDivisorIndex === i}
					data-divisor-index={i}
					style="--line-tool-color: {divisorColor(i, DIVISOR_FIELD)}"
					tabindex={-1}
					onclick={(e) =>
						handleDivisorClick(e, i, 'split', () => {
							clearRedistribute(lineContainer, { instant: true });
							handleSplit(i);
						})}
					onmouseenter={() => {
						if (isLineMode && !isTouch) redistributeRow(lineContainer, i, SPREAD);
					}}
					onmouseleave={() => {
						if (!isTouch) clearRedistribute(lineContainer);
					}}
					onfocus={() => {
						if (isLineMode && !isTouch) redistributeRow(lineContainer, i, SPREAD);
					}}
					onblur={() => {
						if (!isTouch) clearRedistribute(lineContainer);
					}}
					aria-label="Split line here"
				>
					<span class="split-indicator"></span>
				</button>
			{/if}
		{/snippet}

		{#snippet tokenSpan(i)}
			{@const token = tokens[i]}
			{@const interactive = isLinkMode && token.type !== 'punctuation'}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<span
				data-flip-id="src-{i}"
				data-type={token.type}
				data-token-index={i}
				role={interactive ? 'option' : undefined}
				aria-selected={interactive ? alignment.stateOfSource(i).kind === 'active' : undefined}
				tabindex={interactive ? -1 : undefined}
				class={'tok ' + tokenOpacity(i) + (interactive ? ' cursor-pointer outline-none' : '')}
				style={tokenStyle(i)}
				onclick={(e) => handleClick(e, i)}
				onmouseenter={() => {
					if (isViewMode && !isTouch) alignment.hoverSource(i);
				}}
				onfocus={(e) => {
					if (interactive && e.currentTarget.matches(':focus-visible')) focusedIndex = i;
				}}
				onblur={() => {
					focusedIndex = null;
				}}
				use:longpress={{
					duration: 500,
					onlongpress: () => {
						if (isLinkMode) alignment.toggleSource(i, { force: true });
					}
				}}>{token.text}</span
			>
		{/snippet}

		{#each groups as group (group[0])}
			<!-- inline-flex wrapper: never wraps internally (so glued punctuation stays
			     with its base), yet acts as a single atomic flex item of the row — and
			     keeps its tokens/divisors in a flex row so every divisor rule still
			     resolves (align-self: stretch, net-zero margins). -->
			<span class="tok-group">
				{#each group as i, gi (i)}
					{@render tokenSpan(i)}
					{#if gi < group.length - 1}
						{@render divisor(i)}
					{/if}
				{/each}
			</span>
			{#if group[group.length - 1] < tokens.length - 1}
				{@render divisor(group[group.length - 1])}
			{/if}
		{/each}
	</div>
</div>

<style>
	/* Soft top/bottom fade on the scroll area instead of a hard cutoff. The 0.75rem
	   fade matches the scroll box's 0.75rem (py-3) padding, so at either scroll
	   extreme the first/last line sits past the fade and reads at full opacity —
	   only mid-scroll content dims. mask = transparency, so it works over the page
	   background and the modal's #f9f9f9 alike. */
	.fade-y {
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent 0,
			#000 0.75rem,
			#000 calc(100% - 0.75rem),
			transparent 100%
		);
		mask-image: linear-gradient(
			to bottom,
			transparent 0,
			#000 0.75rem,
			#000 calc(100% - 0.75rem),
			transparent 100%
		);
	}

	/* Glued punctuation wrapper: one atomic flex item of the row that itself lays
	   its tokens + intra-group split-zones out in a non-wrapping flex row, so the
	   divisors keep the exact flex-item context their rules assume (align-self:
	   stretch, the -0.5em net-zero margins). `align-items: stretch` matches the
	   row's default so zones still fill the line-box height. */
	.tok-group {
		display: inline-flex;
		flex-wrap: nowrap;
		align-items: stretch;
	}

	/* Persistent token spans crossfade color/opacity when the mode changes
	   instead of snapping (only possible because the element is never swapped). */
	.tok {
		cursor: default;
		/* --rd-x: per-token offset for the line-mode divisor-hover redistribution
		   (see actions/redistribute.ts). Resting value is 0. */
		transform: translateX(var(--rd-x, 0));
		transition:
			color 280ms ease,
			opacity 280ms ease,
			transform 150ms ease;
	}

	/* During a split/merge GSAP Flip drives `transform` on the tokens (and, in the
	   target panel, the divisors). The redistribution's own `transform` transition
	   would ease toward each Flip frame, so the row chased its target and wobbled.
	   Drop the transform transition for the duration of the Flip. */
	.flipping .tok {
		transition:
			color 280ms ease,
			opacity 280ms ease;
	}
	/* Snap the indicator back instantly when the redistribution is cleared just
	   before a Flip (clearRedistribute({ instant: true })) so its `--rd-x` ease
	   doesn't run alongside the Flip. */
	:global(.rd-instant) .split-indicator {
		transition: none;
	}

	/* While GSAP Flip runs, kill pointer events on divisors — prevents hover
	   activation, opacity flash, and spread animations mid-animation. */
	.flipping .split-zone,
	.flipping .merge-zone.line-active .merge-indicator {
		pointer-events: none;
	}

	.split-zone {
		display: flex;
		align-items: center;
		justify-content: center;
		/* Hit target spans roughly a full character so the whole inter-word gap is
		   hoverable, not just a narrow band over the indicator. `margin: -width/2`
		   keeps the layout contribution net-zero (zones overlap into the flanking
		   glyphs but don't reflow them); z-index:1 keeps them on top for the hit. */
		width: 1em;
		margin: 0 -0.5em;
		z-index: 1;
		align-self: stretch;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		outline: none;
	}

	/* Outside line mode the zone occupies its net-zero slot but takes no clicks. */
	.split-zone:not(.line-active) {
		pointer-events: none;
	}

	.split-indicator {
		display: block;
		width: var(--line-tool-width);
		height: 0.85em;
		background: var(--line-tool-color);
		opacity: var(--line-tool-opacity-idle);
		/* The hit-zone stays anchored under the pointer; only the indicator slides
		   to stay centred in the resized gap during the hover redistribution. This
		   prevents the divisor "dancing" out from under a stationary pointer (the
		   8px zone moving triggered leave/enter flicker). See actions/redistribute.ts. */
		transform: translateX(var(--rd-x, 0)) skewX(-10deg);
		transition:
			opacity 150ms,
			transform 150ms ease;
	}

	:global(html[data-interaction='mouse']) .split-zone.line-active:hover .split-indicator,
	:global(html[data-interaction='keyboard'])
		.split-zone.line-active:focus
		.split-indicator {
		opacity: var(--line-tool-opacity-hover);
	}

	/* Touch-highlighted split divisor — same visual as hover/focus. No media gate:
	   touch-lit is only set when interactionMode === 'touch'. */
	.split-zone.touch-lit .split-indicator {
		opacity: var(--line-tool-opacity-hover);
	}

	/* Full-width line break. Height animates 0 ↔ 1.5rem on the mode change so the
	   lines "come apart"; the scroll box (height: auto) follows in flow. At height
	   0 it still forces a flex wrap, so it doubles as the plain line break in
	   link/view modes. */
	.merge-zone {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 0;
		padding: 0;
		overflow: hidden;
		background: none;
		border: none;
		outline: none;
		transition: height 350ms ease;
	}

	/* NOTE: in one headless/automated probe, forcing `height` on this flex item
	   (even via inline style, transition disabled) computed to 0px, while
	   `min-height` worked. Looked fine in a real browser. If this ever shows up
	   as a real bug, swap `height` for `min-height` here (and in
	   InteractiveTargetText's matching rule) and re-check the close transition. */
	.merge-zone.line-active {
		height: 1.5rem;
		/* The full-width band is only here to force the flex wrap (the line break).
		   Hover/click belong to the dashed line itself, not the empty span beside it —
		   so the band takes no pointer events; the indicator re-enables them. */
		pointer-events: none;
	}

	.merge-zone:not(.line-active) {
		pointer-events: none;
	}

	.merge-zone:not(.line-active) .merge-indicator {
		opacity: 0;
	}

	.merge-indicator {
		display: block;
		width: 2.5rem;
		height: var(--line-tool-width);
		/* Vertical padding gives the thin line a hittable height without thickening
		   it — the dashes are clipped to the content box, so the padding stays
		   invisible. `box-sizing: content-box` keeps the line height exact. */
		box-sizing: content-box;
		padding: 0.45rem 0;
		background-clip: content-box;
		background-image: linear-gradient(
			to right,
			var(--line-tool-color) 0 50%,
			transparent 50% 100%
		);
		background-repeat: repeat-x;
		background-size: calc(var(--line-tool-dash) + var(--line-tool-gap)) 100%;
		opacity: var(--line-tool-opacity-idle-merge);
		transition: opacity 340ms, width 340ms ease, background-size 340ms ease;
	}

	/* The line itself is the only interactive part of the band (see .merge-zone).
	   Raise it above the flanking tokens, whose tall (leading-10) line-boxes spill
	   into the gap and would otherwise capture the hit. */
	.merge-zone.line-active .merge-indicator {
		pointer-events: auto;
		cursor: pointer;
		position: relative;
		z-index: 2;
	}

	:global(html[data-interaction='mouse']) .merge-zone.line-active .merge-indicator:hover,
	:global(html[data-interaction='keyboard'])
		.merge-zone.line-active:focus
		.merge-indicator {
		opacity: var(--line-tool-opacity-hover);
		width: 30%;
		background-size: calc((var(--line-tool-dash) + var(--line-tool-gap)) * 1.5) 100%;
	}

	/* Touch-highlighted merge divisor — same visual as hover/focus. */
	.merge-zone.touch-lit .merge-indicator {
		opacity: var(--line-tool-opacity-hover);
		width: 30%;
		background-size: calc((var(--line-tool-dash) + var(--line-tool-gap)) * 1.5) 100%;
	}

	@media (prefers-reduced-motion: reduce) {
		.tok,
		.merge-zone,
		.split-zone {
			transition: none;
		}
	}
</style>
