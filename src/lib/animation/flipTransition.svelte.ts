import { tick, onMount } from 'svelte';
import 'gsap'; // pulls in ambient gsap.* type namespace used by Flip's vars types

// Animates `[data-flip-id]` children of a container across a DOM mutation,
// using GSAP's Flip plugin (lazy-loaded, since the app is statically prerendered).
export function createFlipTransition() {
	let Flip: (typeof import('gsap/Flip'))['Flip'] | null = $state(null);

	onMount(async () => {
		const { Flip: F } = await import('gsap/Flip');
		Flip = F;
	});

	async function run(container: HTMLElement | null, mutate: () => void) {
		if (!Flip || !container) {
			mutate();
			return;
		}
		const state = Flip.getState(container.querySelectorAll('[data-flip-id]'));
		mutate();
		await tick();
		Flip.from(state, { duration: 0.35, ease: 'power2.inOut', absolute: false });
	}

	return { run };
}
