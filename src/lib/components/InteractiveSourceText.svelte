<script lang="ts">
	import { groupSourceTokens, type SourceToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { longpress } from '$lib/actions/longpress';
	import { clearRedistribute } from '$lib/actions/redistribute';
	import LineDivisor from '$lib/components/LineDivisor.svelte';
	import { divisorColor, type MappingColorVariant } from '$lib/constants/colors';
	import { tokenPresentation } from '$lib/tokenPresentation';
	import { interactionMode } from '$lib/context/interactionMode.svelte';
	import { theme as appTheme } from '$lib/theme';

	// Row-spread params for this panel's split zones (see redistribute.ts).
	const SPREAD = { max: 8, perGap: 2 } as const;

	// Palette field the divisor indicators draw from. Swap to give source vs
	// target (or vertical vs horizontal) divisors a different hue later.
	const DIVISOR_FIELD: keyof MappingColorVariant = 'source';

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
	const colorMode = $derived(appTheme.current);
	// Hover-highlight reset on view-mode exit/unmount lives in QuoteWorkbench (one
	// owner) — see its clearHighlight $effect.
	let focusedIndex: number | null = $state(null);

	// Punctuation glued to its base token so it never wraps onto its own line.
	// Each group renders inside one inline-flex wrapper (an atomic flex item of the
	// row) holding only tokens — no intra-group divisors, so punctuation can never
	// be split off from its base. Divisors live only between groups, as direct
	// children of the row container. See groupSourceTokens.
	let groups = $derived(groupSourceTokens(tokens));

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
			else if (isTouch) alignment.highlight.tapSource(i);
			return;
		}
		alignment.toggleSource(i, { force: e.metaKey || e.ctrlKey });
	}

	function handleContainerClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClearTouchDivisor();
			alignment.deselect();
			// View mode: tapping empty space clears the highlight.
			if (isViewMode && isTouch) alignment.highlight.clearHighlight();
		}
	}

	// Resolved color/opacity for token `i` (see tokenPresentation). Color and the
	// active/idle/unmapped ladder only apply in link mode, so state is read only
	// there (and never for punctuation, which can't anchor a mapping).
	function pres(i: number) {
		const token = tokens[i];
		return tokenPresentation({
			mode: isLinkMode ? 'link' : isLineMode ? 'line' : 'view',
			state: isLinkMode && token.type !== 'punctuation' ? alignment.stateOfSource(i) : null,
			focused: focusedIndex === i,
			highlighted: isViewMode && alignment.highlight.isSourceHighlighted(i),
			viewOpacity: VIEW_TOKEN_OPACITY,
			fontWeight: false
		});
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
		class="flex w-full flex-wrap content-start leading-10 gap-px justify-center bg-transparent font-wenkai text-[1.75rem] font-light"
		class:select-none={isLinkMode}
		class:flipping={animating}
		onclick={handleContainerClick}
		onmouseleave={() => {
			if (isViewMode && !isTouch) alignment.highlight.hoverOut();
		}}
	>
		{#snippet tokenSpan(i: number)}
			{@const token = tokens[i]}
			{@const interactive = isLinkMode && token.type !== 'punctuation'}
			{@const p = pres(i)}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<span
				data-flip-id="src-{i}"
				data-type={token.type}
				data-token-index={i}
				role={interactive ? 'option' : undefined}
				aria-selected={interactive ? alignment.stateOfSource(i).kind === 'active' : undefined}
				tabindex={interactive ? -1 : undefined}
				class={'tok ' + p.opacityClass + (interactive ? ' cursor-pointer outline-none' : '')}
				style={p.style}
				onclick={(e) => handleClick(e, i)}
				onmouseenter={() => {
					if (isViewMode && !isTouch) alignment.highlight.hoverSource(i);
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
			     with its base), and acts as a single atomic flex item of the row. No
			     intra-group divisor: a base token and its punctuation can never be split
			     onto different lines. -->
			<span class="tok-group">
				{#each group as i (i)}
					{@render tokenSpan(i)}
				{/each}
			</span>
			{#if group[group.length - 1] < tokens.length - 1}
				{@const di = group[group.length - 1]}
				{@const isMerge = tokens[di + 1].line !== tokens[di].line}
				<LineDivisor
					kind={isMerge ? 'merge' : 'split'}
					surface="zone"
					divisorIndex={di}
					color={divisorColor(di, DIVISOR_FIELD, colorMode)}
					container={lineContainer}
					spread={SPREAD}
					touchedDivisorIndex={touchedDivisorIndex}
					onActivate={() => (isMerge ? onMerge(tokens[di].line) : onSplit(di))}
					onTouch={onTouchDivisor}
					onClearTouch={onClearTouchDivisor}
				/>
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

	/* Glued punctuation wrapper: one atomic flex item of the row that lays its
	   tokens out in a non-wrapping flex row, so a base token and its glued
	   punctuation never wrap apart. `align-items: stretch` matches the row's
	   default so the wrapper still fills the line-box height. */
	.tok-group {
		display: inline-flex;
		flex-wrap: nowrap;
		align-items: stretch;
	}

	/* Token spans (.tok), the theme-flip widening, the .flipping transform-drop,
	   and reduced-motion all live in routes/layout.css now — one global rule
	   shared with the target panel instead of a byte-identical copy here. */
</style>
