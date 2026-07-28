<script lang="ts">
	import { fade } from 'svelte/transition';
	import icons from '$lib/assets/icons.json';
	import IconToggleButton from '$lib/components/IconToggleButton.svelte';
	import { getToolContext } from '$lib/context/tool.svelte';
	import { getBreakpointContext } from '$lib/context/breakpoints.svelte';

	let {
		asideView = $bindable(),
		modalOpen,
		openModal,
		closeModal
	}: {
		asideView: 'maps' | 'json';
		modalOpen: boolean;
		openModal: (view: 'maps' | 'json') => void;
		closeModal: () => void;
	} = $props();

	const toolCtx = getToolContext();
	const breakpoints = getBreakpointContext();
	const isMiniLayout = $derived(breakpoints.layoutMode === 'mini');
	const showDataToggle = $derived(breakpoints.layoutMode !== 'dual');

	const mapsIcon = {
		viewBox: icons['objects-column'].viewBox,
		path: icons['objects-column'].classic.light
	};
	const jsonIcon = {
		viewBox: icons['curly-brackets'].viewBox,
		path: icons['curly-brackets'].classic.light
	};

	function dataActive(view: 'maps' | 'json') {
		return isMiniLayout ? modalOpen && asideView === view : asideView === view;
	}

	function toggleData(view: 'maps' | 'json') {
		if (!isMiniLayout) {
			asideView = view;
			return;
		}
		if (modalOpen && asideView === view) closeModal();
		else openModal(view);
	}
</script>

<div
	id="tools"
	class="flex h-full w-full flex-col items-center justify-center gap-2"
	in:fade={{ duration: 300, delay: 250 }}
>
	<!-- data-keep-selection: swapping maps/json must not deselect the active mapping
	     (globalShortcuts click-to-deselect). The link/line/view group below is NOT
	     marked, so switching tool still deselects. -->
	{#if showDataToggle}
		<div class="flex gap-2" data-keep-selection>
			<IconToggleButton
				icon={mapsIcon}
				label="maps"
				testid={isMiniLayout ? 'maps-modal' : 'maps-aside'}
				active={dataActive('maps')}
				onclick={() => toggleData('maps')}
			/>
			<IconToggleButton
				icon={jsonIcon}
				label="json"
				testid={isMiniLayout ? 'json-modal' : 'json-aside'}
				active={dataActive('json')}
				onclick={() => toggleData('json')}
			/>
		</div>
	{/if}
	<div class="flex gap-1.5">
		<IconToggleButton
			icon={{ viewBox: icons.language.viewBox, path: icons.language.sharp.light }}
			label="link"
			tabindex={1}
			active={toolCtx.current === 'link'}
			onclick={() => (toolCtx.current = 'link')}
		/>
		<IconToggleButton
			icon={{ viewBox: icons.paragraph.viewBox, path: icons.paragraph.sharp.light }}
			label="line"
			tabindex={2}
			active={toolCtx.current === 'line'}
			onclick={() => (toolCtx.current = 'line')}
		/>
		<IconToggleButton
			icon={{ viewBox: icons.eye.viewBox, path: icons.eye.classic.light }}
			label="view"
			tabindex={3}
			active={toolCtx.current === 'view'}
			onclick={() => (toolCtx.current = 'view')}
		/>
	</div>
</div>

<style lang="postcss">
	#tools :global(button) {
		@apply transition-opacity duration-300;
	}

	@media (hover: hover) {
		#tools :global(button.opacity-20:hover) {
			@apply opacity-60;
		}
	}

	#tools :global(button.opacity-20:focus-visible) {
		@apply opacity-60;
	}
</style>
