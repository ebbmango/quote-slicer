<script lang="ts">
	import { onMount } from 'svelte';
	import icons from '$lib/assets/icons.json';
	import QuoteWorkbench from '$lib/components/QuoteWorkbench.svelte';
	import DataPanel from '$lib/components/DataPanel.svelte';
	import DataModal from '$lib/components/DataModal.svelte';
	import ModeToolbar from '$lib/components/ModeToolbar.svelte';
	import { setModeContext } from '$lib/context/mode.svelte';
	import { setBreakpointContext } from '$lib/context/breakpoints.svelte';
	import { setAlignmentContext } from '$lib/context/alignment.svelte';
	import { setTokenStoreContext } from '$lib/animation/tokenStore.svelte';
	import { initAlignmentShortcuts } from '$lib/actions/globalShortcuts';

	function autosize(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		};
		node.addEventListener('input', resize);
		window.addEventListener('resize', resize);
		resize();
		return {
			destroy: () => {
				node.removeEventListener('input', resize);
				window.removeEventListener('resize', resize);
			}
		};
	}

	const modeCtx = setModeContext();
	const breakpoints = setBreakpointContext();
	const tokenStore = setTokenStoreContext();
	const alignment = setAlignmentContext(tokenStore);

	let asideView: 'maps' | 'json' = $state('maps');
	let modalOpen = $state(false);
	let dataModal: ReturnType<typeof DataModal> | undefined;

	let sourceText: string = $state('');
	let targetText: string = $state('');
	let authorship: string = $state('');

	onMount(() => initAlignmentShortcuts(alignment));

	const iconArrow = icons['arrow-down'];

	// Drives the arrow launch keyframes AND the workbench's text→token pre-match: the
	// textareas morph toward their token-mode opacity/placeholder colour over this
	// 450ms window so the DOM swap below lands seamlessly (see QuoteWorkbench .morph-*).
	let arrowExiting = $state(false);

	function advanceToLinkMode() {
		if (arrowExiting) return;
		arrowExiting = true;
		setTimeout(() => {
			const anyFilled = sourceText || targetText || authorship;
			if (!anyFilled) {
				sourceText = '知命者不怨天，知己者不怨人。';
				targetText =
					'One who knows his fate does not resent Heaven;\none who knows himself does not resent others.';
				authorship = 'A New Practical Primer of Literary Chinese (Paul F. Rouzer)';
			} else {
				if (!sourceText) sourceText = '空';
				if (!targetText) targetText = 'Use this box to enter your translated text.';
				if (!authorship) authorship = 'Source';
			}
			modeCtx.current = 'link';
		}, 450);
	}
</script>

<div class="layout h-dvh w-dvw" class:panels-open={modeCtx.current !== 'text'}>
	<aside class="sidebar sidebar-left bg-[#f9f9f9]" aria-hidden={modeCtx.current === 'text'}>
		<!-- At minimal the modal owns the maps/json content, so the hidden
		     aside renders nothing to avoid duplicate scroll-list bindings. -->
		{#if !breakpoints.minimal}
			<DataPanel view={breakpoints.wide || asideView === 'maps' ? 'maps' : 'json'} />
		{/if}
	</aside>
	<main class="content flex flex-col justify-between gap-6">
		<!-- Placeholder for the Light Switch Area -->
		<div class="flex w-full justify-center opacity-20 hocus:opacity-100 duration-200">
			<button aria-label="theme-toggle" class="size-6">
				<svg viewBox={icons['sun-bright'].viewBox}>
					<path d={icons['sun-bright'].sharp.light} />
				</svg>
			</button>
		</div>
		<!-- Quote Workbench Area -->
		<div class="relative min-h-0 w-full flex-1 overflow-hidden rounded-[20px]">
			<!-- Scroll layer: centers the quote (safe center) when it fits, and is the
			     only thing that scrolls if even floored panels overflow (<~400px tall).
			     The DataModal is a SIBLING absolute layer, positioned by the band — so
			     it stays put and never rides this scroll. -->
			<div
				class="absolute inset-0 flex flex-col items-center overflow-y-auto [justify-content:safe_center]"
			>
				<QuoteWorkbench bind:sourceText bind:targetText bind:authorship {arrowExiting} {autosize} />
			</div>
			<DataModal
				bind:this={dataModal}
				bind:asideView
				bind:modalOpen
				minimal={breakpoints.minimal}
			/>
		</div>
		<!-- Tools Area — reserve the toolbar's height (min-h-14) in every mode so the
		     text-mode arrow and the view-mode ModeToolbar occupy the same footprint.
		     Keeps the flex-1 band height constant, so the quote block sits in the
		     exact same place when text mode swaps to the workbench. -->
		<div class="flex min-h-14 w-full flex-col items-center justify-center">
			{#if modeCtx.current === 'text'}
				<button
					aria-label="next"
					class="arrow-btn group size-5 opacity-20 outline-0 hocus:opacity-40"
					class:arrow-exit={arrowExiting}
					onclick={advanceToLinkMode}
				>
					<svg viewBox={iconArrow.viewBox} class="arrow-svg">
						<path d={iconArrow.sharp.light} />
					</svg>
				</button>
			{:else}
				<ModeToolbar
					bind:asideView
					{modalOpen}
					openModal={(view) => dataModal?.openModal(view)}
					closeModal={() => dataModal?.closeModal()}
				/>
			{/if}
		</div>
	</main>
	<aside class="sidebar sidebar-right bg-[#f9f9f9]" aria-hidden={modeCtx.current === 'text'}>
		<DataPanel view="json" />
	</aside>
</div>

<style lang="postcss">
	/* Hover/focus nudges the arrow gently downward (subtle aim cue). The launch
	   animation lives on the same element so, while it runs, it overrides this
	   transition outright — the hover slide can never "finish" mid-shot. */
	.arrow-btn {
		transition: opacity 250ms ease;
	}

	.arrow-svg {
		transform-origin: center;
		transition: transform 260ms cubic-bezier(0.34, 1.2, 0.64, 1);
		will-change: transform, opacity;
	}

	.group:hover .arrow-svg,
	.group:focus-visible .arrow-svg {
		transform: translateY(3px);
	}

	/* Draw-and-shoot: anticipate up (slight overshoot), hold the draw a beat,
	   then accelerate hard downward and fade — like a loosed arrow. */
	@keyframes arrow-launch {
		0% {
			transform: translateY(0) scaleY(1);
			opacity: 0.4;
			animation-timing-function: cubic-bezier(0.34, 1.45, 0.64, 1);
		}
		34% {
			transform: translateY(-0.5rem) scaleY(1.14);
			opacity: 0.6;
			animation-timing-function: ease-in-out;
		}
		46% {
			transform: translateY(-0.42rem) scaleY(1.12);
			opacity: 0.6;
			animation-timing-function: cubic-bezier(0.5, 0, 0.85, 0.25);
		}
		100% {
			transform: translateY(3rem) scaleY(1.04);
			opacity: 0;
		}
	}

	/* Button fade yields to the svg's own opacity so the shot controls the fade. */
	.arrow-btn.arrow-exit {
		opacity: 1;
	}

	.arrow-exit .arrow-svg {
		animation: arrow-launch 450ms forwards;
	}

	.layout {
		--layout-spacing: clamp(24px, 3vw, 36px);
		--slide: 500ms;

		padding: var(--layout-spacing) var(--layout-spacing);
		display: grid;
		grid-column-gap: 0;
		grid-row-gap: 0;
		overflow: hidden;
		transition:
			grid-template-columns var(--slide) ease,
			grid-template-rows var(--slide) ease,
			grid-column-gap var(--slide) ease,
			grid-row-gap var(--slide) ease;

		/* default (cellphone): main only */
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
		grid-template-areas: 'content';
	}

	.sidebar {
		border-radius: 20px;
		display: none;
		min-height: 0;
		min-width: 0;
		overflow: hidden;
		pointer-events: none;
		transition:
			opacity 250ms ease,
			transform var(--slide) ease;
	}

	.sidebar-left {
		grid-area: left;
		transform: translateX(calc(-100% - var(--layout-spacing)));
	}

	.content {
		grid-area: content;
		min-height: 0;
		min-width: 0;
	}

	.sidebar-right {
		grid-area: right;
		transform: translateX(calc(100% + var(--layout-spacing)));
	}

	.layout.panels-open {
		grid-column-gap: var(--layout-spacing);
		grid-row-gap: var(--layout-spacing);
	}

	.layout.panels-open .sidebar {
		opacity: 1;
		pointer-events: auto;
		transform: translate(0);
	}

	/* tall portrait (tablet): main + one sidebar stacked */
	@media (orientation: portrait) and (min-height: 1000px) and (max-width: 899px) {
		.layout {
			grid-template-columns: 1fr;
			grid-template-rows: minmax(0, 1fr) minmax(0, 0fr);
			grid-template-areas:
				'content'
				'left';
		}

		.layout.panels-open {
			grid-template-rows: minmax(0, 2fr) minmax(0, 1fr);
		}

		.sidebar-left {
			display: block;
			transform: translateY(calc(100% + var(--layout-spacing)));
		}
	}

	/* medium: one sidebar + main */
	@media (min-width: 900px) {
		.layout {
			grid-template-columns: minmax(0, 0fr) minmax(0, 1fr);
			grid-template-rows: 1fr;
			grid-template-areas: 'left content';
		}

		.layout.panels-open {
			grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
		}

		.sidebar-left {
			display: block;
		}
	}

	/* desktop: sidebar + main + sidebar */
	@media (min-width: 1200px) {
		.layout {
			grid-template-columns: minmax(0, 0fr) minmax(0, 1fr) minmax(0, 0fr);
			grid-template-areas: 'left content right';
		}

		.layout.panels-open {
			grid-template-columns: minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr);
		}

		.sidebar-right {
			display: block;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.layout,
		.sidebar {
			transition: none;
		}
	}
</style>
