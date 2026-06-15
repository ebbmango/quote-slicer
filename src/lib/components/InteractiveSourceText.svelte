<script lang="ts">
	import type { SourceToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { longpress } from '$lib/actions/longpress';
	import { redistributeRow, clearRedistribute } from '$lib/actions/redistribute';

	let {
		tokens,
		onSplit,
		onMerge,
		animating
	}: {
		tokens: SourceToken[];
		onSplit: (afterIndex: number) => void;
		onMerge: (lineN: number) => void;
		animating: boolean;
	} = $props();

	let container: HTMLDivElement = $state()!;
	let lineContainer: HTMLDivElement = $state()!;
	let mode = getModeContext();
	let alignment = getAlignmentContext();
	let isLinkMode = $derived(mode.current === 'link');
	let isLineMode = $derived(mode.current === 'line');
	let focusedIndex: number | null = $state(null);

	function handleSplit(globalIndex: number) {
		onSplit(globalIndex);
	}

	function handleMerge(lineN: number) {
		onMerge(lineN);
	}

	// Clear any lingering divisor-hover redistribution when leaving line mode.
	$effect(() => {
		if (!isLineMode) clearRedistribute(lineContainer);
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
		if (!isLinkMode) return;
		alignment.toggleSource(i, { force: e.metaKey || e.ctrlKey });
	}

	function handleContainerClick(e: MouseEvent) {
		if (e.target === e.currentTarget) alignment.deselect();
	}

	function tokenStyle(i: number): string {
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
		if (!isLinkMode) return 'opacity-30'; // view
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
<div bind:this={container} data-scrollbox class="relative max-h-[40vh] w-full overflow-y-auto px-2 no-scrollbar">
	<!-- click-outside-to-deselect kept; Escape covers the keyboard path, see docs/implementation-notes/click-outside-deselect.md -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		bind:this={lineContainer}
		role={isLineMode ? undefined : 'listbox'}
		tabindex={isLineMode ? undefined : -1}
		aria-multiselectable={isLineMode ? undefined : true}
		aria-label={isLineMode ? undefined : 'Source tokens'}
		class="flex w-full flex-wrap content-start gap-[1px] justify-center bg-transparent font-wenkai text-3xl font-light"
		class:select-none={isLinkMode}
		onclick={handleContainerClick}
	>
		{#each tokens as token, i (i)}
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
			{#if i < tokens.length - 1}
				{#if tokens[i + 1].line !== token.line}
					<button
						class="merge-zone"
						class:line-active={isLineMode}
						data-divisor-index={i}
						tabindex={-1}
						onclick={(e) => {
							e.stopPropagation();
							if (isLineMode) handleMerge(token.line);
						}}
						aria-label="Merge with next line"
					>
						<span class="merge-indicator"></span>
					</button>
				{:else}
					<button
						class="split-zone"
						class:line-active={isLineMode}
						data-divisor-index={i}
						tabindex={-1}
						onclick={(e) => {
							e.stopPropagation();
							if (isLineMode) handleSplit(i);
						}}
						onmouseenter={() => {
							if (isLineMode) redistributeRow(lineContainer, i, { max: 8, perGap: 2 });
						}}
						onmouseleave={() => clearRedistribute(lineContainer)}
						onfocus={() => {
							if (isLineMode) redistributeRow(lineContainer, i, { max: 8, perGap: 2 });
						}}
						onblur={() => clearRedistribute(lineContainer)}
						aria-label="Split line here"
					>
						<span class="split-indicator"></span>
					</button>
				{/if}
			{/if}
		{/each}
	</div>
</div>

<style>
	/* Persistent token spans crossfade color/opacity when the mode changes
	   instead of snapping (only possible because the element is never swapped). */
	.tok {
		/* --rd-x: per-token offset for the line-mode divisor-hover redistribution
		   (see actions/redistribute.ts). Resting value is 0. */
		transform: translateX(var(--rd-x, 0));
		transition:
			color 280ms ease,
			opacity 280ms ease,
			transform 150ms ease;
	}

	.split-zone {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 8px;
		margin: 0 -4px;
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
		transition: opacity 150ms;
	}

	:global(html[data-interaction='mouse']) .split-zone.line-active:hover .split-indicator,
	:global(html[data-interaction='keyboard'])
		.split-zone.line-active:focus-visible
		.split-indicator {
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
		cursor: pointer;
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
	}

	.merge-zone:not(.line-active) {
		pointer-events: none;
	}

	.merge-indicator {
		display: block;
		width: 2.5rem;
		height: var(--line-tool-width);
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

	:global(html[data-interaction='mouse']) .merge-zone.line-active:hover .merge-indicator,
	:global(html[data-interaction='keyboard'])
		.merge-zone.line-active:focus-visible
		.merge-indicator {
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
