/**
 * Tracks current interaction medium ("mouse", "keyboard", or "touch") to improve UI feedback.
 * Prevents overlapping styles (e.g. mouse hover + tab focus) when both inputs are active.
 * Last input wins: any mousemove → "mouse"; a Tab keydown → "keyboard"; a touchstart → "touch".
 *
 * Global module singleton (app-wide, not tree-scoped). Call `initInteractionMediumTracking()`
 * once at app startup and run the returned cleanup on teardown.
 */

export type InteractionMedium = 'mouse' | 'keyboard' | 'touch';

export const interactionMedium = $state({
	current: 'mouse' as InteractionMedium,
	set: (newMedium: InteractionMedium) => {
		interactionMedium.current = newMedium;
		document.documentElement.dataset.interactionMedium = newMedium;
	}
});

// Avoids re-attaching if already initialized.
let initialized = false;

export function initInteractionMediumTracking() {
	if (initialized) return;
	initialized = true;

	document.documentElement.dataset.interactionMedium = interactionMedium.current;

	// Touch fires synthetic mousemove/mouseenter right after touchstart. Ignore
	// those for a short window so a tap doesn't flip us back to 'mouse'.
	let lastTouchTime = 0;
	const TOUCH_GUARD_MS = 500;

	function handleMouseMove() {
		if (Date.now() - lastTouchTime <= TOUCH_GUARD_MS) return;
		interactionMedium.set('mouse');
	}

	function handleKeyDown(e: KeyboardEvent) {
		// Only Tab switches to the keyboard medium; other keys are ignored.
		if (e.key === 'Tab') {
			interactionMedium.set('keyboard');
		}
	}

	function handleTouchStart() {
		lastTouchTime = Date.now();
		interactionMedium.set('touch');
	}

	document.addEventListener('mousemove', handleMouseMove);
	document.addEventListener('keydown', handleKeyDown);
	document.addEventListener('touchstart', handleTouchStart, { passive: true });

	return () => {
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('keydown', handleKeyDown);
		document.removeEventListener('touchstart', handleTouchStart);
		initialized = false;
	};
}
