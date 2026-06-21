import { browser } from '$app/environment';
import { createSubscriber } from 'svelte/reactivity';
import type { Mode } from './types';
import {
	HEARTBEAT_MS,
	THEME_STATE_KEY,
	createSystemState,
	createUserState,
	isStateNewer,
	pruneTabRegistry,
	readTabRegistry,
	readThemeState,
	removeThemeState,
	resolveExternalThemeState,
	resolveStoredTheme,
	toMode,
	writeTabRegistry,
	writeThemeState,
	type StorageLike,
	type StoredTabRegistry,
	type StoredThemeState
} from './themeState';

type ThemeMessage =
	| { type: 'request'; source: string }
	| { type: 'state'; source: string; state: StoredThemeState };

const THEME_CHANNEL = 'theme-sync';

function getTabId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isReloadNavigation(): boolean {
	const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
	if (navigation) return navigation.type === 'reload';

	const legacyPerformance = performance as Performance & { navigation?: { type?: number } };
	return legacyPerformance.navigation?.type === 1;
}

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
	const tabId = getTabId();
	const channel =
		typeof BroadcastChannel === 'function' ? new BroadcastChannel(THEME_CHANNEL) : null;

	const getSystemMode = () => toMode(media.matches);

	const resolveInitialState = () => {
		const now = Date.now();
		const fallbackState = createSystemState(getSystemMode(), now, tabId);

		return withStorage((storage) => {
			const resolution = resolveStoredTheme({
				currentSystemMode: getSystemMode(),
				now,
				isReload: isReloadNavigation(),
				storedState: readThemeState(storage),
				storedRegistry: readTabRegistry(storage),
				writerTabId: tabId
			});

			if (resolution.shouldWriteRegistry) writeTabRegistry(storage, resolution.registry);
			if (resolution.shouldRemoveState) removeThemeState(storage);
			if (resolution.shouldWriteState) writeThemeState(storage, resolution.state);

			return resolution.state;
		}, fallbackState);
	};

	let currentState = resolveInitialState();
	let currentMode = currentState.mode;
	let notify = () => {};

	const broadcastState = (state = currentState) => {
		if (!channel) return;
		channel.postMessage({ type: 'state', source: tabId, state } satisfies ThemeMessage);
	};

	const setCurrentState = (
		state: StoredThemeState,
		options: { write?: boolean; broadcast?: boolean; notify?: boolean } = {}
	) => {
		const modeChanged = state.mode !== currentMode;

		currentState = state;
		currentMode = state.mode;
		applyDocumentTheme(currentMode);

		if (options.write !== false) {
			withStorage((storage) => writeThemeState(storage, state), undefined);
		}

		if (options.broadcast !== false) broadcastState(state);
		if (modeChanged && options.notify !== false) notify();
	};

	const updateTabRegistry = (
		update: (registry: StoredTabRegistry, now: number) => StoredTabRegistry
	) => {
		withStorage((storage) => {
			const now = Date.now();
			const { registry } = pruneTabRegistry(readTabRegistry(storage), now);
			writeTabRegistry(storage, update(registry, now));
		}, undefined);
	};

	const registerTab = () => {
		updateTabRegistry((registry, now) => {
			registry.tabs[tabId] = { seenAt: now };
			delete registry.lastEmptyAt;
			return registry;
		});
	};

	const unregisterTab = () => {
		updateTabRegistry((registry, now) => {
			delete registry.tabs[tabId];
			if (Object.keys(registry.tabs).length === 0) {
				registry.lastEmptyAt = now;
			}
			return registry;
		});
	};

	const heartbeatTab = () => {
		updateTabRegistry((registry, now) => {
			registry.tabs[tabId] = { seenAt: now };
			delete registry.lastEmptyAt;
			return registry;
		});
	};

	const publishSystemState = () => {
		setCurrentState(createSystemState(getSystemMode(), Date.now(), tabId));
	};

	const reconcileStoredTheme = () => {
		withStorage((storage) => {
			const now = Date.now();
			const storedState = readThemeState(storage);
			const resolution = resolveStoredTheme({
				currentSystemMode: getSystemMode(),
				now,
				isReload: isReloadNavigation(),
				storedState,
				storedRegistry: readTabRegistry(storage),
				writerTabId: tabId
			});

			if (resolution.shouldWriteRegistry) writeTabRegistry(storage, resolution.registry);
			if (resolution.shouldRemoveState) removeThemeState(storage);

			if (resolution.shouldWriteState) {
				setCurrentState(resolution.state);
				return;
			}

			if (!storedState) {
				setCurrentState(resolution.state);
				return;
			}

			if (resolution.state.systemMode !== getSystemMode()) {
				publishSystemState();
				return;
			}

			if (isStateNewer(resolution.state, currentState) || resolution.state.mode !== currentMode) {
				setCurrentState(resolution.state, { write: false, broadcast: false });
			}
		}, undefined);
	};

	const handleExternalState = (state: StoredThemeState) => {
		if (state.writerTabId === tabId) return;

		const action = resolveExternalThemeState({
			incomingState: state,
			currentState,
			currentMode,
			currentSystemMode: getSystemMode()
		});

		if (action === 'publish-system') publishSystemState();
		if (action === 'adopt') setCurrentState(state, { write: false, broadcast: false });
	};

	registerTab();
	withStorage((storage) => {
		if (!readThemeState(storage)) writeThemeState(storage, currentState);
	}, undefined);
	applyDocumentTheme(currentMode);

	const heartbeat = window.setInterval(heartbeatTab, HEARTBEAT_MS);

	const subscribe = createSubscriber((update) => {
		notify = update;

		const mediaHandler = () => publishSystemState();

		const channelHandler = (event: MessageEvent<ThemeMessage>) => {
			const message = event.data;
			if (!message || message.source === tabId) return;

			if (message.type === 'request') {
				broadcastState();
				return;
			}

			if (message.type === 'state') {
				handleExternalState(message.state);
			}
		};

		const storageHandler = (event: StorageEvent) => {
			if (event.key !== THEME_STATE_KEY || !event.newValue) return;
			const state = readThemeState(window.localStorage);
			if (state) handleExternalState(state);
		};

		const visibilityHandler = () => {
			if (document.visibilityState === 'visible') reconcileStoredTheme();
		};

		const pageShowHandler = () => reconcileStoredTheme();
		const focusHandler = () => reconcileStoredTheme();
		media.addEventListener('change', mediaHandler);
		channel?.addEventListener('message', channelHandler);
		window.addEventListener('storage', storageHandler);
		document.addEventListener('visibilitychange', visibilityHandler);
		window.addEventListener('pageshow', pageShowHandler);
		window.addEventListener('focus', focusHandler);
		channel?.postMessage({ type: 'request', source: tabId } satisfies ThemeMessage);

		return () => {
			media.removeEventListener('change', mediaHandler);
			channel?.removeEventListener('message', channelHandler);
			window.removeEventListener('storage', storageHandler);
			document.removeEventListener('visibilitychange', visibilityHandler);
			window.removeEventListener('pageshow', pageShowHandler);
			window.removeEventListener('focus', focusHandler);
		};
	});

	window.addEventListener('pagehide', (event) => {
		if (event.persisted) return;
		window.clearInterval(heartbeat);
		unregisterTab();
		channel?.close();
	});

	return {
		get current(): Mode {
			subscribe();
			return currentMode;
		},

		set current(mode: Mode) {
			setCurrentState(createUserState(mode, getSystemMode(), Date.now(), tabId));
		}
	};
}
