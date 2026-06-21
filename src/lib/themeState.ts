import type { Mode } from './types';

export type ThemeSource = 'system' | 'user';

export type StoredThemeState = {
	version: 1;
	mode: Mode;
	source: ThemeSource;
	systemMode: Mode;
	updatedAt: number;
	writerTabId: string;
};

export type StoredTabRegistry = {
	version: 1;
	tabs: Record<string, { seenAt: number }>;
	lastEmptyAt?: number;
};

export type ThemeResolution = {
	mode: Mode;
	state: StoredThemeState;
	registry: StoredTabRegistry;
	hasContinuity: boolean;
	shouldWriteState: boolean;
	shouldRemoveState: boolean;
	shouldWriteRegistry: boolean;
};

export type ExternalThemeStateAction = 'adopt' | 'ignore' | 'publish-system';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const THEME_STATE_KEY = 'quote-slicer:theme-state:v1';
export const THEME_TABS_KEY = 'quote-slicer:theme-tabs:v1';
export const HEARTBEAT_MS = 30_000;
export const STALE_TAB_MS = 300_000;
export const RELOAD_GRACE_MS = 300_000;

export function toMode(systemIsDark: boolean): Mode {
	return systemIsDark ? 'dark' : 'light';
}

export function createSystemState(
	systemMode: Mode,
	now: number,
	writerTabId: string
): StoredThemeState {
	return {
		version: 1,
		mode: systemMode,
		source: 'system',
		systemMode,
		updatedAt: now,
		writerTabId
	};
}

export function createUserState(
	mode: Mode,
	systemMode: Mode,
	now: number,
	writerTabId: string
): StoredThemeState {
	return {
		version: 1,
		mode,
		source: 'user',
		systemMode,
		updatedAt: now,
		writerTabId
	};
}

export function emptyTabRegistry(): StoredTabRegistry {
	return { version: 1, tabs: {} };
}

export function parseThemeState(value: string | null): StoredThemeState | null {
	if (!value) return null;

	try {
		const state = JSON.parse(value) as Partial<StoredThemeState>;
		if (state.version !== 1) return null;
		if (state.mode !== 'light' && state.mode !== 'dark') return null;
		if (state.source !== 'system' && state.source !== 'user') return null;
		if (state.systemMode !== 'light' && state.systemMode !== 'dark') return null;
		if (typeof state.updatedAt !== 'number' || !Number.isFinite(state.updatedAt)) return null;
		if (typeof state.writerTabId !== 'string' || state.writerTabId.length === 0) return null;

		return state as StoredThemeState;
	} catch {
		return null;
	}
}

export function parseTabRegistry(value: string | null): StoredTabRegistry | null {
	if (!value) return null;

	try {
		const registry = JSON.parse(value) as Partial<StoredTabRegistry>;
		if (registry.version !== 1) return null;
		if (!registry.tabs || typeof registry.tabs !== 'object' || Array.isArray(registry.tabs)) {
			return null;
		}
		if (
			registry.lastEmptyAt !== undefined &&
			(typeof registry.lastEmptyAt !== 'number' || !Number.isFinite(registry.lastEmptyAt))
		) {
			return null;
		}

		const tabs: StoredTabRegistry['tabs'] = {};
		for (const [tabId, entry] of Object.entries(registry.tabs)) {
			if (!entry || typeof entry !== 'object') continue;
			if (typeof entry.seenAt !== 'number' || !Number.isFinite(entry.seenAt)) continue;
			tabs[tabId] = { seenAt: entry.seenAt };
		}

		return {
			version: 1,
			tabs,
			...(registry.lastEmptyAt === undefined ? {} : { lastEmptyAt: registry.lastEmptyAt })
		};
	} catch {
		return null;
	}
}

export function pruneTabRegistry(
	registry: StoredTabRegistry | null,
	now: number
): { registry: StoredTabRegistry; changed: boolean } {
	const source = registry ?? emptyTabRegistry();
	const tabs: StoredTabRegistry['tabs'] = {};
	let changed = registry === null;

	for (const [tabId, entry] of Object.entries(source.tabs)) {
		if (now - entry.seenAt <= STALE_TAB_MS) {
			tabs[tabId] = entry;
		} else {
			changed = true;
		}
	}

	const pruned: StoredTabRegistry = {
		version: 1,
		tabs,
		...(source.lastEmptyAt === undefined ? {} : { lastEmptyAt: source.lastEmptyAt })
	};

	if (
		Object.keys(tabs).length === 0 &&
		Object.keys(source.tabs).length > 0 &&
		!pruned.lastEmptyAt
	) {
		pruned.lastEmptyAt = now;
		changed = true;
	}

	return { registry: pruned, changed };
}

export function resolveStoredTheme(input: {
	currentSystemMode: Mode;
	now: number;
	isReload: boolean;
	storedState: StoredThemeState | null;
	storedRegistry: StoredTabRegistry | null;
	writerTabId: string;
}): ThemeResolution {
	const { registry, changed } = pruneTabRegistry(input.storedRegistry, input.now);
	const activeTabCount = Object.keys(registry.tabs).length;
	const isRecentReload =
		input.isReload &&
		typeof registry.lastEmptyAt === 'number' &&
		input.now - registry.lastEmptyAt <= RELOAD_GRACE_MS;
	const hasContinuity = activeTabCount > 0 || isRecentReload;
	const systemState = createSystemState(input.currentSystemMode, input.now, input.writerTabId);

	if (input.storedState && hasContinuity) {
		if (input.storedState.systemMode !== input.currentSystemMode) {
			return {
				mode: input.currentSystemMode,
				state: systemState,
				registry,
				hasContinuity,
				shouldWriteState: true,
				shouldRemoveState: false,
				shouldWriteRegistry: changed
			};
		}

		return {
			mode: input.storedState.mode,
			state: input.storedState,
			registry,
			hasContinuity,
			shouldWriteState: false,
			shouldRemoveState: false,
			shouldWriteRegistry: changed
		};
	}

	return {
		mode: input.currentSystemMode,
		state: systemState,
		registry,
		hasContinuity,
		shouldWriteState: false,
		shouldRemoveState: input.storedState !== null,
		shouldWriteRegistry: changed
	};
}

export function isStateNewer(candidate: StoredThemeState, current: StoredThemeState): boolean {
	if (candidate.updatedAt !== current.updatedAt) return candidate.updatedAt > current.updatedAt;
	return candidate.writerTabId > current.writerTabId;
}

export function resolveExternalThemeState(input: {
	incomingState: StoredThemeState;
	currentState: StoredThemeState;
	currentMode: Mode;
	currentSystemMode: Mode;
}): ExternalThemeStateAction {
	const { incomingState, currentState, currentMode, currentSystemMode } = input;

	if (incomingState.systemMode !== currentSystemMode) {
		return incomingState.source === 'system' ? 'ignore' : 'publish-system';
	}

	if (isStateNewer(incomingState, currentState) || incomingState.mode !== currentMode) {
		return 'adopt';
	}

	return 'ignore';
}

export function readThemeState(storage: StorageLike): StoredThemeState | null {
	return parseThemeState(storage.getItem(THEME_STATE_KEY));
}

export function readTabRegistry(storage: StorageLike): StoredTabRegistry | null {
	return parseTabRegistry(storage.getItem(THEME_TABS_KEY));
}

export function writeThemeState(storage: StorageLike, state: StoredThemeState) {
	storage.setItem(THEME_STATE_KEY, JSON.stringify(state));
}

export function writeTabRegistry(storage: StorageLike, registry: StoredTabRegistry) {
	storage.setItem(THEME_TABS_KEY, JSON.stringify(registry));
}

export function removeThemeState(storage: StorageLike) {
	storage.removeItem(THEME_STATE_KEY);
}
