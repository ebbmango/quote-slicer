import type { ThemeName } from '../types';

export type ThemeSource = 'system' | 'user';

export type StoredThemeState = {
	version: 3;
	theme: ThemeName;
	source: ThemeSource;
	/** The OS preference in effect when this state was written. */
	osThemeAtPick: ThemeName;
};

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const THEME_STATE_KEY = 'quote-slicer:theme-state:v3';
export const LEGACY_THEME_STATE_KEY = 'quote-slicer:theme-state:v2';

type RawThemeState = {
	version?: unknown;
	theme?: unknown;
	mode?: unknown;
	source?: unknown;
	osThemeAtPick?: unknown;
	osAtPick?: unknown;
};

function isThemeName(value: unknown): value is ThemeName {
	return value === 'light' || value === 'dark';
}

function isThemeSource(value: unknown): value is ThemeSource {
	return value === 'system' || value === 'user';
}

export function toTheme(systemIsDark: boolean): ThemeName {
	return systemIsDark ? 'dark' : 'light';
}

export function systemThemeState(osTheme: ThemeName): StoredThemeState {
	return { version: 3, theme: osTheme, source: 'system', osThemeAtPick: osTheme };
}

export function userThemeState(theme: ThemeName, osTheme: ThemeName): StoredThemeState {
	return { version: 3, theme, source: 'user', osThemeAtPick: osTheme };
}

export function parseThemeState(value: string | null): StoredThemeState | null {
	if (!value) return null;

	try {
		const state = JSON.parse(value) as RawThemeState;

		if (state.version === 2) {
			if (!isThemeName(state.mode)) return null;
			if (!isThemeSource(state.source)) return null;
			if (!isThemeName(state.osAtPick)) return null;

			return {
				version: 3,
				theme: state.mode,
				source: state.source,
				osThemeAtPick: state.osAtPick
			};
		}

		if (state.version !== 3) return null;
		if (!isThemeName(state.theme)) return null;
		if (!isThemeSource(state.source)) return null;
		if (!isThemeName(state.osThemeAtPick)) return null;

		return {
			version: 3,
			theme: state.theme,
			source: state.source,
			osThemeAtPick: state.osThemeAtPick
		};
	} catch {
		return null;
	}
}

/**
 * "Last change wins." A stored theme survives reloads and full closes.
 *
 * The only thing that overrides a stored choice while the app was away is the
 * OS preference itself changing — a genuinely later change. That is detected by
 * comparing the OS theme now against `osThemeAtPick`, the OS theme recorded when the
 * stored state was written. On a first visit (or corrupt storage) we follow the
 * OS. `fresh` tells the caller whether the resolved state is new and must be
 * persisted, or is the stored state returned unchanged.
 */
export function resolveTheme(
	stored: StoredThemeState | null,
	osTheme: ThemeName
): { theme: ThemeName; state: StoredThemeState; fresh: boolean } {
	if (stored && stored.osThemeAtPick === osTheme) {
		return { theme: stored.theme, state: stored, fresh: false };
	}

	return { theme: osTheme, state: systemThemeState(osTheme), fresh: true };
}
