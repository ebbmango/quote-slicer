<script lang="ts">
	import { onMount, tick } from 'svelte';
	import icons from '$lib/assets/icons.json';
	import { theme } from '$lib/theme';
	import type { ThemeMode as Mode } from '$lib/types';

	const sun = icons['sun-bright'];
	const moon = icons['moon'];

	// Rotation drives the orbit: 0deg shows the sun (light), 180deg shows the moon
	// (dark). The stack is moon-on-top / sun-on-bottom and rotates about its centre,
	// which sits at the page's top edge. Each toggle swings the hidden icon down into
	// view while the other arcs up and off the top of the page (clipped by .layout).
	const initialMode = theme.current;
	let displayedMode = initialMode;
	let rotation = $state(initialMode === 'dark' ? 180 : 0);

	// On SSR theme.current is always 'light', so the server renders rotation 0
	// (sun-first). The app.html prepaint script adds html.dark before hydration, so
	// the CSS initial rotate already matches the real theme; we only switch on the
	// rotate *transition* after mount to avoid a 0->180 spin on first paint.
	let hasHydrated = $state(false);

	let sunButton: HTMLButtonElement | null = null;
	let moonButton: HTMLButtonElement | null = null;

	onMount(() => {
		hasHydrated = true;
	});

	const buttonForMode = (mode: Mode) => (mode === 'dark' ? moonButton : sunButton);

	// Only the visible control is tabbable; after a keyboard toggle move focus to the
	// control that just rotated into view so the user stays on the live button.
	let focusRequest = 0;
	const focusCurrentControl = async (mode: Mode) => {
		const request = ++focusRequest;
		await tick();
		if (request !== focusRequest) return;
		buttonForMode(mode)?.focus({ preventScroll: true });
	};

	function toggle(event: MouseEvent & { currentTarget: HTMLButtonElement }) {
		const nextMode = theme.current === 'dark' ? 'light' : 'dark';
		const shouldPreserveFocus = document.activeElement === event.currentTarget;
		rotation += 180;
		displayedMode = nextMode;
		theme.current = nextMode;

		if (shouldPreserveFocus) void focusCurrentControl(nextMode);
	}

	// Reading theme.current here subscribes the component to external changes (OS
	// preference, cross-tab sync); when the mode moves out from under us, spin to match.
	$effect(() => {
		const currentMode = theme.current;
		if (currentMode === displayedMode) return;
		rotation += 180;
		displayedMode = currentMode;
	});
</script>

<div class="flex w-full justify-center relative">
	<div
		class="orbit"
		style={`--theme-toggle-rotation: ${rotation}deg; --theme-toggle-counter-rotation: ${-rotation}deg;`}
		data-hydrated={hasHydrated ? 'true' : undefined}
		data-keep-selection
		role="group"
		aria-label="Theme toggle"
	>
		<button
			bind:this={moonButton}
			class="control is-moon"
			onclick={toggle}
			type="button"
			aria-label="Switch to light mode"
			tabindex={theme.current === 'dark' ? 0 : -1}
		>
			<span class="counter">
				<svg viewBox={moon.viewBox} aria-hidden="true" width="24" height="24" fill="currentColor">
					<path d={moon.sharp.light} />
				</svg>
			</span>
		</button>
		<button
			bind:this={sunButton}
			class="control is-sun"
			onclick={toggle}
			type="button"
			aria-label="Switch to dark mode"
			tabindex={theme.current === 'light' ? 0 : -1}
		>
			<span class="counter">
				<svg viewBox={sun.viewBox} aria-hidden="true" width="24" height="24" fill="currentColor">
					<path d={sun.sharp.light} />
				</svg>
			</span>
		</button>
	</div>
</div>

<style>
	/* Orbit geometry. The stack is taller than one glyph — moon at the top end, sun at
	   the bottom end (justify-between). It is absolutely positioned in the 0-height anchor
	   at content-top and pinned so the *sun* rests exactly at content-top, with the stack
	   overflowing upward: the pivot (stack centre) lands ~at the page's top edge and the
	   moon parks above it, out of the page, clipped by .layout's overflow:hidden.

	   Tuning knobs: --glyph is the icon box; --orbit-gap is the centre-to-centre distance
	   between sun and moon (== 2x orbit radius). Bumping --orbit-gap keeps the sun pinned
	   at content-top and pushes the moon further up / widens the arc. */
	.orbit {
		--glyph: 1.5rem;
		--orbit-gap: 4.5rem;

		position: absolute;
		top: calc(-1 * var(--orbit-gap));
		display: flex;
		width: var(--glyph);
		height: calc(var(--orbit-gap) + var(--glyph));
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
	}

	/* Pre-hydration only: snap to the correct starting rotation with no transition.
	   Scoped to :not([data-hydrated]) so these rules vanish the moment onMount fires.
	   If they kept applying after hydration, html.dark toggling would write a competing
	   rotate value synchronously (before Svelte flushes --theme-toggle-rotation),
	   causing the transition to start from the wrong origin every other toggle. */
	.orbit:not([data-hydrated]) { rotate: 0deg; }
	:global(html.dark) .orbit:not([data-hydrated]) { rotate: 180deg; }
	.orbit:not([data-hydrated]) .counter { rotate: 0deg; }
	:global(html.dark) .orbit:not([data-hydrated]) .counter { rotate: -180deg; }

	/* Post-hydration: JS owns rotate exclusively — no other rule touches it, so the
	   html.dark class change never interferes with the in-flight transition. */
	.orbit[data-hydrated='true'] {
		rotate: var(--theme-toggle-rotation);
		transition: rotate 800ms;
	}

	.orbit[data-hydrated='true'] .counter {
		rotate: var(--theme-toggle-counter-rotation);
		transition:
			rotate 800ms,
			opacity 180ms;
	}

	/* Crossfade layer: live icon opaque, hidden icon 0. Both states are explicit on both
	   icons so there is always a concrete from→to pair to transition. */
	.control {
		display: flex;
		width: var(--glyph);
		height: var(--glyph);
		outline: 0;
		transition: opacity 800ms;
	}

	.is-sun { opacity: 1; }
	.is-moon { opacity: 0; }

	:global(html.dark) .is-sun { opacity: 0; }
	:global(html.dark) .is-moon { opacity: 1; }

	/* Counter-rotate the glyph by the inverse so it stays upright through the orbit.
	   Opacity 0.2 at rest, brightens to 1 on hover/focus. */
	.counter {
		display: flex;
		opacity: 0.2;
		transition: opacity 180ms;
	}

	.orbit:hover .counter,
	.orbit:has(.control:focus-visible) .counter {
		opacity: 1;
	}
</style>
