<script lang="ts">
	import icons from '$lib/assets/icons.json';
	import QuoteWorkbench from '$lib/components/QuoteWorkbench.svelte';

	function autosize(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		};
		node.addEventListener('input', resize);
		resize(); // maybe I have to also do this on window resize?
		return { destroy: () => node.removeEventListener('input', resize) };
	}

	type Mode = 'text' | 'link' | 'line' | 'view';

	let mode = $state<Mode>('text');

	let sourceText: string = $state('');
	let targetText: string = $state('');
	let authorship: string = $state('');

	const hangex = /^[\p{Script=Han}　-〿＀-￯]+$/u;

	// const iconSun = icons['sun-bright'];
	const iconArrow = icons['arrow-down'];
</script>

<div class="layout h-dvh w-dvw" class:panels-open={mode !== 'text'}>
	<aside class="sidebar sidebar-left bg-[#f9f9f9]" aria-hidden={mode === 'text'}></aside>
	<main class="content flex flex-col">
		<!-- Placeholder for the Light Switch Area -->
		<div class="flex h-10 w-full justify-center">
			<!-- <button aria-label="theme-toggle" class="size-6">
				<svg viewBox={iconSun.viewBox}>
					<path d={iconSun.paths['sharp-light']} />
				</svg>
			</button> -->
		</div>
		<!-- Quote Workbench Area -->
		<div class="flex h-full w-full flex-col items-center justify-center gap-3">
			<QuoteWorkbench {sourceText} {targetText} {authorship} {autosize} />
		</div>
		<!-- Tools Area -->
		<div class="flex h-20 w-full flex-col items-center justify-center">
			{#if mode === 'text'}
				<button
					// add animation later
					aria-label="next"
					class="group size-5 opacity-20 outline-0 duration-250 hocus:opacity-40"
					onclick={() => {
						mode = mode === 'text' ? 'line' : 'text';
					}}
				>
					<svg viewBox={iconArrow.viewBox} class="-rotate-90 duration-250 group-hocus:rotate-0">
						<path d={iconArrow.sharp.regular} />
					</svg>
				</button>
			{/if}
		</div>
	</main>
	<aside class="sidebar sidebar-right bg-[#f9f9f9]" aria-hidden={mode === 'text'}></aside>
</div>

<style>
	.layout {
		--layout-spacing: clamp(24px, 3vw, 36px);

		padding: var(--layout-spacing) var(--layout-spacing);
		display: grid;
		grid-column-gap: 0;
		grid-row-gap: 0;
		overflow: hidden;
		transition:
			grid-template-columns 350ms ease,
			grid-template-rows 350ms ease,
			grid-column-gap 350ms ease,
			grid-row-gap 350ms ease;

		/* default: main only */
		grid-template-columns: 1fr;
		grid-template-rows: 1fr;
		grid-template-areas: 'content';
	}

	.sidebar {
		border-radius: 20px;
		display: none;
		min-height: 0;
		min-width: 0;
		opacity: 0;
		overflow: hidden;
		pointer-events: none;
		transition:
			opacity 250ms ease,
			transform 350ms ease;
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

	/* tall portrait: main + one sidebar stacked */
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
