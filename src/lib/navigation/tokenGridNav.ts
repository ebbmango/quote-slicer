import { tick } from 'svelte';
import { pickVisualNeighbor } from './visualNeighbor';
import { interactionMedium } from '$lib/context/interactionMedium.svelte';
import {
	getZone,
	zoneSelector,
	tokenSelector,
	divisorSelector,
	divisorIndexOf,
	type Zone
} from './gridDom';

export type TokenGridNavConfig = {
	/** CSS selector for the currently navigable elements (varies by tool). */
	itemSelector: () => string;
	/** Index of the default token to focus when jumping into `zone` with no remembered focus. */
	getDefaultIndex: (zone: Zone) => number;
	/** Alt+Space / Alt+Shift+Space on a navigable element. */
	onActivate: (el: HTMLElement, e: KeyboardEvent) => void;
	/** Escape, after the focused element has been blurred. */
	onEscape: () => void;
	/** Whether an Alt+Space activation may re-render the focused item away, so focus
	 *  must be re-acquired by index (line tool: a split/merge replaces the divisor). */
	restoresFocusOnActivate?: () => boolean;
};

// ─── Token grid keyboard scheme ──────────────────────────────────────────────
// Alt+↑ / Alt+↓        Navigate focus to the element on the visual row above/below.
//                       At a zone's far edge (link tool only) → jumps to the other zone.
// Alt+← / Alt+→        Move focus to prev/next navigable element in DOM order.
// Alt+Enter            Toggle focus between source and target.
// Alt+Space            Activate the focused element.
// Alt+Shift+Space      Activate with `force` (meaning is tool-specific).
// Escape               Blur the focused element; tool-specific extra action.
// ──────────────────────────────────────────────────────────────────────────────

export function createTokenGridNav(
	getContainer: () => HTMLElement | null,
	config: TokenGridNavConfig
) {
	const lastFocused: Record<Zone, HTMLElement | null> = { source: null, target: null };

	function findVisualNeighbor(
		currentEl: HTMLElement,
		all: HTMLElement[],
		dir: 'up' | 'down'
	): HTMLElement | null {
		const rects = all.map((el) => el.getBoundingClientRect());
		const idx = pickVisualNeighbor(currentEl.getBoundingClientRect(), rects, dir);
		return idx === -1 ? null : all[idx];
	}

	function findDefaultEl(zone: Zone): HTMLElement | null {
		const container = getContainer();
		if (!container) return null;
		const idx = config.getDefaultIndex(zone);
		if (idx !== -1) {
			const el = container.querySelector<HTMLElement>(
				`${zoneSelector(zone)} ${tokenSelector(idx)}`
			);
			if (el) return el;
		}
		// Scope to the zone's container first, then run itemSelector() inside it.
		// itemSelector() can be a comma-list (line tool); string-prefixing a list
		// only scopes its first branch, so the rest would match other zones.
		const zoneEl = container.querySelector<HTMLElement>(zoneSelector(zone));
		return zoneEl?.querySelector<HTMLElement>(config.itemSelector()) ?? null;
	}

	// After an activation that re-renders the focused item, re-acquire focus by the
	// divisor index it sat at. Only line-tool activations are destructive (gated by
	// config.restoresFocusOnActivate), so items here are divisors.
	function restoreFocusByIndex(zone: Zone, divisorIndex: number): void {
		const container = getContainer();
		const zoneEl = container?.querySelector<HTMLElement>(zoneSelector(zone));
		if (!zoneEl) return;
		let next = zoneEl.querySelector<HTMLElement>(divisorSelector(divisorIndex));
		if (!next) {
			// The divisor can vanish when a base token and its punctuation recombine into
			// one group (they can no longer be split apart) — its index is now intra-group
			// and unrendered. Focus the nearest remaining divisor so a keyboard merge
			// doesn't drop focus to <body>.
			const all = [...zoneEl.querySelectorAll<HTMLElement>(config.itemSelector())];
			next = all.filter((d) => divisorIndexOf(d) <= divisorIndex).pop() ?? all[0] ?? null;
		}
		next?.focus();
	}

	function jumpTo(zone: Zone): void {
		const container = getContainer();
		if (!container) return;
		const remembered = lastFocused[zone];
		const el = remembered && container.contains(remembered) ? remembered : findDefaultEl(zone);
		el?.focus();
	}

	function handleFocusIn(e: FocusEvent): void {
		const el = e.target as HTMLElement;
		if (!el.matches(config.itemSelector())) return;
		const zone = getZone(el);
		if (zone) lastFocused[zone] = el;
	}

	function handleKeydown(e: KeyboardEvent): void {
		const container = getContainer();
		if (!container) return;
		const target = e.target as HTMLElement;

		if (e.key === 'Escape') {
			(document.activeElement as HTMLElement | null)?.blur();
			config.onEscape();
			return;
		}

		// Suppress native plain Enter/Space activation on navigable elements —
		// activation is alt-gated only (Alt+Space → onActivate). Centralized here so
		// the divisor buttons and option tokens don't each need an inline handler.
		if (!e.altKey) {
			if ((e.key === 'Enter' || e.key === ' ') && target.matches(config.itemSelector())) {
				e.preventDefault();
			}
			return;
		}

		// From here on it's an Alt-gated keyboard nav action. The global tracker only
		// flips to keyboard on Tab, so without this Alt+Arrow nav would leave
		// `data-interaction-medium='mouse'` and the keyboard-gated divisor :focus indicators
		// (split/merge/ws) would never light while navigating.
		interactionMedium.set('keyboard');

		if (e.key === ' ') {
			if (!target.matches(config.itemSelector())) return;
			e.preventDefault();
			const zone = getZone(target);
			const divisorIndex = divisorIndexOf(target);
			config.onActivate(target, e);
			if (config.restoresFocusOnActivate?.() && zone && !Number.isNaN(divisorIndex)) {
				tick().then(() => restoreFocusByIndex(zone, divisorIndex));
			}
			return;
		}

		if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;

		if (e.key === 'Enter') {
			e.preventDefault();
			const zone = getZone(target);
			jumpTo(zone === 'source' ? 'target' : 'source');
			return;
		}

		const all = Array.from(container.querySelectorAll(config.itemSelector())) as HTMLElement[];

		// Container itself is focused — enter the navigable area
		if (target === container) {
			if (!all.length) return;
			e.preventDefault();
			const entry = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? all[all.length - 1] : all[0];
			entry?.focus();
			return;
		}

		if (!target.matches(config.itemSelector())) return;
		e.preventDefault();

		const currentIndex = all.indexOf(target);
		let neighbor: HTMLElement | null = null;

		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			neighbor = findVisualNeighbor(target, all, e.key === 'ArrowDown' ? 'down' : 'up');
			if (!neighbor) {
				const zone = getZone(target);
				if (e.key === 'ArrowDown' && zone === 'source') jumpTo('target');
				else if (e.key === 'ArrowUp' && zone === 'target') jumpTo('source');
				return;
			}
		} else if (e.key === 'ArrowLeft') {
			neighbor = currentIndex > 0 ? all[currentIndex - 1] : null;
		} else if (e.key === 'ArrowRight') {
			neighbor = currentIndex < all.length - 1 ? all[currentIndex + 1] : null;
		}

		neighbor?.focus();
	}

	return { handleKeydown, handleFocusIn };
}
