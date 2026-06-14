<script lang="ts">
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import Mapping from '$lib/components/Mapping.svelte';

	const alignment = getAlignmentContext();

	// A plain bind:this would let a stale copy's teardown null the ref the staying
	// copy just claimed; this action only nulls when it still owns listEl, so the
	// survivor wins (relevant when an aside copy and a modal copy momentarily coexist).
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
</script>

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
