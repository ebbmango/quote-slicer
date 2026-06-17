<script lang="ts">
	import { fade } from 'svelte/transition';
	import icons from '$lib/assets/icons.json';
	import IconToggleButton from '$lib/components/IconToggleButton.svelte';
	import { getModeContext } from '$lib/context/mode.svelte';

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

	const modeCtx = getModeContext();

	const mapsIcon = { viewBox: icons['objects-column'].viewBox, path: icons['objects-column'].classic.light };
	const jsonIcon = { viewBox: icons['curly-brackets'].viewBox, path: icons['curly-brackets'].classic.light };
</script>

<div
	id="tools"
	class="flex h-full w-full flex-col items-center justify-center gap-2"
	in:fade={{ duration: 300, delay: 250 }}
>
	<!-- aside variant: tablet + medium toggle which view the left aside shows -->
	<div class="subtools-aside gap-2">
		<IconToggleButton
			icon={mapsIcon}
			label="maps"
			testid="maps-aside"
			active={asideView === 'maps'}
			onclick={() => (asideView = 'maps')}
		/>
		<IconToggleButton
			icon={jsonIcon}
			label="json"
			testid="json-aside"
			active={asideView === 'json'}
			onclick={() => (asideView = 'json')}
		/>
	</div>
	<!-- modal variant: minimal viewport opens/toggles the data modal -->
	<div class="subtools-modal gap-2">
		<IconToggleButton
			icon={mapsIcon}
			label="maps"
			testid="maps-modal"
			active={modalOpen && asideView === 'maps'}
			onclick={() => (modalOpen && asideView === 'maps' ? closeModal() : openModal('maps'))}
		/>
		<IconToggleButton
			icon={jsonIcon}
			label="json"
			testid="json-modal"
			active={modalOpen && asideView === 'json'}
			onclick={() => (modalOpen && asideView === 'json' ? closeModal() : openModal('json'))}
		/>
	</div>
	<div class="flex gap-1.5">
		<IconToggleButton
			icon={{ viewBox: icons.language.viewBox, path: icons.language.sharp.light }}
			label="link"
			tabindex={1}
			active={modeCtx.current === 'link'}
			onclick={() => (modeCtx.current = 'link')}
		/>
		<IconToggleButton
			icon={{ viewBox: icons.paragraph.viewBox, path: icons.paragraph.sharp.light }}
			label="line"
			tabindex={2}
			active={modeCtx.current === 'line'}
			onclick={() => (modeCtx.current = 'line')}
		/>
		<IconToggleButton
			icon={{ viewBox: icons.eye.viewBox, path: icons.eye.classic.light }}
			label="view"
			tabindex={3}
			active={modeCtx.current === 'view'}
			onclick={() => (modeCtx.current = 'view')}
		/>
	</div>
</div>

<style lang="postcss">
	#tools :global(button) {
		@apply duration-300;
	}

	@media (hover: hover) {
		#tools :global(button.opacity-20:hover) {
			@apply opacity-60;
		}
	}

	#tools :global(button.opacity-20:focus-visible) {
		@apply opacity-60;
	}

	/* Two visually identical toggle pairs; exactly one is shown per breakpoint.
	   minimal: modal variant. tablet + medium: aside variant. desktop: neither. */
	:global(.subtools-aside) {
		display: none;
	}

	:global(.subtools-modal) {
		display: flex;
	}

	@media (orientation: portrait) and (min-height: 1000px) and (max-width: 899px) {
		:global(.subtools-aside) {
			display: flex;
		}

		:global(.subtools-modal) {
			display: none;
		}
	}

	@media (min-width: 900px) {
		:global(.subtools-aside) {
			display: flex;
		}

		:global(.subtools-modal) {
			display: none;
		}
	}

	@media (min-width: 1200px) {
		:global(.subtools-aside) {
			display: none;
		}
	}
</style>
