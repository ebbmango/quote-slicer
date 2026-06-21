<script lang="ts">
	import { onMount } from 'svelte';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { initModeTracking } from '$lib/context/interactionMode.svelte';
	import { theme } from '$lib/theme';

	// Read theme.current in a reactive context so the controller's subscriber stays
	// attached app-wide — that's what wires up OS-preference changes and cross-tab
	// sync. The .dark class itself is owned by the controller (applyDocumentTheme),
	// not this layout.
	$effect(() => {
		void theme.current;
	});

	// Sync onMount so the returned cleanup runs on teardown (an async onMount
	// returns a Promise, which Svelte ignores for cleanup).
	onMount(() => initModeTracking());

	onMount(async () => {
		const { gsap } = await import('gsap');
		const { Draggable } = await import('gsap/Draggable');
		const { Flip } = await import('gsap/Flip');
		gsap.registerPlugin(Draggable, Flip);
	});

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

{@render children()}
