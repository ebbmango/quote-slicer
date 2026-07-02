<script lang="ts">
	import MappingsList from '$lib/components/MappingsList.svelte';
	import JsonExportPanel from '$lib/components/JsonExportPanel.svelte';

	let { view }: { view: 'maps' | 'json' } = $props();
</script>

<div class="fade-edges h-full w-full">
	{#if view === 'maps'}
		<MappingsList />
	{:else}
		<JsonExportPanel />
	{/if}
</div>

<style lang="postcss">
	.fade-edges {
		--fade: 24px;
		/* Smoothstep-eased ramp: alpha slope is 0 at both the transparent edge
		   and the opaque junction, so neither end shows a visible kink. */
		--ramp-y:
			transparent 0, rgba(0, 0, 0, 0.06) calc(var(--fade) * 0.15),
			rgba(0, 0, 0, 0.22) calc(var(--fade) * 0.3), rgba(0, 0, 0, 0.5) calc(var(--fade) * 0.5),
			rgba(0, 0, 0, 0.78) calc(var(--fade) * 0.7), rgba(0, 0, 0, 0.94) calc(var(--fade) * 0.85),
			black var(--fade), black calc(100% - var(--fade)),
			rgba(0, 0, 0, 0.94) calc(100% - var(--fade) * 0.85),
			rgba(0, 0, 0, 0.78) calc(100% - var(--fade) * 0.7),
			rgba(0, 0, 0, 0.5) calc(100% - var(--fade) * 0.5),
			rgba(0, 0, 0, 0.22) calc(100% - var(--fade) * 0.3),
			rgba(0, 0, 0, 0.06) calc(100% - var(--fade) * 0.15), transparent 100%;
		mask-image: linear-gradient(to bottom, var(--ramp-y)), linear-gradient(to right, var(--ramp-y));
		mask-composite: intersect;
		-webkit-mask-image:
			linear-gradient(to bottom, var(--ramp-y)), linear-gradient(to right, var(--ramp-y));
		-webkit-mask-composite: source-in;
	}
</style>
