<script lang="ts">
	import type { RawSourceToken } from '$lib/tokenize';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getLinkContext } from '$lib/context/link.svelte';
	import { longpress } from '$lib/actions/longpress';

	let { tokens }: { tokens: RawSourceToken[] } = $props();

	let container: HTMLDivElement;
	let mode = getModeContext();
	let link = getLinkContext();
	let isLinkMode = $derived(mode.current === 'link');
	let focusedIndex: number | null = $state(null);

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

	function handleClick(e: MouseEvent, i: number) {
		if (!isLinkMode) return;
		link.clickSource(i, e.metaKey || e.ctrlKey);
	}

	function handleKeydown(e: KeyboardEvent, i: number) {
		if (!isLinkMode) return;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			link.clickSource(i, e.altKey);
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
		const token = tokens[i];
		if (token.type === 'punctuation') return '';
		const s = link.getSourceTokenState(i);
		const focused = focusedIndex === i;
		if (s.kind === 'active') return `color: ${s.color};`;
		if (s.kind === 'idle' && focused) return `color: ${s.color};`;
		return '';
	}

	function tokenOpacity(i: number): string {
		if (!isLinkMode) return 'opacity-30';
		const token = tokens[i];
		if (token.type === 'punctuation') return 'opacity-30';
		const s = link.getSourceTokenState(i);
		const focused = focusedIndex === i;
		if (s.kind === 'unmapped') return focused ? 'opacity-50' : 'opacity-30';
		if (s.kind === 'idle') return 'opacity-70';
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
		class:select-none={isLinkMode}
		onkeydown={handleContainerKeydown}
		onclick={handleContainerClick}
	>
		{#each tokens as token, i (token)}
			{@const interactive = isLinkMode && token.type !== 'whitespace' && token.type !== 'punctuation'}
			<span
				data-type={token.type}
				role={interactive ? 'option' : undefined}
				aria-selected={interactive ? link.getSourceTokenState(i).kind === 'active' : undefined}
				tabindex={interactive ? 0 : undefined}
				class={token.type === 'whitespace' ? 'whitespace-pre' : (tokenOpacity(i) + (interactive ? ' cursor-pointer outline-none' : ''))}
				style={tokenStyle(i)}
				onclick={(e) => interactive && handleClick(e, i)}
				onkeydown={(e) => interactive && handleKeydown(e, i)}
				onfocus={(e) => { if (interactive && e.currentTarget.matches(':focus-visible')) focusedIndex = i; }}
				onblur={() => { focusedIndex = null; }}
				use:longpress={{ duration: 500 }}
				onlongpress={() => interactive && link.clickSource(i, true)}
			>{token.text}</span>
		{/each}
	</div>
</div>
