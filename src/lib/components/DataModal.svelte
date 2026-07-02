<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import DataPanel from '$lib/components/DataPanel.svelte';

	let {
		asideView = $bindable(),
		modalOpen = $bindable(false),
		minimal
	}: {
		asideView: 'maps' | 'json';
		modalOpen?: boolean;
		minimal: boolean;
	} = $props();

	// Set true only when leaving the minimal breakpoint, so that close skips the
	// slide animation (out:fly duration 0). Reset on the next open.
	let forceClose = $state(false);

	// Slide direction: maps enters/leaves left, json enters/leaves right. Read at
	// transition start, so a content swap while open never re-animates. Distance =
	// full viewport width so the panel fully clears the screen edge (.layout clips).
	const flyX = $derived.by(() => {
		const d = typeof window !== 'undefined' ? window.innerWidth : 1000;
		return asideView === 'maps' ? -d : d;
	});

	export function openModal(view: 'maps' | 'json') {
		forceClose = false; // animate the next user-driven close
		asideView = view;
		if (modalOpen) return; // already open: just swapped content, no push/animate
		modalOpen = true;
		pushState('', { modal: true }); // Android back closes the modal
	}

	export function closeModal() {
		if (!modalOpen) return;
		modalOpen = false;
		if (page.state.modal) history.back(); // unwind our pushed entry
	}

	// Leaving minimal force-closes the modal instantly (out:fly duration 0).
	// forceClose stays set until the next openModal re-arms the animation.
	$effect(() => {
		if (!minimal && modalOpen) {
			forceClose = true;
			closeModal();
		}
	});

	onMount(() => {
		// Android/browser back button closes the modal (history already popped here).
		const handlePopState = () => {
			if (modalOpen) modalOpen = false;
		};
		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	});
</script>

{#if modalOpen}
	<div
		class="data-modal bg-(--panel-bg)"
		in:fly={{ x: flyX, duration: 450 }}
		out:fly={{ x: flyX, duration: forceClose ? 0 : 450 }}
	>
		<DataPanel view={asideView} />
	</div>
{/if}

<style lang="postcss">
	/* Fills the entire workbench band (flex-1 sibling of sun icon and toolbar).
	   The gap-6 on the parent flex column already separates it from those rows —
	   no extra vertical inset needed; flush horizontally too. */
	.data-modal {
		position: absolute;
		inset: 0;
		border-radius: 20px;
		overflow: hidden;
		z-index: 2;
		transition: background-color 500ms ease;
	}
</style>
