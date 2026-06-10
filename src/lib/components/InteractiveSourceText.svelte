<script lang="ts">
	import type { SourceToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { longpress } from '$lib/actions/longpress';
	import { createFlipTransition } from '$lib/animation/flipTransition.svelte';

	let {
		tokens,
		onSplit,
		onMerge
	}: {
		tokens: SourceToken[];
		onSplit: (afterIndex: number) => void;
		onMerge: (lineN: number) => void;
	} = $props();

	let container: HTMLDivElement;
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

	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		tokens;
		if (!container) return;
		const fit = () => {
			container.style.height = 'auto';
			container.style.height = container.scrollHeight + 'px';
		};
		fit();
		window.addEventListener('resize', fit);
		return () => window.removeEventListener('resize', fit);
	});

	function handleClick(e: MouseEvent, i: number) {
		if (!isLinkMode) return;
		alignment.toggleSource(i, { force: e.metaKey || e.ctrlKey });
	}

	function handleKeydown(e: KeyboardEvent, i: number) {
		if (!isLinkMode) return;
		if (!e.altKey || e.key !== ' ') return;
		e.preventDefault();
		alignment.toggleSource(i, { force: e.shiftKey });
	}

	function handleContainerKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') alignment.deselect();
	}

	function handleContainerClick(e: MouseEvent) {
		if (e.target === e.currentTarget) alignment.deselect();
	}

	function tokenStyle(i: number): string {
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
		if (!isLinkMode) return 'opacity-30';
		const token = tokens[i];
		if (token.type === 'punctuation') return 'opacity-30';
		const s = alignment.stateOfSource(i);
		const focused = focusedIndex === i;
		if (s.kind === 'unmapped') return focused ? 'opacity-50' : 'opacity-30';
		if (s.kind === 'idle') return 'opacity-70';
		return '';
	}
</script>

<div bind:this={container} class="max-h-[40vh] w-full overflow-y-auto px-2">
	{#if isLineMode}
		<div bind:this={lineContainer} class="flex w-full flex-wrap justify-center bg-transparent font-wenkai text-3xl font-light">
			{#each tokens as token, i (i)}
				<span data-flip-id="src-{i}" class="opacity-70" data-type={token.type}>{token.text}</span>
				{#if i < tokens.length - 1}
					{#if tokens[i + 1].line !== token.line}
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
					{:else}
						<button
							class="split-zone"
							onclick={(e) => {
								e.stopPropagation();
								handleSplit(i);
							}}
							aria-label="Split line here"
						>
							<span class="split-indicator"></span>
						</button>
					{/if}
				{/if}
			{/each}
		</div>
	{:else}
		<div
			role="listbox"
			tabindex="-1"
			aria-multiselectable="true"
			aria-label="Source tokens"
			class="flex w-full flex-wrap content-start justify-center bg-transparent font-wenkai text-3xl font-light"
			class:select-none={isLinkMode}
			onkeydown={handleContainerKeydown}
			onclick={handleContainerClick}
		>
			{#each tokens as token, i (token)}
				{#if i > 0 && token.line !== tokens[i - 1].line}
					<div class="w-full"></div>
				{/if}
				{@const interactive = isLinkMode && token.type !== 'punctuation'}
				{#if interactive}
					<span
						data-type={token.type}
						data-token-index={i}
						role="option"
						aria-selected={alignment.stateOfSource(i).kind === 'active'}
						tabindex="-1"
						class={tokenOpacity(i) + ' cursor-pointer duration-180 outline-none'}
						style={tokenStyle(i)}
						onclick={(e) => handleClick(e, i)}
						onkeydown={(e) => handleKeydown(e, i)}
						onfocus={(e) => {
							if (e.currentTarget.matches(':focus-visible')) focusedIndex = i;
						}}
						onblur={() => {
							focusedIndex = null;
						}}
						use:longpress={{ duration: 500, onlongpress: () => alignment.toggleSource(i, { force: true }) }}
						>{token.text}</span
					>
				{:else}
					<span data-type={token.type} class={tokenOpacity(i)} style={tokenStyle(i)}
						>{token.text}</span
					>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
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

	.split-indicator {
		display: block;
		width: 1.5px;
		height: 0.85em;
		background: currentColor;
		opacity: 0;
		border-radius: 1px;
		transition: opacity 150ms;
	}

	.split-zone:hover .split-indicator,
	.split-zone:focus-visible .split-indicator {
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
</style>
