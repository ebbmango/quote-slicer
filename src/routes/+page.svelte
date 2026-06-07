<script lang="ts">
	import { onMount } from 'svelte';
	import icons from '$lib/assets/icons.json';
	import QuoteWorkbench from '$lib/components/QuoteWorkbench.svelte';
	import Mapping from '$lib/components/Mapping.svelte';
	import { setModeContext } from '$lib/context/mode.svelte';
	import { setLinkContext } from '$lib/context/link.svelte';

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
	const link = setLinkContext();
	const inLineMode = $derived(modeCtx.current === 'join' || modeCtx.current === 'part');

	let sourceText: string = $state('');
	let targetText: string = $state('');
	let authorship: string = $state('');

	onMount(() => {
		function handleDeleteKey(e: KeyboardEvent) {
			if (e.key !== 'Delete' && e.key !== 'Backspace') return;
			if (link.activeMappingId === null) return;
			const active = document.activeElement;
			if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
			e.preventDefault();
			link.deleteActive();
		}
		document.addEventListener('keydown', handleDeleteKey);
		return () => document.removeEventListener('keydown', handleDeleteKey);
	});

	let listEl: HTMLOListElement;

	function handleListTab(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;
		const focusable = [
			...listEl.querySelectorAll<HTMLElement>(
				'li[tabindex="0"], input[tabindex="0"]'
			)
		];
		const currentIdx = focusable.indexOf(document.activeElement as HTMLElement);
		if (currentIdx === -1) return;
		const nextIdx = e.shiftKey ? currentIdx - 1 : currentIdx + 1;
		const next = focusable[nextIdx];
		if (!next) return;
		e.preventDefault();
		next.focus({ preventScroll: true });
		const PADDING = 20;
		const scrollTarget = next.closest('li') ?? next;
		const nextRect = scrollTarget.getBoundingClientRect();
		const containerRect = listEl.getBoundingClientRect();
		if (nextRect.bottom > containerRect.bottom - PADDING) {
			listEl.scrollTo({
				top: listEl.scrollTop + nextRect.bottom - containerRect.bottom + PADDING,
				behavior: 'smooth'
			});
		} else if (nextRect.top < containerRect.top + PADDING) {
			listEl.scrollTo({
				top: listEl.scrollTop + nextRect.top - containerRect.top - PADDING,
				behavior: 'smooth'
			});
		}
	}

	// const hangex = /^[\p{Script=Han}\u3000-\u303F\uFF00-\uFFEF]+$/u;

	// const iconSun = icons['sun-bright'];
	const iconArrow = icons['arrow-down'];
</script>

<div class="layout h-dvh w-dvw" class:panels-open={modeCtx.current !== 'text'}>
	<aside class="sidebar sidebar-left bg-[#f9f9f9]" aria-hidden={modeCtx.current === 'text'}>
		<ol role="listbox" aria-label="Mappings" class="flex h-full w-full flex-col gap-3 overflow-y-auto scroll-smooth p-6" bind:this={listEl} onkeydown={handleListTab}>
			{#each link.sortedMappings as mapping, i (mapping.id)}
				<Mapping {mapping} index={i} />
			{/each}
		</ol>
</aside>			
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
			<QuoteWorkbench bind:sourceText bind:targetText bind:authorship {autosize} />
		</div>
		<!-- Tools Area -->
		<div class="flex h-20 w-full flex-col items-center justify-center">
			{#if modeCtx.current === 'text'}
				<button
					aria-label="next"
					class="group size-5 opacity-20 outline-0 duration-250 hocus:opacity-40"
					onclick={() => {
						const anyFilled = sourceText || targetText || authorship;
						if (!anyFilled) {
							sourceText = '知命者不怨天，知己者不怨人。';
							targetText =
								'One who knows his fate does not resent Heaven; one who knows himself does not resent others.';
							authorship = 'A New Practical Primer of Literary Chinese (Paul F. Rouzer)';
						} else {
							if (!sourceText) sourceText = '空';
							if (!targetText) targetText = 'Use this box to enter your translated text.';
							if (!authorship) authorship = 'Source';
						}
						modeCtx.current = 'link';
					}}
				>
					<svg viewBox={iconArrow.viewBox} class="duration-250 group-hocus:translate-y-0.5">
						<path d={iconArrow.sharp.regular} />
					</svg>
				</button>
			{:else}
				<div id="tools" class="flex h-full w-full flex-col items-center justify-center gap-1">
					<div
						class="flex gap-2 transition-opacity duration-300"
						class:opacity-0={!inLineMode}
						class:pointer-events-none={!inLineMode}
					>
						<button
							aria-label="part"
							tabindex={inLineMode ? 2 : -1}
							class="size-6 outline-0 duration-150"
							class:opacity-20={modeCtx.current !== 'part'}
							onclick={() => (modeCtx.current = 'part')}
						>
							<svg class="rotate-90" viewBox={icons['arrows-from-dotted-line'].viewBox}>
								<path d={icons['arrows-from-dotted-line'].classic.regular} />
							</svg>
						</button>
						<button
							aria-label="join"
							tabindex={inLineMode ? 3 : -1}
							class="size-6 outline-0 duration-150"
							class:opacity-20={modeCtx.current !== 'join'}
							onclick={() => (modeCtx.current = 'join')}
						>
							<svg class="rotate-90" viewBox={icons['arrows-to-line'].viewBox}>
								<path d={icons['arrows-to-line'].classic.regular} />
							</svg>
						</button>
					</div>
					<div class="flex gap-1.5">
						<button
							aria-label="link"
							tabindex={1}
							class="size-6 outline-0 duration-150"
							class:opacity-20={modeCtx.current !== 'link'}
							onclick={() => (modeCtx.current = 'link')}
						>
							<svg viewBox={icons.language.viewBox}>
								<path d={icons.language.sharp.regular} />
							</svg>
						</button>
						<button
							aria-label="line"
							tabindex={inLineMode ? -1 : 2}
							class="size-6 outline-0 duration-150"
							class:opacity-20={modeCtx.current !== 'join' && modeCtx.current !== 'part'}
							onclick={() => {
								if (modeCtx.current !== 'join' && modeCtx.current !== 'part') {
									modeCtx.current = 'part';
								}
							}}
						>
							<svg viewBox={icons.paragraph.viewBox}>
								<path d={icons.paragraph.sharp.regular} />
							</svg>
						</button>
						<button
							aria-label="view"
							tabindex={inLineMode ? 4 : 3}
							class="size-6 outline-0 duration-150"
							class:opacity-20={modeCtx.current !== 'view'}
							onclick={() => (modeCtx.current = 'view')}
						>
							<svg viewBox={icons.eye.viewBox}>
								<path d={icons.eye.classic.regular} />
							</svg>
						</button>
					</div>
				</div>
			{/if}
		</div>
	</main>
	<aside
		class="sidebar sidebar-right bg-[#f9f9f9]"
		aria-hidden={modeCtx.current === 'text'}
	></aside>
</div>

<style lang="postcss">
	#tools button {
		@apply duration-300;
	}

	#tools button.opacity-20:hover,
	#tools button.opacity-20:focus-visible {
		@apply opacity-60;
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
