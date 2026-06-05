<script lang="ts">
	import type { RawTargetToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getLinkContext } from '$lib/context/link.svelte';

	let { tokens }: { tokens: RawTargetToken[] } = $props();

	let mode = getModeContext();
	let link = getLinkContext();
	let isLinkMode = $derived(mode.current === 'link');
	let focusedIndex: number | null = $state(null);

	function handleClick(i: number) {
		if (!isLinkMode) return;
		link.clickTarget(i);
	}

	function handleKeydown(e: KeyboardEvent, i: number) {
		if (!isLinkMode) return;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			link.clickTarget(i);
		}
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

<div
	role="listbox"
	aria-multiselectable="true"
	aria-label="Target tokens"
	class="flex max-h-[25vh] w-full flex-wrap content-start justify-center overflow-y-auto bg-transparent font-ss4 text-base font-[350] italic"
	class:select-none={isLinkMode}
	onkeydown={handleContainerKeydown}
	onclick={handleContainerClick}
>
	{#each tokens as token, i (token)}
		<span
			data-type={token.type}
			role={isLinkMode && token.type !== 'whitespace' ? 'option' : undefined}
			aria-selected={isLinkMode && token.type !== 'whitespace' ? link.getTargetTokenState(i).kind === 'active' : undefined}
			tabindex={isLinkMode && token.type !== 'whitespace' ? 0 : undefined}
			class={token.type === 'whitespace' ? 'whitespace-pre' : (tokenOpacity(i) + (isLinkMode ? ' cursor-pointer outline-none' : ''))}
			style={tokenStyle(i)}
			onclick={() => handleClick(i)}
			onkeydown={(e) => handleKeydown(e, i)}
			onfocus={(e) => { if (isLinkMode && token.type !== 'whitespace' && e.currentTarget.matches(':focus-visible')) focusedIndex = i; }}
			onblur={() => { focusedIndex = null; }}
		>{token.text}</span>
	{/each}
</div>
