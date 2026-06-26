/**
 * Tracks current input mode ("mouse", "keyboard", or "touch") to improve UI feedback.
 * Prevents overlapping styles (e.g. mouse hover + tab focus) when both inputs are active.
 * Last input wins: any mousemove → "mouse"; a Tab keydown → "keyboard"; a touchstart → "touch".
 *
 * Global module singleton (app-wide, not tree-scoped). Call `initModeTracking()`
 * once at app startup and run the returned cleanup on teardown.
 */

export type ActionMode = 'mouse' | 'keyboard' | 'touch';

export const interactionMode = $state({
	current: 'mouse' as ActionMode,
	set: (newMode: ActionMode) => {
		interactionMode.current = newMode;
		document.documentElement.dataset.interaction = newMode;
	}
});

// Avoids re-attaching if already initialized.
let initialized = false;

export function initModeTracking() {
	if (initialized) return;
	initialized = true;

	document.documentElement.dataset.interaction = interactionMode.current;

	// Touch fires synthetic mousemove/mouseenter right after touchstart. Ignore
	// those for a short window so a tap doesn't flip us back to 'mouse'.
	let lastTouchTime = 0;
	const TOUCH_GUARD_MS = 500;

	function handleMouseMove() {
		if (Date.now() - lastTouchTime <= TOUCH_GUARD_MS) return;
		interactionMode.set('mouse');
	}

	function handleKeyDown(e: KeyboardEvent) {
		// Only Tab switches to keyboard mode; other keys are ignored.
		if (e.key === 'Tab') {
			interactionMode.set('keyboard');
		}
	}

	function handleTouchStart() {
		lastTouchTime = Date.now();
		interactionMode.set('touch');
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
