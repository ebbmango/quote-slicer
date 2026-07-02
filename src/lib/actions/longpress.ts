/**
 * Svelte action that fires a `longpress` custom event after the pointer has
 * been held down for `duration` ms without moving or lifting.
 *
 * Usage:
 *   <span use:longpress={{ duration: 500 }} onlongpress={() => handler()}></span>
 */

type LongpressOptions = {
	duration?: number; // ms before longpress fires, default 500
	onlongpress?: () => void;
};

export function longpress(node: HTMLElement, options: LongpressOptions = {}) {
	const { duration = 500, onlongpress } = options;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let fired = false;

	function start() {
		fired = false;
		timer = setTimeout(() => {
			fired = true;
			onlongpress?.();
		}, duration);
	}

	function cancel() {
		clearTimeout(timer);
	}

	// suppress the click that follows a long press
	function suppressClick(e: MouseEvent) {
		if (fired) {
			e.stopImmediatePropagation();
			fired = false;
		}
	}

	node.addEventListener('pointerdown', start);
	node.addEventListener('pointerup', cancel);
	node.addEventListener('pointermove', cancel);
	node.addEventListener('pointercancel', cancel);
	node.addEventListener('click', suppressClick, true); // capture phase

	return {
		destroy() {
			cancel();
			node.removeEventListener('pointerdown', start);
			node.removeEventListener('pointerup', cancel);
			node.removeEventListener('pointermove', cancel);
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('click', suppressClick, true);
		}
	};
}
