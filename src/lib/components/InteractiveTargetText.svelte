<script lang="ts">
	import type { TargetToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { clearRedistribute } from '$lib/actions/redistribute';
	import LineDivisor from '$lib/components/LineDivisor.svelte';
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
			<LineDivisor
				kind="merge"
				surface="zone"
				divisorIndex={i}
				color={divisorColor(divisorOrdinal.get(i) ?? 0, DIVISOR_FIELD, colorMode)}
				flipId={`tgt-${i}`}
				container={lineContainer}
				spread={SPREAD}
				touchedDivisorIndex={touchedDivisorIndex}
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
				touchedDivisorIndex={touchedDivisorIndex}
				onActivate={() => onSplit(i)}
				onTouch={onTouchDivisor}
				onClearTouch={onClearTouchDivisor}
			/>
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

	@media (prefers-reduced-motion: reduce) {
		.tok {
			transition: none;
		}
	}
</style>
