<script lang="ts">
	import type { TargetToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { clearRedistribute } from '$lib/actions/redistribute';
	import LineDivisor from '$lib/components/LineDivisor.svelte';
	import { divisorColor, type MappingColorVariant } from '$lib/constants/colors';
	import { tokenPresentation } from '$lib/tokenPresentation';
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
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built fresh per recompute, never mutated after return
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
			else if (isTouch) alignment.highlight.tapTarget(i);
			return;
		}
		alignment.toggleTarget(i);
	}

	function handleContainerClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClearTouchDivisor();
			alignment.deselect();
			// View mode: tapping empty space clears the highlight.
			if (isViewMode && isTouch) alignment.highlight.clearHighlight();
		}
	}

	// Resolved color/opacity/weight for token `i` (see tokenPresentation). The
	// color + font-weight ladder only applies in link mode, so state is read only
	// there. Unlike the source panel, target keeps a resting 350 weight (fontWeight).
	function pres(i: number) {
		return tokenPresentation({
			mode: isLinkMode ? 'link' : isLineMode ? 'line' : 'view',
			state: isLinkMode ? alignment.stateOfTarget(i) : null,
			focused: focusedIndex === i,
			highlighted: isViewMode && alignment.highlight.isTargetHighlighted(i),
			viewOpacity: VIEW_TOKEN_OPACITY,
			fontWeight: true
		});
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
		if (isViewMode && !isTouch) alignment.highlight.hoverOut();
	}}
>
	{#each tokens as token, i (i)}
		{@const isBoundary =
			token.type === 'whitespace' && i < tokens.length - 1 && tokens[i + 1].line !== token.line}
		{#if isBoundary}
			<LineDivisor
				kind="merge"
				surface="zone"
				divisorIndex={i}
				color={divisorColor(divisorOrdinal.get(i) ?? 0, DIVISOR_FIELD, colorMode)}
				flipId={`tgt-${i}`}
				container={lineContainer}
				spread={SPREAD}
				{touchedDivisorIndex}
				onActivate={() => onMerge(token.line)}
				onTouch={onTouchDivisor}
				onClearTouch={onClearTouchDivisor}
			/>
		{:else if token.type === 'whitespace'}
			<LineDivisor
				kind="split"
				surface="whitespace"
				divisorIndex={i}
				color={divisorColor(divisorOrdinal.get(i) ?? 0, DIVISOR_FIELD, colorMode)}
				text={token.text}
				flipId={`tgt-${i}`}
				container={lineContainer}
				spread={SPREAD}
				{touchedDivisorIndex}
				onActivate={() => onSplit(i)}
				onTouch={onTouchDivisor}
				onClearTouch={onClearTouchDivisor}
			/>
		{:else}
			{@const interactive = isLinkMode}
			{@const p = pres(i)}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<span
				data-flip-id="tgt-{i}"
				data-type={token.type}
				data-token-index={i}
				role={interactive ? 'option' : undefined}
				aria-selected={interactive ? alignment.stateOfTarget(i).kind === 'active' : undefined}
				tabindex={interactive ? -1 : undefined}
				class={'tok ' +
					p.opacityClass +
					(p.style.includes('color:') ? ' tok-tinted' : '') +
					(interactive ? ' cursor-pointer outline-none' : '')}
				style={p.style}
				onclick={() => handleClick(i)}
				onmouseenter={() => {
					if (isViewMode && !isTouch) alignment.highlight.hoverTarget(i);
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

	/* Token spans (.tok), the theme-flip widening, the .flipping transform-drop,
	   and reduced-motion all live in routes/layout.css now — one global rule
	   shared with the source panel instead of a byte-identical copy here. */
</style>
