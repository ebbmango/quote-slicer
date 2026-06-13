<script lang="ts">
	import type { TargetToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { createFlipTransition } from '$lib/animation/flipTransition.svelte';
	let {
		tokens,
		onSplit,
		onMerge
	}: {
		tokens: TargetToken[];
		onSplit: (afterIndex: number) => void;
		onMerge: (lineN: number) => void;
	} = $props();

	let lineContainer: HTMLDivElement = $state()!;
	let mode = getModeContext();
	let alignment = getAlignmentContext();
	let isLinkMode = $derived(mode.current === 'link');
	let isLineMode = $derived(mode.current === 'line');
	let focusedIndex: number | null = $state(null);

	const flip = createFlipTransition();

	function handleSplit(globalIndex: number) {
		flip.run(lineContainer, lineContainer, () => onSplit(globalIndex));
	}

	function handleMerge(lineN: number) {
		flip.run(lineContainer, lineContainer, () => onMerge(lineN));
	}

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		tokens;
		// Keep the scroll box at `auto` so it follows the separator height
		// transitions that animate the mode change; flip.run owns the height
		// during a split/merge tween.
		if (!lineContainer || flip.animating) return;
		lineContainer.style.height = '';
	});

	function handleClick(i: number) {
		if (!isLinkMode) return;
		alignment.toggleTarget(i);
	}

	function handleContainerClick(e: MouseEvent) {
		if (e.target === e.currentTarget) alignment.deselect();
	}

	function tokenStyle(i: number): string {
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
		if (!isLinkMode) return 'opacity-30'; // view
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
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_tabindex -->
<div
	bind:this={lineContainer}
	role={isLineMode ? undefined : 'listbox'}
	tabindex={isLineMode ? undefined : -1}
	aria-multiselectable={isLineMode ? undefined : true}
	aria-label={isLineMode ? undefined : 'Target tokens'}
	class="relative no-scrollbar flex max-h-[40vh] w-full flex-wrap content-start justify-center overflow-y-auto bg-transparent px-2 font-ss4 text-base font-[350] italic"
	class:select-none={isLinkMode}
	onclick={handleContainerClick}
>
	{#each tokens as token, i (i)}
		{@const isBoundary =
			token.type === 'whitespace' && i < tokens.length - 1 && tokens[i + 1].line !== token.line}
		{#if isBoundary}
			<button
				data-flip-id="tgt-{i}"
				class="merge-zone"
				class:line-active={isLineMode}
				tabindex={isLineMode ? undefined : -1}
				onclick={(e) => {
					e.stopPropagation();
					if (isLineMode) handleMerge(token.line);
				}}
				aria-label="Merge with next line"
			>
				<span class="merge-indicator"></span>
			</button>
		{:else if token.type === 'whitespace'}
			<button
				data-flip-id="tgt-{i}"
				class="ws-split"
				class:line-active={isLineMode}
				tabindex={isLineMode ? undefined : -1}
				onclick={(e) => {
					e.stopPropagation();
					if (isLineMode) handleSplit(i);
				}}
				aria-label="Split line here">{token.text}</button
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
				onkeydown={(e) => {
					if (!isLinkMode || (e.key !== 'Enter' && e.key !== ' ')) return;
					e.preventDefault();
					alignment.toggleTarget(i);
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
	.tok {
		transition:
			color 280ms ease,
			opacity 280ms ease,
			font-weight 280ms ease;
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
		padding: 0;
		cursor: pointer;
		outline: none;
		white-space: pre;
		opacity: 0.7;
	}

	.ws-split:not(.line-active) {
		pointer-events: none;
	}

	.ws-split::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: var(--line-tool-width);
		height: 0.85em;
		background: repeating-linear-gradient(
			to bottom,
			var(--line-tool-color) 0 var(--line-tool-dash),
			transparent var(--line-tool-dash) calc(var(--line-tool-dash) + var(--line-tool-gap))
		);
		opacity: var(--line-tool-opacity-idle);
		transition: opacity 150ms;
	}

	.ws-split.line-active:hover::after,
	.ws-split.line-active:focus-visible::after {
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
		cursor: pointer;
		outline: none;
		transition: height 350ms ease;
	}

	/* See matching note in InteractiveSourceText.svelte: a headless probe found
	   `height` on this flex item computing to 0px while `min-height` worked,
	   though it rendered fine in a real browser. Swap to `min-height` if this
	   ever turns into a real symptom. */
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
		background: repeating-linear-gradient(
			to right,
			var(--line-tool-color) 0 var(--line-tool-dash),
			transparent var(--line-tool-dash) calc(var(--line-tool-dash) + var(--line-tool-gap))
		);
		opacity: var(--line-tool-opacity-idle-merge);
		transition: opacity 150ms;
	}

	.merge-zone.line-active:hover .merge-indicator,
	.merge-zone.line-active:focus-visible .merge-indicator {
		opacity: var(--line-tool-opacity-hover);
	}

	@media (prefers-reduced-motion: reduce) {
		.tok,
		.merge-zone {
			transition: none;
		}
	}
</style>
