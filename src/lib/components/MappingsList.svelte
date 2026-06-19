<script lang="ts">
	import { getAlignmentContext, type MappingId } from '$lib/context/alignment.svelte';
	import Mapping from '$lib/components/Mapping.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { cubicIn } from 'svelte/easing';
	import type { TransitionConfig } from 'svelte/transition';

	type FlipState = ReturnType<(typeof import('gsap/Flip'))['Flip']['getState']>;

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

	// --- List enter/exit animation -------------------------------------------
	// Add and delete are animated as two readable phases (see docs/link-mode.md):
	//   add    — neighbours make way (Flip), then the new card slides in from its
	//            column edge after the gap is half-open.
	//   delete — the card slides out to its column edge first, then the gap closes
	//            (Flip) staggered outward from the deleted slot.
	// GSAP (not Svelte's animate:flip) drives both so we get column-aware direction,
	// the deletion-point ripple, and the out→close sequencing the built-ins can't do.
	let gsap: (typeof import('gsap'))['gsap'] | null = $state(null);
	let Flip: (typeof import('gsap/Flip'))['Flip'] | null = $state(null);

	const SLIDE = 56; // px a card travels to/from its column edge
	const FLIP_S = 0.22; // neighbour displacement / gap close
	const ENTER_S = 0.25; // new card slide-in
	const EXIT_MS = 250; // leaving card slide-out (Svelte transition → ms)
	const GAP_DELAY = 0.15; // new card waits this long so the gap is already opening
	const STAGGER = 0.025; // per-card delay of the deletion-point ripple

	// Diff bookkeeping: prevIds lets effect.pre tell an add from a reorder/remove
	// before the DOM is patched; `ready` suppresses the initial population so a list
	// that mounts with mappings already present doesn't animate them all in.
	let prevIds: Set<MappingId> = new Set();
	let ready = false;
	let suppressScroll = false;

	let pendingAddId: MappingId | null = $state(null);
	let addFlipState: FlipState | null = $state(null);
	let closeState: FlipState | null = null;
	let closeFromIdx = 0;

	let addFlip: gsap.core.Timeline | null = null;
	let addEnter: gsap.core.Tween | null = null;
	let addCard: HTMLElement | null = null;
	let closeTween: gsap.core.Timeline | null = null;

	onMount(async () => {
		const [{ gsap: g }, { Flip: F }] = await Promise.all([import('gsap'), import('gsap/Flip')]);
		gsap = g;
		Flip = F;
		prevIds = new Set(alignment.sortedMappingViews.map((v) => v.id));
		ready = true;
	});

	function canAnimate(): boolean {
		if (!gsap || !Flip || !listEl) return false;
		if (listEl.checkVisibility && !listEl.checkVisibility()) return false;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
		return true;
	}

	// Max two columns (the grid's minmax floors tracks at ~50%), so a binary
	// left/right is enough. Single column always slides from/to the right.
	function columnDir(card: HTMLElement): 1 | -1 {
		if (!listEl) return 1;
		if (getComputedStyle(listEl).gridTemplateColumns.split(' ').length < 2) return 1;
		const list = listEl.getBoundingClientRect();
		const c = card.getBoundingClientRect();
		return c.left + c.width / 2 < list.left + list.width / 2 ? -1 : 1;
	}

	// Interrupting an in-flight add snaps the victim card to its settled state
	// (the grilled "kill and start fresh" rule) so a half-run enter can never leave
	// a card stranded off-edge or invisible.
	function killAdd() {
		clearSurvivorTransforms(addCard ?? undefined);
		addFlip?.kill();
		addEnter?.kill();
		if (addCard && gsap) gsap.set(addCard, { clearProps: 'transform,opacity' });
		addFlip = addEnter = addCard = null;
		suppressScroll = false;
	}
	function killClose() {
		closeTween?.kill();
		closeTween = null;
	}

	// Flip leaves displaced neighbours at a resting transform; strip it so they
	// fall back to pure grid layout (except the entering card, still mid-slide).
	function clearSurvivorTransforms(except?: HTMLElement) {
		if (!listEl || !gsap) return;
		for (const el of listEl.querySelectorAll<HTMLElement>('li[data-mapping-id]')) {
			if (el !== except) gsap.set(el, { clearProps: 'transform' });
		}
	}

	// Runs inside the post-update $effect (DOM patched, not yet painted) so hiding the
	// new card lands before the first frame — no flash of it at rest before it slides.
	function runAdd(id: MappingId, state: FlipState | null) {
		const card = listEl?.querySelector<HTMLElement>(`li[data-mapping-id="${id}"]`);
		if (!card || !gsap || !Flip || !state) {
			suppressScroll = false;
			return;
		}
		killAdd();
		addCard = card;
		const dir = columnDir(card);
		gsap.set(card, { opacity: 0, x: dir * SLIDE });
		// Neighbours flip from their old slots to the room-made layout the DOM
		// already holds; the new card (absent from `state`) is left untouched.
		addFlip = Flip.from(state, {
			duration: FLIP_S,
			ease: 'power2.inOut',
			absolute: false,
			onComplete: () => clearSurvivorTransforms(card)
		});
		addEnter = gsap.to(card, {
			opacity: 1,
			x: 0,
			duration: ENTER_S,
			ease: 'back.out(1.2)',
			delay: GAP_DELAY,
			onComplete: () => {
				gsap!.set(card, { clearProps: 'transform,opacity' });
				addCard = null;
				suppressScroll = false;
				const active = listEl?.querySelector(
					`li[data-mapping-id="${alignment.activeMappingId}"]`
				);
				if (active) scrollCardIntoView(active);
			}
		});
	}

	// Svelte transition: keeps the leaving card in the DOM (holding its grid slot
	// via transform) while it slides to its column edge. onExitEnd then closes the gap.
	function exit(node: HTMLElement): TransitionConfig {
		if (!canAnimate()) return { duration: 0 };
		const dir = columnDir(node);
		return {
			duration: EXIT_MS,
			easing: cubicIn,
			css: (t) => `opacity:${t}; transform: translateX(${(1 - t) * dir * SLIDE}px);`
		};
	}

	function onExitStart(e: Event) {
		if (!canAnimate() || !Flip) return;
		const node = (e.target as HTMLElement).closest<HTMLElement>('li[data-mapping-id]');
		if (!node || !listEl) return;
		if (node === addCard) killAdd();
		const all = [...listEl.querySelectorAll<HTMLElement>('li[data-mapping-id]')];
		closeFromIdx = Math.max(0, all.indexOf(node));
		killClose();
		// Survivors captured while the gap is still open (leaving node holds its slot).
		closeState = Flip.getState(all.filter((n) => n !== node));
	}

	function onExitEnd() {
		if (!Flip || !closeState || !canAnimate()) {
			closeState = null;
			return;
		}
		const count = listEl?.querySelectorAll('li[data-mapping-id]').length ?? 0;
		killClose();
		closeTween = Flip.from(closeState, {
			duration: FLIP_S,
			ease: 'power2.inOut',
			absolute: false,
			stagger: { each: STAGGER, from: Math.min(closeFromIdx, Math.max(0, count - 1)) },
			onComplete: () => clearSurvivorTransforms()
		});
		closeState = null;
	}

	// Runs before the DOM patch: snapshot neighbour positions and flag the new id so
	// the post-update effect can flip them apart. Deletes are handled by the exit
	// transition, so only a single fresh id counts as an add.
	$effect.pre(() => {
		const ids = alignment.sortedMappingViews.map((v) => v.id);
		if (ready) {
			const added = ids.filter((id) => !prevIds.has(id));
			if (added.length === 1 && canAnimate() && listEl && Flip) {
				pendingAddId = added[0];
				addFlipState = Flip.getState(listEl.querySelectorAll('li[data-mapping-id]'));
				suppressScroll = true;
			}
		}
		prevIds = new Set(ids);
	});

	$effect(() => {
		// Reading the list registers the dependency so this re-runs after each patch.
		if (alignment.sortedMappingViews && pendingAddId != null) {
			const id = pendingAddId;
			pendingAddId = null;
			const state = addFlipState;
			addFlipState = null;
			runAdd(id, state);
		}
	});

	onDestroy(() => {
		killAdd();
		killClose();
	});

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
		if (!id || !listEl || suppressScroll) return;
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
			<Mapping {mappingView} index={i} {exit} {onExitStart} {onExitEnd} />
		{/each}
	</ol>
{/if}
