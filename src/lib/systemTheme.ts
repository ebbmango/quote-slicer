import { browser } from '$app/environment';
import { createSubscriber } from 'svelte/reactivity';
import type { ThemeMode as Mode } from './types';
import {
	THEME_STATE_KEY,
	parseThemeState,
	resolveTheme,
	systemState,
	toMode,
	userState,
	type StorageLike,
	type StoredThemeState
} from './themeState';

function withStorage<T>(callback: (storage: StorageLike) => T, fallback: T): T {
	try {
		return callback(window.localStorage);
	} catch {
		return fallback;
	}
}

function applyDocumentTheme(mode: Mode) {
	document.documentElement.classList.toggle('dark', mode === 'dark');
	document.documentElement.style.colorScheme = mode;
}

// During an actual theme flip, mark <html> for the length of the page's 500ms
// colour transition. Components whose elements normally transition colour faster
// (e.g. the token spans' 280ms mode-crossfade) widen to 500ms under
// `html.theme-anim`, so every element settles on the new theme at the same rate.
// Cleared after the window so mode transitions keep their own faster feel.
const THEME_ANIM_MS = 500;
let themeAnimTimer: ReturnType<typeof setTimeout> | undefined;
function flashThemeTransition() {
	const root = document.documentElement;
	root.classList.add('theme-anim');
	if (themeAnimTimer !== undefined) clearTimeout(themeAnimTimer);
	themeAnimTimer = setTimeout(() => {
		root.classList.remove('theme-anim');
		themeAnimTimer = undefined;
	}, THEME_ANIM_MS);
}

export function adaptiveTheme() {
	if (!browser) {
		return {
			get current(): Mode {
				return 'light';
			},
			set current(_mode: Mode) {}
		};
	}

	const media = window.matchMedia('(prefers-color-scheme: dark)');
	const getSystemMode = () => toMode(media.matches);

	const read = () =>
		withStorage((storage) => parseThemeState(storage.getItem(THEME_STATE_KEY)), null);
	const write = (state: StoredThemeState) =>
		withStorage((storage) => storage.setItem(THEME_STATE_KEY, JSON.stringify(state)), undefined);

	const initial = resolveTheme(read(), getSystemMode());
	let currentMode: Mode = initial.mode;
	let notify = () => {};

	applyDocumentTheme(currentMode);
	if (initial.fresh) write(initial.state);

	const set = (state: StoredThemeState, { persist = true } = {}) => {
		const changed = state.mode !== currentMode;
		currentMode = state.mode;
		applyDocumentTheme(currentMode);
		if (changed) flashThemeTransition();
		if (persist) write(state);
		if (changed) notify();
	};

	// Re-read storage and reconcile against the current OS preference. Used on
	// load, on cross-tab writes, and whenever a tab may have missed events while
	// hidden. Only persists when the resolved state is fresh (a first visit or an
	// OS drift) so cross-tab writes are adopted without echoing back.
	const reconcile = ({ persist = true } = {}) => {
		const { state, fresh } = resolveTheme(read(), getSystemMode());
		set(state, { persist: persist && fresh });
	};

	const subscribe = createSubscriber((update) => {
		notify = update;

		const onMedia = () => set(systemState(getSystemMode()));
		const onStorage = (event: StorageEvent) => {
			if (event.key !== THEME_STATE_KEY) return;
			reconcile({ persist: false });
		};
		const onReturn = () => reconcile();

		media.addEventListener('change', onMedia);
		window.addEventListener('storage', onStorage);
		document.addEventListener('visibilitychange', onReturn);
		window.addEventListener('pageshow', onReturn);
		window.addEventListener('focus', onReturn);

		return () => {
			media.removeEventListener('change', onMedia);
			window.removeEventListener('storage', onStorage);
			document.removeEventListener('visibilitychange', onReturn);
			window.removeEventListener('pageshow', onReturn);
			window.removeEventListener('focus', onReturn);
		};
	});

	return {
		get current(): Mode {
			subscribe();
			return currentMode;
		},

		set current(mode: Mode) {
			set(userState(mode, getSystemMode()));
		}
	};
}
