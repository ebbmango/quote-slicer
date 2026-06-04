<script lang="ts">
	import type { RawTargetToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getLinkContext } from '$lib/context/link.svelte';

	let { tokens }: { tokens: RawTargetToken[] } = $props();

	let mode = getModeContext();
	let link = getLinkContext();
	let isLinkMode = $derived(mode.current === 'link');

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
		const s = link.getTargetTokenState(i);
		if (s.kind === 'active') return `color: ${s.color};`;
		if (s.kind === 'idle') return `color: ${s.color}; opacity: 0.5;`;
		return '';
	}

	function tokenOpacity(i: number): string {
		if (!isLinkMode) return '';
		const s = link.getTargetTokenState(i);
		if (s.kind === 'unmapped') return 'opacity-30';
		return '';
	}
</script>

<div
	role="listbox"
	aria-multiselectable="true"
	aria-label="Target tokens"
	class="flex max-h-[25vh] w-full flex-wrap content-start justify-center overflow-y-auto bg-transparent font-ss4 text-base font-[350] italic"
	onkeydown={handleContainerKeydown}
	onclick={handleContainerClick}
>
	{#each tokens as token, i (token)}
		<span
			data-type={token.type}
			role={isLinkMode && token.type !== 'whitespace' ? 'option' : undefined}
			aria-selected={isLinkMode && token.type !== 'whitespace' ? link.getTargetTokenState(i).kind === 'active' : undefined}
			tabindex={isLinkMode && token.type !== 'whitespace' ? 0 : undefined}
			class={token.type === 'whitespace' ? 'whitespace-pre' : (tokenOpacity(i) + (isLinkMode ? ' cursor-pointer' : ''))}
			style={tokenStyle(i)}
			onclick={() => handleClick(i)}
			onkeydown={(e) => handleKeydown(e, i)}
		>{token.text}</span>
	{/each}
</div>
