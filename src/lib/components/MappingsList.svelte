<script lang="ts">
	import { getAlignmentContext, type MappingId } from '$lib/context/alignment.svelte';
	import Mapping from '$lib/components/Mapping.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { cubicIn } from 'svelte/easing';
	import { fade, type TransitionConfig } from 'svelte/transition';
	import { swipeToDelete } from '$lib/actions/swipeToDelete';

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
	// Plain `let`, not `$state`: only imperative closures read these, never a
	// template or `$derived`, so reactivity would be pure overhead.
	let gsap: (typeof import('gsap'))['gsap'] | null = null;
	let Flip: (typeof import('gsap/Flip'))['Flip'] | null = null;

	// ───────────────────────── Animation tunables ─────────────────────────
	// Edit these to retune the feel. Durations are seconds (GSAP) except
	// EXIT_MS, which is milliseconds (a Svelte transition). Easings: GSAP
	// string eases for the Flip/slide tweens, a Svelte easing fn for the exit.
	const SLIDE = 56; // px a card travels in/out from its column edge

	// Add: neighbours open the gap, then the new card slides in.
	const MAKEWAY_S = 0.22; // neighbours sliding apart to make room
	const MAKEWAY_EASE = 'power2.inOut';
	const ENTER_S = 0.25; // new card sliding into the opened gap
	const ENTER_EASE = 'back.out(1.2)';
	const GAP_DELAY = 0.15; // new card waits this long so the gap is already opening

	// Delete: the card slides out, then neighbours close the gap.
	const EXIT_MS = 250; // leaving card sliding out to its edge (milliseconds)
	const EXIT_EASE = cubicIn; // Svelte easing fn for the slide-out
	const CLOSE_S = 0.22; // neighbours sliding in to close the gap
	const CLOSE_EASE = 'power2.inOut';
	const STAGGER = 0.025; // per-card ripple delay, outward from the deleted slot

	// Swipe-to-delete (touch). The gesture itself — deadzone, threshold, pointer
	// tracking — lives in the swipeToDelete action; only the fly-off/springback
	// animation feel stays here. Past threshold the card flies off its swipe-side
	// edge (clipped at the panel edge) and the usual gap-close runs; below it springs back.
	const SWIPE_FLYOFF_MS = 180; // card flying off after a past-threshold release (ms)
	const SWIPE_FLYOFF_EASE = cubicIn; // Svelte easing fn for the fly-off
	const SWIPE_SPRINGBACK_S = 0.3; // card easing back after a below-threshold release (springBackSwipe)
	// ───────────────────────────────────────────────────────────────────────

	// Diff bookkeeping: prevIds lets effect.pre tell an add from a reorder/remove
	// before the DOM is patched; `ready` suppresses the initial population so a list
	// that mounts with mappings already present doesn't animate them all in.
	let prevIds: Set<MappingId> = new Set();
	let ready = false;

	// Plain `let` (see gsap/Flip above): handed off effect.pre → post-update effect
	// by execution order, never read reactively.
	let pendingAddId: MappingId | null = null;
	let addFlipState: FlipState | null = null;

	let addFlip: gsap.core.Timeline | null = null;
	let addEnter: gsap.core.Tween | null = null;
	let addCard: HTMLElement | null = null;
	// Each in-flight delete owns its own close tween so concurrent deletes don't
	// cancel one another's gap-close; killed together on teardown.
	let closeTweens: gsap.core.Timeline[] = [];
	// Reactive mirror of closeTweens.length. closeTweens is a plain `let` (gsap
	// timelines must not be wrapped in a $state proxy), so scrollSuppressed reading
	// its .length would never re-run the scroll $effect when a gap-close finishes —
	// the scroll to a card activated mid-close would be skipped and never retried.
	// This $state counter gives the effect a dependency that drops back to 0.
	let closing = $state(0);

	// Count of cards mid-exit. The `<ol>` stays mounted even when empty so the last
	// card's local out:exit can play (see template); the "No mappings" overlay then
	// cross-fades in over that slide rather than popping in after it.
	let outroing = $state(0);

	// Suppress the active-card scroll while an add or exit-slide is queued/animating,
	// instead of a separate boolean that could desync from the animation and get
	// stuck. `outroing` and `closing` are $state, so the scroll $effect re-runs (and
	// scrolls to the now-active card) the moment the exit slide and gap-close finish.
	const scrollSuppressed = () =>
		pendingAddId != null || addCard != null || outroing > 0 || closing > 0;

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

	function isTwoCol(): boolean {
		return !!listEl && getComputedStyle(listEl).gridTemplateColumns.split(' ').length >= 2;
	}

	// Max two columns (the grid's minmax floors tracks at ~50%), so a binary
	// left/right is enough. Single column always slides from/to the right.
	function columnDir(card: HTMLElement, twoCol = isTwoCol()): 1 | -1 {
		if (!listEl) return 1;
		if (!twoCol) return 1;
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
	}
	function killClose() {
		for (const t of closeTweens) t.kill();
		closeTweens = [];
		closing = 0;
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
		// No card, or animation disabled (hidden panel / reduced motion / not loaded):
		// let the card stand as-is and run the scroll suppression held back.
		if (!card || !gsap || !Flip || !canAnimate()) {
			scrollActiveIntoView();
			return;
		}
		killAdd();
		addCard = card;
		scrollCardIntoView(card); // card at natural layout position before GSAP transforms
		const twoCol = isTwoCol();
		const dir = columnDir(card, twoCol);
		gsap.set(card, { opacity: 0, x: dir * SLIDE });
		// Neighbours flip from their old slots to the room-made layout the DOM
		// already holds; the new card (absent from `state`) is left untouched. The
		// first card on an empty list has no neighbours, so `state` is null — then
		// only the slide-in runs.
		if (state) {
			addFlip = Flip.from(state, {
				duration: twoCol ? 0.4 : MAKEWAY_S,
				ease: MAKEWAY_EASE,
				absolute: false,
				onComplete: () => clearSurvivorTransforms(card)
			});
		}
		addEnter = gsap.to(card, {
			opacity: 1,
			x: 0,
			duration: ENTER_S,
			ease: ENTER_EASE,
			delay: state ? GAP_DELAY : 0,
			onComplete: () => {
				gsap!.set(card, { clearProps: 'transform,opacity' });
				addCard = null;
				scrollActiveIntoView(); // retry: corrects scroll if active mapping changed mid-animation
			}
		});
	}

	function scrollActiveIntoView() {
		const active = listEl?.querySelector(`li[data-mapping-id="${alignment.activeMappingId}"]`);
		if (active) scrollCardIntoView(active);
	}

	// Svelte transition: keeps the leaving card in the DOM (holding its grid slot
	// via transform) while it slides to its column edge. When it ends, onExitEnd runs
	// the gap-close Flip.
	function exit(node: HTMLElement): TransitionConfig {
		if (!canAnimate()) return { duration: 0 };
		// Swipe-delete: the swipeToDelete action stamped the exact release offset on the node. Fly it
		// off the rest of the way from there (no fade — it's clipped at the panel edge),
		// then onExitEnd runs the same gap-close as a button delete. t runs 1→0, so at
		// t=1 the transform equals the swipe offset (continuous) and at t=0 it's
		// off-screen. We read the stamped marker rather than the node's computed
		// transform so a button-deleted card that happens to carry a GSAP transform
		// (e.g. a survivor mid gap-close Flip) is never mistaken for a swipe.
		const stamped = node.dataset.swipeFlyoff;
		const startX = stamped === undefined ? NaN : Number(stamped);
		if (Number.isFinite(startX) && startX !== 0) {
			const target = Math.sign(startX) * (listEl?.clientWidth ?? 400);
			return {
				duration: SWIPE_FLYOFF_MS,
				easing: SWIPE_FLYOFF_EASE,
				css: (t) => `transform: translateX(${startX * t + target * (1 - t)}px);`
			};
		}
		const dir = columnDir(node);
		return {
			duration: EXIT_MS,
			easing: EXIT_EASE,
			css: (t) => `opacity:${t}; transform: translateX(${(1 - t) * dir * SLIDE}px);`
		};
	}

	// If a card that's still sliding in gets deleted, drop its add tween so the exit
	// transition owns the node cleanly.
	function onExitStart(e: Event) {
		outroing++;
		const node = (e.target as HTMLElement).closest<HTMLElement>('li[data-mapping-id]');
		if (node && node === addCard) killAdd();
	}

	// The exit slide just finished and the leaving card is invisible but STILL holds
	// its grid slot (transform doesn't free layout), so the survivors are right now at
	// their open-gap positions — snapshot them. Then `display:none` pulls the card out
	// of flow so the grid reflows the survivors closed synchronously, and Flip runs
	// them from the snapshot (open) to that closed layout. Doing it all in this one
	// synchronous handler is frame-perfect: no teleport, no reliance on when Svelte
	// gets around to detaching the node.
	function onExitEnd(e: Event) {
		outroing = Math.max(0, outroing - 1);
		if (!canAnimate() || !Flip || !gsap || !listEl) return;
		const node = (e.target as HTMLElement).closest<HTMLElement>('li[data-mapping-id]');
		if (!node) return;
		const all = [...listEl.querySelectorAll<HTMLElement>('li[data-mapping-id]')];
		const fromIdx = Math.max(0, all.indexOf(node));
		const survivors = all.filter((n) => n !== node);
		// Last card deleted: no neighbours to close a gap. Flip.from([]) returns a
		// no-op tween whose onComplete may never fire, which would pin `closing` > 0
		// and leave scrollSuppressed() stuck true. Nothing to scroll to either.
		if (survivors.length === 0) return;
		// A concurrent add's make-way Flip is still tweening a survivor's transform;
		// it would fight the gap-close Flip for the same node. Settle the add to rest
		// first so the snapshot below captures the survivor at its final position,
		// not mid-add. (clearProps no-ops when no add is in flight.)
		if (addCard) killAdd();
		const state = Flip.getState(survivors); // survivors at open-gap positions
		node.style.display = 'none'; // free the slot → survivors reflow closed
		// Only scroll immediately if no prior gap-close Flip is mid-flight; otherwise
		// survivors still carry inverse transforms and getBoundingClientRect is wrong.
		// The $effect retries correctly when the last closing tween completes.
		if (closing === 0) scrollActiveIntoView();
		const tween = Flip.from(state, {
			duration: isTwoCol() ? 0.4 : CLOSE_S,
			ease: CLOSE_EASE,
			absolute: false,
			stagger: { each: STAGGER, from: Math.min(fromIdx, Math.max(0, survivors.length - 1)) },
			onComplete: () => {
				// GSAP fires onComplete from its ticker, which can advance synchronously
				// while we're mid-Svelte-flush (a later overlapping delete's Flip.from
				// drives the tick that completes THIS tween). Writing $state (`closing`)
				// re-entrantly during a flush silently wedges Svelte's scheduler — the
				// whole app's reactivity dies with no error. Defer the $state write one
				// microtask so it lands after the flush unwinds. See docs/link-mode.md.
				queueMicrotask(() => {
					closeTweens = closeTweens.filter((t) => t !== tween);
					closing = Math.max(0, closing - 1);
					if (closeTweens.length === 0) {
						clearSurvivorTransforms(addCard ?? undefined);
					}
				});
			}
		});
		closeTweens.push(tween);
		closing++;
	}

	// Ease a swiped card back to rest (below-threshold or declined release). Passed
	// to the swipeToDelete action; kept here because it owns the lazy-loaded gsap.
	function springBackSwipe(card: HTMLElement) {
		if (gsap)
			gsap.to(card, {
				x: 0,
				duration: SWIPE_SPRINGBACK_S,
				ease: 'power2.out',
				clearProps: 'transform'
			});
		else card.style.transform = '';
	}

	// Runs before the DOM patch: snapshot neighbour positions and flag the new id so
	// the post-update effect can flip them apart. Deletes are handled by the exit
	// transition, so only a single fresh id counts as an add.
	$effect.pre(() => {
		const ids = alignment.sortedMappingViews.map((v) => v.id);
		if (ready) {
			const added = ids.filter((id) => !prevIds.has(id));
			// Flag the add unconditionally; runAdd (post-patch) decides whether to
			// animate. Capturing neighbour state needs cards already present —
			// the first card grows the list from empty, so state stays null and
			// runAdd just slides it in.
			if (added.length === 1) {
				pendingAddId = added[0];
				// The `<ol>` is always mounted now, so guard on existing-card count, not
				// `listEl`: an empty list still yields null state (no make-way needed).
				const existing = listEl?.querySelectorAll('li[data-mapping-id]');
				addFlipState = Flip && existing && existing.length ? Flip.getState(existing) : null;
			}
		}
		prevIds = new Set(ids);
	});

	$effect(() => {
		// Touch the list (never null) purely to register the dependency, so this
		// re-runs after each DOM patch; then drain any queued add.
		void alignment.sortedMappingViews;
		if (pendingAddId == null) return;
		const id = pendingAddId;
		pendingAddId = null;
		const state = addFlipState;
		addFlipState = null;
		runAdd(id, state);
	});

	// Keep alignment.listAnimating in sync with in-flight animation state. Only runs
	// while this component is mounted (= the maps panel is visible), so the guard in
	// toggleSource/toggleTarget/delete* is automatically inactive when the panel is hidden.
	$effect(() => {
		alignment.listAnimating = outroing > 0 || closing > 0;
	});

	onDestroy(() => {
		killAdd();
		killClose();
		alignment.listAnimating = false;
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
		if (!id || !listEl || scrollSuppressed()) return;
		const card = listEl.querySelector(`li[data-mapping-id="${id}"]`);
		if (card) scrollCardIntoView(card);
	});
</script>

<!-- The `<ol>` stays mounted even when empty so the last card's `out:exit` is a
	plain each-block removal (a local Svelte transition), not an ancestor-block
	teardown that would skip the slide. The empty-state is an overlay that cross-fades
	in (over EXIT_MS) as the last card slides out, and fades back out when the first
	mapping is added. -->
<div class="relative h-full w-full">
	<ol
		role="listbox"
		aria-label="Mappings"
		class="no-scrollbar grid h-full w-full auto-rows-[5.75rem] grid-cols-[1fr] gap-(--mapping-gap) overflow-x-hidden overflow-y-auto scroll-smooth p-6 tablet:grid-cols-[repeat(auto-fill,minmax(clamp(200px,calc(50%-calc(var(--mapping-gap)/2)),100%),1fr))] modal-wide:grid-cols-[repeat(auto-fill,minmax(clamp(200px,calc(50%-calc(var(--mapping-gap)/2)),100%),1fr))]"
		use:listRef
		use:swipeToDelete={{
			columnDir,
			twoColumn: isTwoCol,
			canDelete: () => !alignment.listAnimating,
			springback: springBackSwipe,
			onDelete: (card) => alignment.deleteById(card.dataset.mappingId as MappingId)
		}}
		onkeydown={handleListTab}
	>
		{#each alignment.sortedMappingViews as mappingView, i (mappingView.id)}
			<Mapping {mappingView} index={i} {exit} {onExitStart} {onExitEnd} />
		{/each}
	</ol>
	{#if alignment.sortedMappingViews.length === 0}
		<div
			in:fade={{ duration: EXIT_MS }}
			out:fade={{ duration: 200 }}
			class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 p-6 text-center font-ss4 font-[350] opacity-30"
		>
			<p>No mappings.</p>
		</div>
	{/if}
</div>
