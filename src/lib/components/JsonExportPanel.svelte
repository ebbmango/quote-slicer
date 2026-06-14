<script lang="ts">
	import HighlightedCode from '$lib/components/HighlightedCode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { formatExport } from '$lib/exportFormat';
	import { colors } from '$lib/constants/colors';

	const alignment = getAlignmentContext();

	const exportJson = $derived(formatExport(alignment.exportData));
</script>

<div class="shiki-export h-full w-full overflow-auto p-6 text-xs no-scrollbar">
	<HighlightedCode
		code={exportJson}
		colorReplacements={{
			dracula: {
				// strings
				'#f1fa8c': colors.compostella.base,
				'#e9f284': colors.compostella.base,
				// properties
				'#8be9fe': '#A8A8A8',
				'#8be9fd': '#A8A8A8',
				// colons & brackets
				'#ff79c6': '#A8A8A8',
				'#f8f8f2': '#A8A8A8',
				// numbers
				'#bd93f9': colors.azure.base,
				// undefined
				'#ff5555': colors.sugar.base
			}
		}}
	/>
</div>

<style lang="postcss">
	.shiki-export :global(pre) {
		background: transparent !important;
	}
</style>
