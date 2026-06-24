<script lang="ts">
	import type { TargetToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { redistributeRow, clearRedistribute } from '$lib/actions/redistribute';
	import { divisorColor, HIGHLIGHT_COLOR, type MappingColorVariant } from '$lib/constants/colors';
	import { interactionMode } from '$lib/context/interactionMode.svelte';
	import { theme as appTheme } from '$lib/theme';

	// Row-spread params for this panel's split zones (see redistribute.ts).
	const SPREAD = { max: 6, perGap: 3 } as const;

	// Token opacity in view mode. Options: 'opacity-100' | 'opacity-70' | 'opacity-30'
	const VIEW_TOKEN_OPACITY = 'opacity-85';

	let {
		tokens,
		onSplit,
		onMerge,
		animating,
		divisorOffset = 0,
		touchedDivisorIndex = null,
		onTouchDivisor = () => {},
		onClearTouchDivisor = () => {}
	}: {
		tokens: TargetToken[];
		onSplit: (afterIndex: number) => void;
		onMerge: (lineN: number) => void;
		animating: boolean;
		// Running divisor count from the source panel, so the palette continues
		// here instead of restarting (see divisorColor).
		divisorOffset?: number;
		// Touch line mode: the divisor index currently highlighted in THIS panel
		// (null if none / the other panel owns the highlight). First tap highlights,
		// second tap on the same index activates.
		touchedDivisorIndex?: number | null;
		onTouchDivisor?: (index: number) => void;
		onClearTouchDivisor?: () => void;
	} = $props();

	// Palette field the divisor indicators draw from. Swap to give source vs
	// target (or vertical vs horizontal) divisors a different hue later.
	const DIVISOR_FIELD: keyof MappingColorVariant = 'target';

	// Map each whitespace token's index → its running divisor ordinal. Every
	// whitespace token is a divisor (ws-split or, at a line break, merge-zone);
	// both consume an ordinal so enabling horizontal coloring later won't shift
	// the vertical colors.
	let divisorOrdinal = $derived.by(() => {
		const m = new Map<number, number>();
		let n = 0;
		tokens.forEach((t, i) => {
			if (t.type === 'whitespace') m.set(i, divisorOffset + n++);
		});
		return m;
	});

	let lineContainer: HTMLDivElement = $state()!;
	let mode = getModeContext();
	let alignment = getAlignmentContext();
	let isLinkMode = $derived(mode.current === 'link');
	let isLineMode = $derived(mode.current === 'line');
	let isViewMode = $derived(!isLinkMode && !isLineMode);
	let isTouch = $derived(interactionMode.current === 'touch');
	const colorMode = $derived(appTheme.current);
	// Hover-highlight reset on view-mode exit/unmount lives in QuoteWorkbench (one
	// owner) — see its clearHighlight $effect.
	let focusedIndex: number | null = $state(null);

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
		// Keep the scroll box at `auto` so it follows the separator height
		// transitions that animate the mode change; the token store owns the height
		// during a split/merge tween.
		if (!lineContainer || animating) return;
		lineContainer.style.height = '';
	});

	function handleClick(i: number) {
		if (!isLinkMode) {
			// Tapping a token in line mode clears any touch highlight.
			if (isLineMode) onClearTouchDivisor();
			// View mode: tap-to-highlight on touch (mouse uses hover).
			else if (isTouch) alignment.tapTarget(i);
			return;
		}
		alignment.toggleTarget(i);
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
		if (isViewMode) return alignment.isTargetHighlighted(i) ? `color: ${HIGHLIGHT_COLOR};` : '';
		// Color/weight only in link mode; the `.tok` transition crossfades back to
		// the default when leaving link mode.
		if (!isLinkMode) return '';
		const s = alignment.stateOfTarget(i);
		const focused = focusedIndex === i;
		if (s.kind === 'active' && focused)
			return `color: ${s.color}; font-weight: 600; filter: brightness(0.75);`;
		if (s.kind === 'active') return `color: ${s.color}; font-weight: 600;`;
		if (s.kind === 'idle' && focused) return `color: ${s.color}; font-weight: 350;`;
		return `font-weight: 350;`;
	}

	function tokenOpacity(i: number): string {
		if (isLineMode) return 'opacity-70';
		// view: hovered mapping pops to full opacity, rest stays at the flat resting level
		if (isViewMode) return alignment.isTargetHighlighted(i) ? 'opacity-100' : VIEW_TOKEN_OPACITY;
		if (!isLinkMode) return VIEW_TOKEN_OPACITY; // view
		const s = alignment.stateOfTarget(i);
		const focused = focusedIndex === i;
		if (s.kind === 'unmapped') return focused ? 'opacity-50' : 'opacity-30';
		if (s.kind === 'idle') return 'opacity-70';
		return '';
	}
</script>

<!-- One DOM tree for every mode (see InteractiveSourceText). Whitespace tokens
     are always rendered as buttons; they only take clicks in line mode. Boundary
     whitespace becomes the full-width merge zone whose height animates the line
     break open/closed. -->
<!-- click-outside-to-deselect kept; Escape covers the keyboard path, see docs/implementation-notes/click-outside-deselect.md -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	bind:this={lineContainer}
	data-scrollbox
	role={isLineMode ? undefined : 'listbox'}
	tabindex={isLineMode ? undefined : -1}
	aria-multiselectable={isLineMode ? undefined : true}
	aria-label={isLineMode ? undefined : 'Target tokens'}
	class="fade-y relative no-scrollbar flex min-h-0 w-full flex-wrap content-start justify-center overflow-y-auto bg-transparent px-2 py-3 font-ss4 text-base font-[350] italic"
	class:select-none={isLinkMode}
	class:flipping={animating}
	onclick={handleContainerClick}
	onmouseleave={() => {
		if (isViewMode && !isTouch) alignment.hoverOut();
	}}
>
	{#each tokens as token, i (i)}
		{@const isBoundary =
			token.type === 'whitespace' && i < tokens.length - 1 && tokens[i + 1].line !== token.line}
		{#if isBoundary}
			<button
				data-flip-id="tgt-{i}"
				class="merge-zone"
				class:line-active={isLineMode}
				class:touch-lit={isLineMode && isTouch && touchedDivisorIndex === i}
				data-divisor-index={i}
				style="--line-tool-color: {divisorColor(divisorOrdinal.get(i) ?? 0, DIVISOR_FIELD, colorMode)}"
				tabindex={-1}
				onclick={(e) =>
					handleDivisorClick(e, i, 'merge', () => {
						clearRedistribute(lineContainer, { instant: true });
						handleMerge(token.line);
					})}
				aria-label="Merge with next line"
			>
				<span class="merge-indicator"></span>
			</button>
		{:else if token.type === 'whitespace'}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<span
				data-flip-id="tgt-{i}"
				role="button"
				class="ws-split"
				class:line-active={isLineMode}
				class:touch-lit={isLineMode && isTouch && touchedDivisorIndex === i}
				data-divisor-index={i}
				style="--line-tool-color: {divisorColor(divisorOrdinal.get(i) ?? 0, DIVISOR_FIELD, colorMode)}"
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
				aria-label="Split line here">{token.text}</span
			>
		{:else}
			{@const interactive = isLinkMode}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<span
				data-flip-id="tgt-{i}"
				data-type={token.type}
				data-token-index={i}
				role={interactive ? 'option' : undefined}
				aria-selected={interactive ? alignment.stateOfTarget(i).kind === 'active' : undefined}
				tabindex={interactive ? -1 : undefined}
				class={'tok ' + tokenOpacity(i) + (interactive ? ' cursor-pointer outline-none' : '')}
				style={tokenStyle(i)}
				onclick={() => handleClick(i)}
				onmouseenter={() => {
					if (isViewMode && !isTouch) alignment.hoverTarget(i);
				}}
				onfocus={(e) => {
					if (interactive && e.currentTarget.matches(':focus-visible')) focusedIndex = i;
				}}
				onblur={() => {
					focusedIndex = null;
				}}>{token.text}</span
			>
		{/if}
	{/each}
</div>

<style>
	/* Register --rd-x so it always resolves to a concrete length (0px) instead of a
	   var() fallback. Transitions on transform: translateX(var(--rd-x)) only ease
	   when both ends are explicit values; an unset/fallback end snaps. Registering
	   keeps every redistribution explicit→explicit, so collapsing a previously-spread
	   row and opening a new one both animate (cross-visual-row, where a token touches
	   the rest state for the first/last time). See actions/redistribute.ts. */
	@property --rd-x {
		syntax: '<length>';
		initial-value: 0px;
		inherits: true; /* indicators read it via inheritance from their zone */
	}

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

	.tok {
		cursor: default;
		/* --rd-x: per-token offset for the line-mode divisor-hover redistribution
		   (see actions/redistribute.ts). Resting value is 0. */
		transform: translateX(var(--rd-x, 0));
		transition:
			color 280ms ease,
			opacity 280ms ease,
			font-weight 280ms ease,
			transform 150ms ease;
	}

	/* On a theme flip the page background eases over 500ms; widen the token's own
	   colour transition to match so the (inherited) text colour doesn't settle
	   ~220ms early. Scoped to the theme-switch window only, so the 280ms
	   mode-crossfade above is untouched. See systemTheme flashThemeTransition. */
	:global(html.theme-anim) .tok {
		transition:
			color 500ms ease,
			opacity 280ms ease,
			font-weight 280ms ease,
			transform 150ms ease;
	}

	/* During a split/merge GSAP Flip drives `transform` on the tokens and divisors.
	   The redistribution's own `transform` transition would ease toward each Flip
	   frame, so the row chased its target and wobbled. Drop the transform
	   transition for the duration of the Flip. */
	.flipping .tok {
		transition:
			color 280ms ease,
			opacity 280ms ease,
			font-weight 280ms ease;
	}
	/* Snap the indicator back instantly when the redistribution is cleared just
	   before a Flip (clearRedistribute({ instant: true })) so its `--rd-x` ease
	   doesn't run alongside the Flip. */
	:global(.rd-instant) .ws-split::after {
		transition: none;
	}

	/* While GSAP Flip runs, kill pointer events on divisors — prevents hover
	   activation, opacity flash, and spread animations mid-animation. */
	.flipping .ws-split,
	.flipping .merge-zone.line-active .merge-indicator {
		pointer-events: none;
	}

	.ws-split {
		display: inline-block;
		position: relative;
		font-size: inherit;
		font-family: inherit;
		font-style: inherit;
		font-weight: inherit;
		color: inherit;
		background: none;
		border: none;
		/* Hit target reaches into the flanking words so the whole inter-word space is
		   hoverable, not just the thin whitespace glyph. The negative margin cancels
		   the padding so layout is net-zero (words don't reflow); z-index:1 keeps the
		   zone on top of the overlapped word edges for the hit. The indicator is
		   centred on the box (left:50%), which stays over the original gap. */
		padding: 0 0.5em;
		margin: 0 -0.5em;
		z-index: 1;
		cursor: pointer;
		outline: none;
		white-space: pre;
		opacity: 0.9;
		user-select: text;
		-webkit-user-select: text;
	}

	.ws-split:not(.line-active) {
		pointer-events: none;
	}

	.ws-split::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		/* The hit-zone stays anchored under the pointer; only this indicator slides
		   (via the inherited `--rd-x`) to stay centred in the resized gap. Keeps the
		   divisor from "dancing" out from under a stationary pointer during the hover
		   redistribution. See actions/redistribute.ts. */
		transform: translate(calc(-50% + var(--rd-x, 0)), -50%) skewX(-10deg);
		width: var(--line-tool-width);
		height: 0.85em;
		background: var(--line-tool-color);
		opacity: var(--line-tool-opacity-idle);
		transition:
			opacity 150ms,
			transform 150ms ease;
	}

	/* Gate hover vs focus-visible by interaction mode so a mouse-hovered zone and
	   a Tab-focused zone never light up at once (see interactionMode.svelte.ts). */
	:global(html[data-interaction='mouse']) .ws-split.line-active:hover::after,
	:global(html[data-interaction='keyboard']) .ws-split.line-active:focus::after {
		opacity: var(--line-tool-opacity-hover);
	}

	/* Touch-highlighted split divisor — same visual as hover/focus. No media gate:
	   touch-lit is only set when interactionMode === 'touch'. */
	.ws-split.touch-lit::after {
		opacity: var(--line-tool-opacity-hover);
	}

	/* Full-width line break; height animates 0 ↔ 1.5rem to open the gap between
	   lines on the mode change. At height 0 it still forces a flex wrap, so it is
	   the line break in link/view modes too. */
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

	/* See matching note in InteractiveSourceText.svelte: a headless probe found
	   `height` on this flex item computing to 0px while `min-height` worked,
	   though it rendered fine in a real browser. Swap to `min-height` if this
	   ever turns into a real symptom. */
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
		.merge-zone {
			transition: none;
		}
	}
</style>
