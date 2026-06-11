import { tick, onMount } from 'svelte';
import 'gsap'; // pulls in ambient gsap.* type namespace used by Flip's vars types

const DURATION = 0.35;
const EASE = 'power2.inOut';

// Animates `[data-flip-id]` children of a container across a DOM mutation,
// using GSAP's Flip plugin (lazy-loaded, since the app is statically prerendered).
//
// `run` also tweens the height of an optional scroll container in lockstep with
// the Flip. Flip uses transforms (`absolute: false`), so tokens visually occupy
// their *old* positions until the tween resolves. If the scroll container snapped
// straight to its new (smaller) height on a merge, the still-displaced tokens would
// be clipped by `overflow-y-auto` and only fade into view as the transform settled.
// Animating the height alongside keeps the room available throughout the transition.
export function createFlipTransition() {
	let Flip: (typeof import('gsap/Flip'))['Flip'] | null = $state(null);
	let gsap: (typeof import('gsap'))['gsap'] | null = $state(null);
	let animating = $state(false);

	onMount(async () => {
		const [{ Flip: F }, { gsap: g }] = await Promise.all([import('gsap/Flip'), import('gsap')]);
		Flip = F;
		gsap = g;
	});

	// `flipContainer` holds the `[data-flip-id]` tokens; `heightEl` is the scroll
	// container whose pixel height should track the layout change (may be the same
	// element, or null to skip height animation).
	async function run(
		flipContainer: HTMLElement | null,
		heightEl: HTMLElement | null,
		mutate: () => void
	) {
		if (!Flip || !flipContainer) {
			mutate();
			return;
		}
		const state = Flip.getState(flipContainer.querySelectorAll('[data-flip-id]'));

		// Lock the current height and suppress the component's instant-fit `$effect`
		// before mutating, so nothing snaps the container to the new size mid-flight.
		const oldHeight = heightEl ? heightEl.offsetHeight : 0;
		if (heightEl && gsap) {
			heightEl.style.height = oldHeight + 'px';
			animating = true;
		}

		mutate();
		await tick();

		if (heightEl && gsap) {
			// Measure the settled height without a visible jump, then tween to it.
			heightEl.style.height = 'auto';
			const target = heightEl.scrollHeight;
			heightEl.style.height = oldHeight + 'px';
			gsap.to(heightEl, {
				height: target,
				duration: DURATION,
				ease: EASE,
				onComplete: () => {
					heightEl.style.height = target + 'px';
					animating = false;
				}
			});
		}

		Flip.from(state, { duration: DURATION, ease: EASE, absolute: false });
	}

	return {
		run,
		get animating() {
			return animating;
		}
	};
}
