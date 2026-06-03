<script lang="ts">
	import type { RawTargetToken } from '$lib/tokenize';

	let { tokens }: { tokens: RawTargetToken[] } = $props();
</script>

<div
	class="flex max-h-[25vh] w-full flex-wrap content-start justify-center overflow-y-auto bg-transparent font-ss4 text-base font-[350] italic"
>
	{#each tokens as token (token)}
		<span data-type={token.type} class={token.type === 'whitespace' ? 'whitespace-pre' : ''}>{token.text}</span>
	{/each}
</div>
