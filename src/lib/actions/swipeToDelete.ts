/**
 * Svelte action: swipe-to-delete for a list of cards (touch / coarse pointer only).
 *
 * Attach to the scroll container; it finds the card under each pointer via
 * `cardSelector`. The card tracks the finger 1:1; releasing past `threshold` of
 * the card width stamps `data-swipeFlyoff` (read by the list's exit transition to
 * fly the card off from where the finger left it) and calls `onDelete`. Below
 * threshold, a wrong-direction drag, or a declined delete springs back.
 *
 * The list's column geometry (`columnDir` / `twoColumn`) is supplied by the host
 * because its add/exit animations share the same math — the action borrows it
 * rather than computing a second copy.
 *
 * Usage:
 *   <ol use:swipeToDelete={{ columnDir, twoColumn, canDelete, springback, onDelete }}>
 */

type SwipeToDeleteOptions = {
	/** A card's outer-edge direction; only consulted when `twoColumn()` is true. */
	columnDir: (card: HTMLElement) => 1 | -1;
	/** Whether the list is laid out in two columns right now. */
	twoColumn: () => boolean;
	/** True if a delete may start now (false while the list is mid-animation). */
	canDelete: () => boolean;
	/** Ease a below-threshold / declined card back to rest. */
	springback: (card: HTMLElement) => void;
	/** Past-threshold release: `data-swipeFlyoff` is already stamped — remove the card. */
	onDelete: (card: HTMLElement) => void;
	/** CSS selector for a card. Default `li[data-mapping-id]`. */
	cardSelector?: string;
	/** px of travel before a touch counts as a swipe. Default 10. */
	deadzone?: number;
	/** Fraction of card width past which release deletes. Default 0.4. */
	threshold?: number;
};

export function swipeToDelete(node: HTMLElement, options: SwipeToDeleteOptions) {
	let opts = options;
	const cardSelector = () => opts.cardSelector ?? 'li[data-mapping-id]';
	const deadzone = () => opts.deadzone ?? 10;
	const threshold = () => opts.threshold ?? 0.4;

	// One finger at a time, so a single set of plain `let`s tracks the in-flight swipe.
	let card: HTMLElement | null = null;
	let startX = 0;
	let pointerId = -1;
	let recognized = false;
	let rejected = false;
	// 0 = either direction (single column); ±1 = only that direction (two-column,
	// each card may only leave toward its own outer edge).
	let allowedDir: 0 | 1 | -1 = 0;

	// Set on a recognised swipe so the click synthesised by pointerup doesn't also
	// toggle the card. Cleared synchronously by the capture-phase click handler; a
	// macrotask fallback clears it if the browser drops that click (e.g. its target
	// node was removed by the fly-off before the click dispatched).
	let justSwiped = false;
	let justSwipedTimer: ReturnType<typeof setTimeout> | undefined;

	// Cache the MediaQueryList: created lazily (so it never touches `window` during
	// SSR prerender), then reused so each pointerdown reads `.matches` cheaply.
	let coarseMQL: MediaQueryList | null = null;
	const isCoarse = () => (coarseMQL ??= window.matchMedia('(pointer: coarse)')).matches;

	function currentTranslateX(el: HTMLElement): number {
		const t = getComputedStyle(el).transform;
		if (!t || t === 'none') return 0;
		return new DOMMatrixReadOnly(t).m41;
	}

	// Single column: free. Two columns: clamp to the card's outer-edge direction so
	// the opposite drag produces no movement.
	function clamp(dx: number): number {
		if (allowedDir === 0) return dx;
		return allowedDir === 1 ? Math.max(0, dx) : Math.min(0, dx);
	}

	function reset() {
		card = null;
		recognized = false;
		rejected = false;
		allowedDir = 0;
		pointerId = -1;
	}

	function markSwiped() {
		justSwiped = true;
		clearTimeout(justSwipedTimer);
		justSwipedTimer = setTimeout(clearJustSwiped, 0);
	}
	function clearJustSwiped() {
		justSwiped = false;
		clearTimeout(justSwipedTimer);
		justSwipedTimer = undefined;
	}

	function onDown(e: PointerEvent) {
		clearJustSwiped();
		if (e.pointerType !== 'touch' || !isCoarse()) return;
		if (e.target instanceof HTMLInputElement) return; // let pinyin inputs focus
		const c = (e.target as HTMLElement).closest<HTMLElement>(cardSelector());
		if (!c) return;
		card = c;
		startX = e.clientX;
		pointerId = e.pointerId;
		recognized = false;
		rejected = false;
		allowedDir = opts.twoColumn() ? opts.columnDir(c) : 0;
	}

	function onMove(e: PointerEvent) {
		if (!card || rejected || e.pointerId !== pointerId) return;
		const dx = e.clientX - startX;
		if (!recognized) {
			if (Math.abs(dx) < deadzone()) return; // still a tap, or a vertical scroll
			// Two-column wrong-direction swipe: drop the gesture so it neither moves the
			// card nor (with no movement) deletes it.
			if (allowedDir !== 0 && Math.sign(dx) !== allowedDir) {
				rejected = true;
				return;
			}
			recognized = true;
			card.setPointerCapture(pointerId);
		}
		// touch-action: pan-y (on the card) reserves horizontal for us, so once the
		// browser commits to this horizontal pan the list no longer scrolls under it.
		card.style.transform = `translateX(${clamp(dx)}px)`;
	}

	function onUp(e: PointerEvent) {
		if (!card || e.pointerId !== pointerId) return;
		const c = card;
		const wasRecognized = recognized;
		// Read the card's painted translate (already clamped by onMove) rather than
		// recomputing from e.clientX: on touch, pointerup can report a coordinate that
		// differs from the last pointermove, letting the threshold disagree with what
		// the user sees.
		const tx = wasRecognized ? currentTranslateX(c) : 0;
		reset();
		if (!wasRecognized) return; // a tap — let the click select the card
		markSwiped(); // swallow the click this release will synthesise
		const pastThreshold = Math.abs(tx) >= c.offsetWidth * threshold();
		// onDelete no-ops while another card animates (canDelete is false); deleting
		// then would strand this card off-screen, so spring it back and let the user retry.
		if (pastThreshold && opts.canDelete()) {
			c.dataset.swipeFlyoff = String(tx); // the exit transition flies it off from here
			opts.onDelete(c);
		} else {
			opts.springback(c);
		}
	}

	function onCancel(e: PointerEvent) {
		if (!card || e.pointerId !== pointerId) return;
		const c = card;
		const wasRecognized = recognized;
		reset();
		if (wasRecognized) opts.springback(c);
	}

	function onClickCapture(e: MouseEvent) {
		if (!justSwiped) return;
		clearJustSwiped();
		e.stopPropagation();
		e.preventDefault();
	}

	node.addEventListener('pointerdown', onDown);
	node.addEventListener('pointermove', onMove);
	node.addEventListener('pointerup', onUp);
	node.addEventListener('pointercancel', onCancel);
	node.addEventListener('click', onClickCapture, true); // capture phase

	return {
		update(next: SwipeToDeleteOptions) {
			opts = next;
		},
		destroy() {
			clearTimeout(justSwipedTimer);
			node.removeEventListener('pointerdown', onDown);
			node.removeEventListener('pointermove', onMove);
			node.removeEventListener('pointerup', onUp);
			node.removeEventListener('pointercancel', onCancel);
			node.removeEventListener('click', onClickCapture, true);
		}
	};
}
