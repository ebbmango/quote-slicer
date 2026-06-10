import { pickVisualNeighbor } from './visualNeighbor';

export type Zone = 'source' | 'target';

export type TokenGridNavConfig = {
	/** CSS selector for the currently navigable elements (varies by mode). */
	itemSelector: () => string;
	/** Whether Alt+Enter / row-boundary Arrow keys jump between source and target. */
	crossZoneJump: () => boolean;
	/** Index of the default token to focus when jumping into `zone` with no remembered focus. */
	getDefaultIndex: (zone: Zone) => number;
	/** Alt+Space / Alt+Shift+Space on a navigable element. */
	onActivate: (el: HTMLElement, e: KeyboardEvent) => void;
	/** Escape, after the focused element has been blurred. */
	onEscape: () => void;
};

// ─── Token grid keyboard scheme ──────────────────────────────────────────────
// Alt+↑ / Alt+↓        Navigate focus to the element on the visual row above/below.
//                       At a zone's far edge (link mode only) → jumps to the other zone.
// Alt+← / Alt+→        Move focus to prev/next navigable element in DOM order.
// Alt+Enter            Toggle focus between source and target (link mode only).
// Alt+Space            Activate the focused element.
// Alt+Shift+Space      Activate with `force` (meaning is mode-specific).
// Escape               Blur the focused element; mode-specific extra action.
// ──────────────────────────────────────────────────────────────────────────────

export function getZone(el: HTMLElement): Zone | null {
	if (el.closest('[data-zone="source"]')) return 'source';
	if (el.closest('[data-zone="target"]')) return 'target';
	return null;
}

export function createTokenGridNav(getContainer: () => HTMLElement | null, config: TokenGridNavConfig) {
	const lastFocused: Record<Zone, HTMLElement | null> = { source: null, target: null };

	function findVisualNeighbor(currentEl: HTMLElement, all: HTMLElement[], dir: 'up' | 'down'): HTMLElement | null {
		const rects = all.map((el) => el.getBoundingClientRect());
		const idx = pickVisualNeighbor(currentEl.getBoundingClientRect(), rects, dir);
		return idx === -1 ? null : all[idx];
	}

	function findDefaultEl(zone: Zone): HTMLElement | null {
		const container = getContainer();
		if (!container) return null;
		const idx = config.getDefaultIndex(zone);
		if (idx === -1) return null;
		return container.querySelector(`[data-zone="${zone}"] [data-token-index="${idx}"]`);
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

		if (!e.altKey) return;

		if (e.key === ' ') {
			if (!target.matches(config.itemSelector())) return;
			e.preventDefault();
			config.onActivate(target, e);
			return;
		}

		if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;

		if (e.key === 'Enter') {
			if (!config.crossZoneJump()) return;
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
				if (!config.crossZoneJump()) return;
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
