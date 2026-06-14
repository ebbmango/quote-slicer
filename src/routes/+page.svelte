<script lang="ts">
	import { onMount } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import icons from '$lib/assets/icons.json';
	import QuoteWorkbench from '$lib/components/QuoteWorkbench.svelte';
	import Mapping from '$lib/components/Mapping.svelte';
	import { setModeContext } from '$lib/context/mode.svelte';
	import { setBreakpointContext } from '$lib/context/breakpoints.svelte';
	import { setAlignmentContext } from '$lib/context/alignment.svelte';
	import { setTokenStoreContext } from '$lib/animation/tokenStore.svelte';
	import HighlightedCode from '$lib/components/HighlightedCode.svelte';
	import { formatExport } from '$lib/exportFormat';
	import { colors } from '$lib/constants/colors';

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

	function openModal(view: 'maps' | 'json') {
		forceClose = false; // animate the next user-driven close
		asideView = view;
		if (modalOpen) return; // already open: just swapped content, no push/animate
		modalOpen = true;
		pushState('', { modal: true }); // Android back closes the modal
	}

	function closeModal() {
		if (!modalOpen) return;
		modalOpen = false;
		if (page.state.modal) history.back(); // unwind our pushed entry
	}

	// Leaving minimal force-closes the modal instantly (out:fly duration 0).
	// forceClose stays set until the next openModal re-arms the animation.
	$effect(() => {
		if (!breakpoints.minimal && modalOpen) {
			forceClose = true;
			closeModal();
		}
	});

	let sourceText: string = $state('');
	let targetText: string = $state('');
	let authorship: string = $state('');

	const exportJson = $derived(formatExport(alignment.exportData));

	onMount(() => {
		// Android/browser back button closes the modal (history already popped here).
		const handlePopState = () => {
			if (modalOpen) modalOpen = false;
		};
		window.addEventListener('popstate', handlePopState);

		function handleDeleteKey(e: KeyboardEvent) {
			if (e.key !== 'Delete' && e.key !== 'Backspace') return;
			const active = document.activeElement;
			if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return;
			const focusedId = (active?.closest('li[data-mapping-id]') as HTMLElement)?.dataset.mappingId;
			// Fresh/active mappings aren't focused yet — fall back to the active one so
			// Backspace works right after creating a mapping, not just while tabbing the list.
			const id = focusedId ?? alignment.activeMappingId;
			if (!id) return;
			e.preventDefault();
			alignment.deleteById(id);
		}

		function handleDocumentClick(e: MouseEvent) {
			const target = e.target as HTMLElement;
			if (target.closest('[data-mapping-id]')) return;
			if (target.closest('[aria-label="Source tokens"]')) return;
			if (target.closest('[aria-label="Target tokens"]')) return;
			alignment.deselect();
		}

		document.addEventListener('keydown', handleDeleteKey);
		document.addEventListener('click', handleDocumentClick);
		return () => {
			window.removeEventListener('popstate', handlePopState);
			document.removeEventListener('keydown', handleDeleteKey);
			document.removeEventListener('click', handleDocumentClick);
		};
	});

	// The aside and modal copies of mappingsList() can momentarily coexist during
	// a breakpoint force-close (out:fly lingers a tick). A plain bind:this would let
	// the stale copy's teardown null the ref the staying copy just claimed; this
	// action only nulls when it still owns listEl, so the survivor wins.
	let listEl: HTMLOListElement | undefined = $state();
	const SCROLL_PADDING = 20;

	function listRef(node: HTMLOListElement) {
		listEl = node;
		return {
			destroy() {
				if (listEl === node) listEl = undefined;
			}
		};
	}

	function scrollCardIntoView(card: Element) {
		if (!listEl) return;
		const cardRect = card.getBoundingClientRect();
		const containerRect = listEl.getBoundingClientRect();
		if (cardRect.bottom > containerRect.bottom - SCROLL_PADDING) {
			listEl.scrollTo({
				top: listEl.scrollTop + cardRect.bottom - containerRect.bottom + SCROLL_PADDING,
				behavior: 'smooth'
			});
		} else if (cardRect.top < containerRect.top + SCROLL_PADDING) {
			listEl.scrollTo({
				top: listEl.scrollTop + cardRect.top - containerRect.top - SCROLL_PADDING,
				behavior: 'smooth'
			});
		}
	}

	function handleListTab(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !listEl) return;
		const focusable = [
			...listEl.querySelectorAll<HTMLElement>('li[tabindex="0"], input[tabindex="0"]')
		];
		const currentIdx = focusable.indexOf(document.activeElement as HTMLElement);
		if (currentIdx === -1) return;
		const nextIdx = e.shiftKey ? currentIdx - 1 : currentIdx + 1;
		const next = focusable[nextIdx];
		if (!next) return;
		e.preventDefault();
		next.focus({ preventScroll: true });
		scrollCardIntoView(next.closest('li') ?? next);
	}

	$effect(() => {
		const id = alignment.activeMappingId;
		if (!id || !listEl) return;
		const card = listEl.querySelector(`li[data-mapping-id="${id}"]`);
		if (card) scrollCardIntoView(card);
	});

	// const hangex = /^[\p{Script=Han}\u3000-\u303F\uFF00-\uFFEF]+$/u;

	// const iconSun = icons['sun-bright'];
	const iconArrow = icons['arrow-down'];

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

{#snippet mappingsList()}
	{#if alignment.sortedMappingViews.length === 0}
		<div class="flex h-full w-full flex-col items-center justify-center gap-1 p-6 text-center opacity-30 font-ss4 font-[350]">
			<p>No mappings.</p>
		</div>
	{:else}
		<ol
			role="listbox"
			aria-label="Mappings"
			class="grid h-full w-full auto-rows-[5.75rem] grid-cols-[1fr] [gap:var(--mapping-gap)] overflow-y-auto scroll-smooth p-6 no-scrollbar tablet:grid-cols-[repeat(auto-fill,minmax(clamp(200px,calc(50%-calc(var(--mapping-gap)/2)),100%),1fr))] modal-wide:grid-cols-[repeat(auto-fill,minmax(clamp(200px,calc(50%-calc(var(--mapping-gap)/2)),100%),1fr))]"
			use:listRef
			onkeydown={handleListTab}
		>
			{#each alignment.sortedMappingViews as mappingView, i (mappingView.id)}
				<Mapping {mappingView} index={i} />
			{/each}
		</ol>
	{/if}
{/snippet}

{#snippet jsonExport()}
	<div class="shiki-export h-full w-full overflow-auto p-6 text-xs no-scrollbar">
		<HighlightedCode
			code={exportJson}
			colorReplacements={{
				dracula: {
					// strings
					'#f1fa8c': colors.compostella.base,
					'#e9f284': colors.compostella.base,
					// properties
					'#8be9fe': '#A8A8A8',
					'#8be9fd': '#A8A8A8',
					// colons & brackets
					'#ff79c6': '#A8A8A8',
					'#f8f8f2': '#A8A8A8',
					// numbers
					'#bd93f9': colors.azure.base,
					// undefined
					'#ff5555': colors.sugar.base
				}
			}}
		/>
	</div>
{/snippet}

{#snippet mapsIcon()}
	<svg viewBox={icons['objects-column'].viewBox}>
		<path d={icons['objects-column'].classic.light} />
	</svg>
{/snippet}

{#snippet jsonIcon()}
	<svg viewBox={icons['curly-brackets'].viewBox}>
		<path d={icons['curly-brackets'].classic.light} />
	</svg>
{/snippet}

<div class="layout h-dvh w-dvw" class:panels-open={modeCtx.current !== 'text'}>
	<aside class="sidebar sidebar-left bg-[#f9f9f9]" aria-hidden={modeCtx.current === 'text'}>
		<!-- At minimal the modal owns the maps/json content, so the hidden
		     aside renders nothing to avoid duplicate scroll-list bindings. -->
		{#if !breakpoints.minimal}
			<div class="fade-edges h-full w-full">
				{#if breakpoints.wide || asideView === 'maps'}
					{@render mappingsList()}
				{:else}
					{@render jsonExport()}
				{/if}
			</div>
		{/if}
	</aside>
	<main class="content flex flex-col justify-between">
		<!-- Placeholder for the Light Switch Area -->
		<div class="flex w-full justify-center opacity-20 hocus:opacity-100 duration-200">
			<button aria-label="theme-toggle" class="size-6">
				<svg viewBox={icons['sun-bright'].viewBox}>
					<path d={icons['sun-bright'].sharp.light} />
				</svg>
			</button>
		</div>
		<!-- Quote Workbench Area -->
		<div class="relative flex h-full w-full flex-col items-center justify-center gap-3">
			<QuoteWorkbench bind:sourceText bind:targetText bind:authorship {autosize} />
			<!-- Slides in/out toward asideView's side. Breakpoint exit force-closes with
			     duration 0 (instant, no animation); user close animates over 450ms. -->
			{#if modalOpen}
				<div
					class="data-modal bg-[#f9f9f9]"
					in:fly={{ x: flyX, duration: 450 }}
					out:fly={{ x: flyX, duration: forceClose ? 0 : 450 }}
				>
					<div class="fade-edges h-full w-full">
						{#if asideView === 'maps'}
							{@render mappingsList()}
						{:else}
							{@render jsonExport()}
						{/if}
					</div>
				</div>
			{/if}
		</div>
		<!-- Tools Area -->
		<div class="flex w-full flex-col items-center justify-center">
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
				<div
					id="tools"
					class="flex h-full w-full flex-col items-center justify-center gap-2"
					in:fade={{ duration: 300, delay: 250 }}
				>
					<!-- aside variant: tablet + medium toggle which view the left aside shows -->
					<div class="subtools-aside gap-2">
						<button
							aria-label="maps"
							data-testid="maps-aside"
							tabindex={-1}
							class="size-6 outline-0 duration-150"
							class:opacity-20={asideView !== 'maps'}
							onclick={() => (asideView = 'maps')}
						>
							{@render mapsIcon()}
						</button>
						<button
							aria-label="json"
							data-testid="json-aside"
							tabindex={-1}
							class="size-6 outline-0 duration-150"
							class:opacity-20={asideView !== 'json'}
							onclick={() => (asideView = 'json')}
						>
							{@render jsonIcon()}
						</button>
					</div>
					<!-- modal variant: minimal viewport opens/toggles the data modal -->
					<div class="subtools-modal gap-2">
						<button
							aria-label="maps"
							data-testid="maps-modal"
							tabindex={-1}
							class="size-6 outline-0 duration-150"
							class:opacity-20={!(modalOpen && asideView === 'maps')}
							onclick={() => (modalOpen && asideView === 'maps' ? closeModal() : openModal('maps'))}
						>
							{@render mapsIcon()}
						</button>
						<button
							aria-label="json"
							data-testid="json-modal"
							tabindex={-1}
							class="size-6 outline-0 duration-150"
							class:opacity-20={!(modalOpen && asideView === 'json')}
							onclick={() => (modalOpen && asideView === 'json' ? closeModal() : openModal('json'))}
						>
							{@render jsonIcon()}
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
							<path d={icons.language.sharp.light} />
						</svg>
					</button>
					<button
						aria-label="line"
						tabindex={2}
						class="size-6 outline-0 duration-150"
						class:opacity-20={modeCtx.current !== 'line'}
						onclick={() => (modeCtx.current = 'line')}
					>
						<svg viewBox={icons.paragraph.viewBox}>
							<path d={icons.paragraph.sharp.light} />
						</svg>
					</button>
					<button
						aria-label="view"
						tabindex={3}
						class="size-6 outline-0 duration-150"
						class:opacity-20={modeCtx.current !== 'view'}
						onclick={() => (modeCtx.current = 'view')}
					>
						<svg viewBox={icons.eye.viewBox}>
							<path d={icons.eye.classic.light} />
						</svg>
					</button>
					</div>
				</div>
			{/if}
		</div>
	</main>
	<aside class="sidebar sidebar-right bg-[#f9f9f9]" aria-hidden={modeCtx.current === 'text'}>
		<div class="fade-edges h-full w-full">
			{@render jsonExport()}
		</div>
	</aside>
</div>

<style lang="postcss">
	.shiki-export :global(pre) {
		background: transparent !important;
	}

	.fade-edges {
		--fade: 24px;
		/* Smoothstep-eased ramp: alpha slope is 0 at both the transparent edge
		   and the opaque junction, so neither end shows a visible kink. */
		--ramp-y:
			transparent 0,
			rgba(0, 0, 0, 0.06) calc(var(--fade) * 0.15),
			rgba(0, 0, 0, 0.22) calc(var(--fade) * 0.3),
			rgba(0, 0, 0, 0.5) calc(var(--fade) * 0.5),
			rgba(0, 0, 0, 0.78) calc(var(--fade) * 0.7),
			rgba(0, 0, 0, 0.94) calc(var(--fade) * 0.85),
			black var(--fade),
			black calc(100% - var(--fade)),
			rgba(0, 0, 0, 0.94) calc(100% - var(--fade) * 0.85),
			rgba(0, 0, 0, 0.78) calc(100% - var(--fade) * 0.7),
			rgba(0, 0, 0, 0.5) calc(100% - var(--fade) * 0.5),
			rgba(0, 0, 0, 0.22) calc(100% - var(--fade) * 0.3),
			rgba(0, 0, 0, 0.06) calc(100% - var(--fade) * 0.15),
			transparent 100%;
		mask-image:
			linear-gradient(to bottom, var(--ramp-y)),
			linear-gradient(to right, var(--ramp-y));
		mask-composite: intersect;
		-webkit-mask-image:
			linear-gradient(to bottom, var(--ramp-y)),
			linear-gradient(to right, var(--ramp-y));
		-webkit-mask-composite: source-in;
	}

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

	#tools button {
		@apply duration-300;
	}

	#tools button.opacity-20:hover,
	#tools button.opacity-20:focus-visible {
		@apply opacity-60;
	}

	/* Two visually identical toggle pairs; exactly one is shown per breakpoint.
	   minimal: modal variant. tablet + medium: aside variant. desktop: neither. */
	.subtools-aside {
		display: none;
	}

	.subtools-modal {
		display: flex;
	}

	/* Fills the workbench band between the sun icon and the tools row, keeping
	   --layout-spacing from each; flush to the content box horizontally (already
	   --layout-spacing from the screen edges, matching the icons). */
	.data-modal {
		position: absolute;
		inset: var(--layout-spacing) 0;
		border-radius: 20px;
		overflow: hidden;
		z-index: 2;
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

		.subtools-aside {
			display: flex;
		}

		.subtools-modal {
			display: none;
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

		.subtools-aside {
			display: flex;
		}

		.subtools-modal {
			display: none;
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

		.subtools-aside {
			display: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.layout,
		.sidebar {
			transition: none;
		}
	}
</style>
