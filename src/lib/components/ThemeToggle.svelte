<script lang="ts">
	import { onMount, tick } from 'svelte';
	import icons from '$lib/assets/icons.json';
	import { theme } from '$lib/theme';
	import type { ThemeMode as Mode } from '$lib/types';

	const sun = icons['sun-bright'];
	const moon = icons['moon'];

	// Rotation drives the orbit: 0deg shows the sun (light), 180deg shows the moon
	// (dark). The two controls are stacked moon-on-top / sun-on-bottom and the whole
	// stack rotates about its centre, so each toggle swings the hidden icon up and
	// over the top of the clip window while the other arcs into view.
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

<div class="flex w-full justify-center">
	<div
		class="theme-clip"
		style={`--theme-toggle-rotation: ${rotation}deg; --theme-toggle-counter-rotation: ${-rotation}deg;`}
		data-hydrated={hasHydrated ? 'true' : undefined}
		role="group"
		aria-label="Theme toggle"
	>
		<div class="theme-toggle">
			<button
				bind:this={moonButton}
				class="theme-control is-moon"
				onclick={toggle}
				type="button"
				aria-label="Switch to light mode"
				tabindex={theme.current === 'dark' ? 0 : -1}
			>
				<span class="theme-counter">
					<svg viewBox={moon.viewBox} aria-hidden="true" width="24" height="24" fill="currentColor">
						<path d={moon.sharp.light} />
					</svg>
				</span>
			</button>
			<button
				bind:this={sunButton}
				class="theme-control is-sun"
				onclick={toggle}
				type="button"
				aria-label="Switch to dark mode"
				tabindex={theme.current === 'light' ? 0 : -1}
			>
				<span class="theme-counter">
					<svg viewBox={sun.viewBox} aria-hidden="true" width="24" height="24" fill="currentColor">
						<path d={sun.sharp.light} />
					</svg>
				</span>
			</button>
		</div>
	</div>
</div>

<style>
	/* Visible window (64px tall): the bottom 24px frames the live icon, the upper 40px
	   is the on-screen arc band the orbit sweeps through. The box is 120px wide — wide
	   enough that the icon's ~48px sideways swing never reaches the left/right edges —
	   and uses plain `overflow: hidden` rather than `clip-path`. Firefox fails to
	   repaint a clip-path region when its descendant is being transformed (the orbit),
	   which dropped the leaving icon on alternate toggles; overflow clipping is repaint-
	   safe. The top edge is the hide line: anything above it (the resting icon) is cut. */
	.theme-clip {
		display: flex;
		justify-content: center;
		align-items: flex-end;
		width: 7.5rem;
		height: 4rem;
		overflow: hidden;
		mask-image: linear-gradient(to bottom, transparent 0%, black 50%);
		-webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 50%);
	}

	/* The rotating stack: moon (top) / sun (bottom), pushed to the ends. Taller than the
	   window and bottom-aligned, so its top overflows above the hide line (clipped) and
	   its centre (the orbit pivot) sits 16px below the hide line. That margin keeps the
	   24px icon fully below the edge through the whole 0->90deg sweep — it only crosses
	   the edge past 90deg, on its way out, by which point the crossfade has dimmed it. */
	.theme-toggle {
		display: flex;
		flex: none;
		width: 1.5rem;
		height: 6rem;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
	}

	/* Pre-hydration only: snap to the correct starting rotation with no transition.
	   Scoped to :not([data-hydrated]) so these rules vanish the moment onMount fires.
	   If they kept applying after hydration, html.dark toggling would write a competing
	   rotate value synchronously (before Svelte flushes --theme-toggle-rotation),
	   causing Firefox to start the transition from the wrong origin every other toggle. */
	.theme-clip:not([data-hydrated]) .theme-toggle { rotate: 0deg; }
	:global(html.dark) .theme-clip:not([data-hydrated]) .theme-toggle { rotate: 180deg; }
	.theme-clip:not([data-hydrated]) .theme-counter { rotate: 0deg; }
	:global(html.dark) .theme-clip:not([data-hydrated]) .theme-counter { rotate: -180deg; }

	/* Post-hydration: JS owns rotate exclusively — no other rule touches it, so
	   the html.dark class change never interferes with the in-flight transition. */
	.theme-clip[data-hydrated='true'] .theme-toggle {
		rotate: var(--theme-toggle-rotation);
		transition: rotate 800ms;
	}

	/* Counter-rotate the glyph by the inverse so it stays upright through the orbit.
	   Opacity 0.2 at rest, brightens to 1 on hover/focus. */
	.theme-counter {
		display: flex;
		opacity: 0.2;
		transition: opacity 180ms;
	}

	.theme-clip[data-hydrated='true'] .theme-counter {
		rotate: var(--theme-toggle-counter-rotation);
		transition:
			rotate 800ms,
			opacity 180ms;
	}

	/* Crossfade layer: live icon opaque, hidden icon 0. Both states are explicit on
	   both icons so Firefox always has a concrete from→to pair to transition (no :not()
	   dropping out, which Firefox treats as an instant reset rather than a transition). */
	.theme-control {
		display: flex;
		width: 1.5rem;
		height: 1.5rem;
		outline: 0;
		transition: opacity 800ms;
	}

	/* Light mode */
	.is-sun { opacity: 1; }
	.is-moon { opacity: 0; }

	/* Dark mode */
	:global(html.dark) .is-sun { opacity: 0; }
	:global(html.dark) .is-moon { opacity: 1; }

	/* Hover/focus brightens the live icon (the dim layer goes 0.2 -> 1). */
	.theme-clip:hover .theme-counter,
	.theme-clip:has(.theme-control:focus-visible) .theme-counter {
		opacity: 1;
	}
</style>
