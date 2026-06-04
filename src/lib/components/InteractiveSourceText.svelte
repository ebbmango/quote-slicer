<script lang="ts">
	import type { RawSourceToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getLinkContext } from '$lib/context/link.svelte';

	let { tokens }: { tokens: RawSourceToken[] } = $props();

	let container: HTMLDivElement;
	let mode = getModeContext();
	let link = getLinkContext();
	let isLinkMode = $derived(mode.current === 'link');

	$effect(() => {
		tokens; // re-run when tokens change
		if (!container) return;
		const fit = () => {
			container.style.height = 'auto';
			container.style.height = container.scrollHeight + 'px';
		};
		fit();
		window.addEventListener('resize', fit);
		return () => window.removeEventListener('resize', fit);
	});

	function handleClick(i: number) {
		if (!isLinkMode) return;
		link.clickSource(i);
	}

	function handleKeydown(e: KeyboardEvent, i: number) {
		if (!isLinkMode) return;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			link.clickSource(i);
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
		const s = link.getSourceTokenState(i);
		if (s.kind === 'active') return `color: ${s.color};`;
		if (s.kind === 'idle') return `color: ${s.color}; opacity: 0.5;`;
		return '';
	}

	function tokenOpacity(i: number): string {
		if (!isLinkMode) return 'opacity-30';
		const s = link.getSourceTokenState(i);
		if (s.kind === 'unmapped') return 'opacity-30';
		return '';
	}
</script>

<div
	bind:this={container}
	class="max-h-[40vh] w-full overflow-y-auto"
>
	<div
		role="listbox"
		aria-multiselectable="true"
		aria-label="Source tokens"
		class="flex w-full flex-wrap content-start justify-center bg-transparent font-wenkai text-3xl font-light"
		onkeydown={handleContainerKeydown}
		onclick={handleContainerClick}
	>
		{#each tokens as token, i (token)}
			<span
				data-type={token.type}
				role={isLinkMode && token.type !== 'whitespace' ? 'option' : undefined}
				aria-selected={isLinkMode && token.type !== 'whitespace' ? link.getSourceTokenState(i).kind === 'active' : undefined}
				tabindex={isLinkMode && token.type !== 'whitespace' ? 0 : undefined}
				class={token.type === 'whitespace' ? 'whitespace-pre' : (tokenOpacity(i) + (isLinkMode ? ' cursor-pointer' : ''))}
				style={tokenStyle(i)}
				onclick={() => handleClick(i)}
				onkeydown={(e) => handleKeydown(e, i)}
			>{token.text}</span>
		{/each}
	</div>
</div>
