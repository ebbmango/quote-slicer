/**
 * Tracks current input mode ("mouse" or "keyboard") to improve UI feedback.
 * Prevents overlapping styles (e.g. mouse hover + tab focus) when both inputs are active.
 * Last input wins: any mousemove → "mouse"; a Tab keydown → "keyboard".
 *
 * Global module singleton (app-wide, not tree-scoped). Call `initModeTracking()`
 * once at app startup and run the returned cleanup on teardown.
 */

export type ActionMode = 'mouse' | 'keyboard';

type InteractionModeState = {
	current: ActionMode;
	set: (newMode: ActionMode) => void;
	isMouse: boolean;
	isKeyboard: boolean;
};

export const interactionMode: InteractionModeState = $state({
	current: 'mouse',
	set: (newMode: ActionMode) => {
		interactionMode.current = newMode;
	},
	get isMouse() {
		return interactionMode.current === 'mouse';
	},
	get isKeyboard() {
		return interactionMode.current === 'keyboard';
	}
});

// Avoids re-attaching if already initialized.
let initialized = false;

export function initModeTracking() {
	if (initialized) return;
	initialized = true;

	function handleMouseMove() {
		interactionMode.set('mouse');
	}

	function handleKeyDown(e: KeyboardEvent) {
		// Only Tab switches to keyboard mode; other keys are ignored.
		if (e.key === 'Tab') {
			interactionMode.set('keyboard');
		}
	}

	document.addEventListener('mousemove', handleMouseMove);
	document.addEventListener('keydown', handleKeyDown);

	return () => {
		document.removeEventListener('mousemove', handleMouseMove);
		document.removeEventListener('keydown', handleKeyDown);
		initialized = false;
	};
}
