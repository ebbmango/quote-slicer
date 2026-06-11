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
		flip.run(lineContainer, () => onSplit(globalIndex));
	}

	function handleMerge(lineN: number) {
		flip.run(lineContainer, () => onMerge(lineN));
	}

	function handleClick(i: number) {
		if (!isLinkMode) return;
		alignment.toggleTarget(i);
	}

	function handleContainerClick(e: MouseEvent) {
		if (e.target === e.currentTarget) alignment.deselect();
	}

	function tokenStyle(i: number): string {
		if (!isLinkMode) return '';
		const transition = 'transition: color 280ms ease, font-weight 280ms ease;';
		const s = alignment.stateOfTarget(i);
		const focused = focusedIndex === i;
		if (s.kind === 'active' && focused)
			return `${transition} color: ${s.color}; font-weight: 600; filter: brightness(0.75);`;
		if (s.kind === 'active') return `${transition} color: ${s.color}; font-weight: 600;`;
		if (s.kind === 'idle' && focused) return `${transition} color: ${s.color}; font-weight: 350;`;
		return `${transition} font-weight: 350;`;
	}

	function tokenOpacity(i: number): string {
		if (!isLinkMode) return '';
		const s = alignment.stateOfTarget(i);
		const focused = focusedIndex === i;
		if (s.kind === 'unmapped') return focused ? 'opacity-50' : 'opacity-30';
		if (s.kind === 'idle') return 'opacity-70';
		return '';
	}
</script>

{#if isLineMode}
	<div
		bind:this={lineContainer}
		class="flex max-h-[40vh] w-full flex-wrap content-start justify-center overflow-y-auto bg-transparent px-2 font-ss4 text-base font-[350] italic"
	>
		{#each tokens as token, i (i)}
			{@const isBoundary =
				token.type === 'whitespace' && i < tokens.length - 1 && tokens[i + 1].line !== token.line}
			{#if isBoundary}
				<button
					data-flip-id="tgt-{i}"
					class="ws-boundary"
					onclick={(e) => {
						e.stopPropagation();
						handleMerge(token.line);
					}}
					aria-label="Merge lines">{token.text}</button
				>
				<button
					class="merge-zone"
					onclick={(e) => {
						e.stopPropagation();
						handleMerge(token.line);
					}}
					aria-label="Merge with next line"
				>
					<span class="merge-indicator"></span>
				</button>
			{:else if token.type === 'whitespace'}
				<button
					data-flip-id="tgt-{i}"
					class="ws-split"
					onclick={(e) => {
						e.stopPropagation();
						handleSplit(i);
					}}
					aria-label="Split line here">{token.text}</button
				>
			{:else}
				<span data-flip-id="tgt-{i}" class="opacity-70" data-type={token.type}>{token.text}</span>
			{/if}
		{/each}
	</div>
{:else}
	<!-- click-outside-to-deselect kept; Escape covers the keyboard path, see docs/implementation-notes/click-outside-deselect.md -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		role="listbox"
		tabindex="-1"
		aria-multiselectable="true"
		aria-label="Target tokens"
		class="flex max-h-[40vh] w-full flex-wrap content-start justify-center overflow-y-auto bg-transparent px-2 font-ss4 text-base font-[350] italic"
		class:select-none={isLinkMode}
		onclick={handleContainerClick}
	>
		{#each tokens as token, i (token)}
			{#if i > 0 && token.line !== tokens[i - 1].line}
				<div class="w-full"></div>
			{/if}
			{@const interactive = isLinkMode && token.type !== 'whitespace'}
			{#if interactive}
				<span
					data-type={token.type}
					data-token-index={i}
					role="option"
					aria-selected={alignment.stateOfTarget(i).kind === 'active'}
					tabindex="-1"
					class={tokenOpacity(i) + ' cursor-pointer outline-none'}
					style={tokenStyle(i)}
					onclick={() => handleClick(i)}
					onkeydown={(e) => {
						if (e.key !== 'Enter' && e.key !== ' ') return;
						e.preventDefault();
						alignment.toggleTarget(i);
					}}
					onfocus={(e) => {
						if (e.currentTarget.matches(':focus-visible')) focusedIndex = i;
					}}
					onblur={() => {
						focusedIndex = null;
					}}>{token.text}</span
				>
			{:else}
				<span
					data-type={token.type}
					class={token.type === 'whitespace' ? 'whitespace-pre' : tokenOpacity(i)}
					style={tokenStyle(i)}>{token.text}</span
				>
			{/if}
		{/each}
	</div>
{/if}

<style>
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

	.ws-split::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 1.5px;
		height: 0.85em;
		background: currentColor;
		opacity: 0;
		border-radius: 1px;
		transition: opacity 150ms;
	}

	.ws-split:hover::after,
	.ws-split:focus-visible::after {
		opacity: 0.4;
	}

	.merge-zone {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 1rem;
		padding: 0.25rem 0;
		background: none;
		border: none;
		cursor: pointer;
		outline: none;
	}

	.merge-indicator {
		display: block;
		width: 2.5rem;
		height: 1.5px;
		background: currentColor;
		opacity: 0.15;
		border-radius: 1px;
		transition: opacity 150ms;
	}

	.merge-zone:hover .merge-indicator,
	.merge-zone:focus-visible .merge-indicator {
		opacity: 0.45;
	}

	.ws-boundary {
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

	/* Horizontal line = merge (as opposed to split's vertical line) */
	.ws-boundary::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 0.75em;
		height: 1.5px;
		background: currentColor;
		opacity: 0;
		border-radius: 1px;
		transition: opacity 150ms;
	}

	.ws-boundary:hover::after,
	.ws-boundary:focus-visible::after {
		opacity: 0.4;
	}
</style>
