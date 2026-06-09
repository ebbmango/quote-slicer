<script lang="ts">
	import type { RawTargetToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getLinkContext } from '$lib/context/link.svelte';
	import { groupByLine } from '$lib/line';

	let { tokens, onSplit, onMerge }: {
		tokens: RawTargetToken[];
		onSplit: (afterIndex: number) => void;
		onMerge: (lineN: number) => void;
	} = $props();

	let mode = getModeContext();
	let link = getLinkContext();
	let isLinkMode = $derived(mode.current === 'link');
	let isLineMode = $derived(mode.current === 'line');
	let focusedIndex: number | null = $state(null);

	let lineGroups = $derived(groupByLine(tokens));

	function handleClick(i: number) {
		if (!isLinkMode) return;
		link.clickTarget(i);
	}

	function handleKeydown(e: KeyboardEvent, i: number) {
		if (!isLinkMode) return;
		if (!e.altKey || e.key !== ' ') return;
		e.preventDefault();
		link.clickTarget(i);
	}

	function handleContainerKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') link.deselect();
	}

	function handleContainerClick(e: MouseEvent) {
		if (e.target === e.currentTarget) link.deselect();
	}

	function tokenStyle(i: number): string {
		if (!isLinkMode) return '';
		const transition = 'transition: color 280ms ease, font-weight 280ms ease;';
		const s = link.getTargetTokenState(i);
		const focused = focusedIndex === i;
		if (s.kind === 'active' && focused) return `${transition} color: ${s.color}; font-weight: 600; filter: brightness(0.75);`;
		if (s.kind === 'active') return `${transition} color: ${s.color}; font-weight: 600;`;
		if (s.kind === 'idle' && focused) return `${transition} color: ${s.color}; font-weight: 350;`;
		return `${transition} font-weight: 350;`;
	}

	function tokenOpacity(i: number): string {
		if (!isLinkMode) return '';
		const s = link.getTargetTokenState(i);
		const focused = focusedIndex === i;
		if (s.kind === 'unmapped') return focused ? 'opacity-50' : 'opacity-30';
		if (s.kind === 'idle') return 'opacity-70';
		return '';
	}
</script>

{#if isLineMode}
	<div
		class="flex w-full flex-col items-center bg-transparent font-ss4 text-base font-[350] italic"
		onkeydown={handleContainerKeydown}
		onclick={handleContainerClick}
	>
		{#each lineGroups as { lineNum, group }, lineIndex}
			<div class="flex flex-wrap justify-center w-full">
				{#each group as { token, globalIndex }, i}
					{@const isBoundary = token.type === 'whitespace' && i === group.length - 1 && lineIndex < lineGroups.length - 1}
					{#if isBoundary}
						<button
							class="ws-boundary"
							onclick={(e) => { e.stopPropagation(); onMerge(lineNum); }}
							aria-label="Merge lines"
						>{token.text}</button>
					{:else if token.type === 'whitespace'}
						<button
							class="ws-split"
							onclick={(e) => { e.stopPropagation(); onSplit(globalIndex); }}
							aria-label="Split line here"
						>{token.text}</button>
					{:else}
						<span class="opacity-70" data-type={token.type}>{token.text}</span>
					{/if}
				{/each}
			</div>
			{#if lineIndex < lineGroups.length - 1}
				<button
					class="merge-zone"
					onclick={(e) => { e.stopPropagation(); onMerge(lineNum); }}
					aria-label="Merge with next line"
				>
					<span class="merge-indicator"></span>
				</button>
			{/if}
		{/each}
	</div>
{:else}
	<div
		role="listbox"
		aria-multiselectable="true"
		aria-label="Target tokens"
		class="flex max-h-[40vh] w-full flex-wrap content-start justify-center overflow-y-auto px-2 bg-transparent font-ss4 text-base font-[350] italic"
		class:select-none={isLinkMode}
		onkeydown={handleContainerKeydown}
		onclick={handleContainerClick}
	>
		{#each tokens as token, i (token)}
			{#if i > 0 && token.line !== tokens[i - 1].line}
				<div class="w-full"></div>
			{/if}
			<span
				data-type={token.type}
				data-token-index={isLinkMode && token.type !== 'whitespace' ? i : undefined}
				role={isLinkMode && token.type !== 'whitespace' ? 'option' : undefined}
				aria-selected={isLinkMode && token.type !== 'whitespace' ? link.getTargetTokenState(i).kind === 'active' : undefined}
				tabindex={isLinkMode && token.type !== 'whitespace' ? -1 : undefined}
				class={token.type === 'whitespace' ? 'whitespace-pre' : (tokenOpacity(i) + (isLinkMode ? ' cursor-pointer outline-none' : ''))}
				style={tokenStyle(i)}
				onclick={() => handleClick(i)}
				onkeydown={(e) => handleKeydown(e, i)}
				onfocus={(e) => { if (isLinkMode && token.type !== 'whitespace' && e.currentTarget.matches(':focus-visible')) focusedIndex = i; }}
				onblur={() => { focusedIndex = null; }}
			>{token.text}</span>
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
