import { browser } from '$app/environment';
import { flushSync } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import type { ThemeName } from '../types';
import {
	LEGACY_THEME_STATE_KEY,
	THEME_STATE_KEY,
	parseThemeState,
	resolveTheme,
	systemThemeState,
	toTheme,
	userThemeState,
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

function applyThemeClass(themeName: ThemeName) {
	document.documentElement.classList.toggle('dark', themeName === 'dark');
}

// `color-scheme` drives native form controls / scrollbars. Live changes go on
// <body>, NOT <html>: Chromium runs every `color` transition at ~half speed when
// the ROOT element's color-scheme changed in the same frame, mid-flight, or within
// ~500ms before the transition starts. A deferred root write (the previous fix)
// only moved the poison window — a second flip landing 0–500ms after the deferred
// write (≈ "toggle again once the button settles") still throttled text to ~1s and
// desynced it from the background. Body-level color-scheme is penalty-free at ANY
// offset (measured: same-frame/before/mid-flight all settle ~440ms) and still
// propagates to every form control, caret, and inner scrollbar via inheritance.
// <html> keeps only the app.html prepaint value (correct pre-hydration first
// paint); it goes stale after live toggles, which only affects the root scrollbar
// and canvas default — the layout is a non-scrolling h-dvh grid and every surface
// paints its own background, so neither is ever visible.
function applyColorScheme(themeName: ThemeName) {
	document.body.style.colorScheme = themeName;
}

// During an actual theme flip, mark <html> for the length of the page's 500ms
// colour transition. Components whose elements normally transition colour faster
// (e.g. the token spans' 280ms tool-crossfade) widen to 500ms under
// `html.theme-anim`, so every element settles on the new theme at the same rate.
// Cleared after the window so tool transitions keep their own faster feel.
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
			get current(): ThemeName {
				return 'light';
			},
			set current(_themeName: ThemeName) {}
		};
	}

	const media = window.matchMedia('(prefers-color-scheme: dark)');
	const getSystemTheme = () => toTheme(media.matches);

	const read = () =>
		withStorage((storage) => {
			const current = parseThemeState(storage.getItem(THEME_STATE_KEY));
			if (current) return current;

			const legacy = parseThemeState(storage.getItem(LEGACY_THEME_STATE_KEY));
			if (legacy) {
				try {
					storage.setItem(THEME_STATE_KEY, JSON.stringify(legacy));
				} catch {
					// Preserve the read even if migration write is blocked.
				}
			}
			return legacy;
		}, null);
	const write = (state: StoredThemeState) =>
		withStorage((storage) => storage.setItem(THEME_STATE_KEY, JSON.stringify(state)), undefined);

	const initial = resolveTheme(read(), getSystemTheme());
	let currentTheme: ThemeName = initial.theme;
	let notify = () => {};

	// Initial paint: no transition is running, so set both class and color-scheme
	// immediately (the prepaint stamped <html>'s color-scheme pre-paint; this seeds
	// the live <body> copy to match).
	applyThemeClass(currentTheme);
	applyColorScheme(currentTheme);
	if (initial.fresh) write(initial.state);

	const set = (state: StoredThemeState, { persist = true } = {}) => {
		const changed = state.theme !== currentTheme;
		currentTheme = state.theme;
		applyThemeClass(currentTheme);
		// Body-level color-scheme is safe to flip synchronously with the class (no
		// Chromium transition throttle — see applyColorScheme), so native form
		// controls re-theme in the same frame as everything else.
		applyColorScheme(currentTheme);
		if (changed) flashThemeTransition();
		if (persist) write(state);
		if (changed) {
			// Svelte batches the resulting re-renders into a later flush; in Chromium
			// that lands one frame AFTER the .dark class flip above, so JS-driven
			// colors (mapping cards, Shiki palette) started their 500ms transition a
			// frame behind the page's. Flushing synchronously puts every DOM write in
			// the same style recalc, so all transitions share one start frame.
			notify();
			flushSync();
		}
	};

	// Re-read storage and reconcile against the current OS preference. Used on
	// load, on cross-tab writes, and whenever a tab may have missed events while
	// hidden. Only persists when the resolved state is fresh (a first visit or an
	// OS drift) so cross-tab writes are adopted without echoing back.
	const reconcile = ({ persist = true } = {}) => {
		const { state, fresh } = resolveTheme(read(), getSystemTheme());
		set(state, { persist: persist && fresh });
	};

	const subscribe = createSubscriber((update) => {
		notify = update;

		const onMedia = () => set(systemThemeState(getSystemTheme()));
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
		get current(): ThemeName {
			subscribe();
			return currentTheme;
		},

		set current(themeName: ThemeName) {
			set(userThemeState(themeName, getSystemTheme()));
		}
	};
}
