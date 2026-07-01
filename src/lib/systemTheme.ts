import { browser } from '$app/environment';
import { flushSync } from 'svelte';
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

function applyThemeClass(mode: Mode) {
	document.documentElement.classList.toggle('dark', mode === 'dark');
}

// `color-scheme` drives native form controls / scrollbars. It is applied inline on
// <html> (the app.html prepaint sets the initial value pre-paint) — NOT via the
// `.dark` CSS class and NOT in the same frame as a theme flip. Chrome throttles a
// `color` transition to ~half the rate of `background-color` when `color-scheme`
// changes mid-transition, so text lagged the background badly. See scheduleColorScheme.
function applyColorScheme(mode: Mode) {
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

// Apply the new color-scheme only AFTER the colour transition has finished, so the
// mid-transition color-scheme change can't throttle Chrome's `color` transition
// (which desynced text from the background). Debounced so a second flip within the
// window resets the timer and only the final scheme lands. The small buffer past
// THEME_ANIM_MS ensures the transition is fully settled first.
let colorSchemeTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleColorScheme(mode: Mode) {
	if (colorSchemeTimer !== undefined) clearTimeout(colorSchemeTimer);
	colorSchemeTimer = setTimeout(() => {
		applyColorScheme(mode);
		colorSchemeTimer = undefined;
	}, THEME_ANIM_MS + 60);
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

	// Initial paint: no transition is running, so set both class and color-scheme
	// immediately (the prepaint already stamped color-scheme inline; this reasserts it).
	applyThemeClass(currentMode);
	applyColorScheme(currentMode);
	if (initial.fresh) write(initial.state);

	const set = (state: StoredThemeState, { persist = true } = {}) => {
		const changed = state.mode !== currentMode;
		currentMode = state.mode;
		applyThemeClass(currentMode);
		if (changed) {
			// Flip drives the 500ms colour transition. Defer the color-scheme change
			// past the window so it doesn't throttle Chrome's `color` transition.
			flashThemeTransition();
			scheduleColorScheme(currentMode);
		} else {
			// No visual change (e.g. reconcile adopting the same mode) — apply now.
			applyColorScheme(currentMode);
		}
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
