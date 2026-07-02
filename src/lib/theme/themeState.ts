import type { ThemeMode as Mode } from '../types';

export type ThemeSource = 'system' | 'user';

export type StoredThemeState = {
	version: 2;
	mode: Mode;
	source: ThemeSource;
	/** The OS preference in effect when this state was written. */
	osAtPick: Mode;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const THEME_STATE_KEY = 'quote-slicer:theme-state:v2';

export function toMode(systemIsDark: boolean): Mode {
	return systemIsDark ? 'dark' : 'light';
}

export function systemState(osMode: Mode): StoredThemeState {
	return { version: 2, mode: osMode, source: 'system', osAtPick: osMode };
}

export function userState(mode: Mode, osMode: Mode): StoredThemeState {
	return { version: 2, mode, source: 'user', osAtPick: osMode };
}

export function parseThemeState(value: string | null): StoredThemeState | null {
	if (!value) return null;

	try {
		const state = JSON.parse(value) as Partial<StoredThemeState>;
		if (state.version !== 2) return null;
		if (state.mode !== 'light' && state.mode !== 'dark') return null;
		if (state.source !== 'system' && state.source !== 'user') return null;
		if (state.osAtPick !== 'light' && state.osAtPick !== 'dark') return null;

		return { version: 2, mode: state.mode, source: state.source, osAtPick: state.osAtPick };
	} catch {
		return null;
	}
}

/**
 * "Last change wins." A stored theme survives reloads and full closes.
 *
 * The only thing that overrides a stored choice while the app was away is the
 * OS preference itself changing — a genuinely later change. That is detected by
 * comparing the OS mode now against `osAtPick`, the OS mode recorded when the
 * stored state was written. On a first visit (or corrupt storage) we follow the
 * OS. `fresh` tells the caller whether the resolved state is new and must be
 * persisted, or is the stored state returned unchanged.
 */
export function resolveTheme(
	stored: StoredThemeState | null,
	osMode: Mode
): { mode: Mode; state: StoredThemeState; fresh: boolean } {
	if (stored && stored.osAtPick === osMode) {
		return { mode: stored.mode, state: stored, fresh: false };
	}

	return { mode: osMode, state: systemState(osMode), fresh: true };
}
