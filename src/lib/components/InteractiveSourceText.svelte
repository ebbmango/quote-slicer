<script lang="ts">
	import type { RawSourceToken } from '$lib/tokenize';

	let { tokens }: { tokens: RawSourceToken[] } = $props();

	let container: HTMLDivElement;

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
</script>

<div
	bind:this={container}
	class="max-h-[40vh] w-full overflow-y-auto"
>
	<div
		class="flex w-full flex-wrap content-start justify-center bg-transparent font-wenkai text-3xl font-light opacity-30"
	>
		{#each tokens as token (token)}
			<span data-type={token.type} class={token.type === 'whitespace' ? 'whitespace-pre' : ''}>{token.text}</span>
		{/each}
	</div>
</div>
