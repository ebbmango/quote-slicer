<script lang="ts">
	import type { RawSourceToken } from '$lib/tokenize';

	let { tokens }: { tokens: RawSourceToken[] } = $props();
</script>

<div
	class="flex max-h-[40vh] w-full flex-wrap content-start justify-center overflow-y-auto bg-transparent font-wenkai text-3xl font-light opacity-30"
>
	{#each tokens as token (token)}
		<span data-type={token.type} class={token.type === 'whitespace' ? 'whitespace-pre' : ''}>{token.text}</span>
	{/each}
</div>
