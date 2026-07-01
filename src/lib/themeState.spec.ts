import { describe, expect, it } from 'vitest';
import { parseThemeState, resolveTheme, systemState, toMode, userState } from './themeState';

describe('parseThemeState', () => {
	it('accepts a valid v2 state', () => {
		const state = userState('dark', 'light');
		expect(parseThemeState(JSON.stringify(state))).toEqual(state);
	});

	it('rejects null, corrupt json, the old version, and bad fields', () => {
		expect(parseThemeState(null)).toBeNull();
		expect(parseThemeState('{"version":2,"mode":"dark"')).toBeNull();
		expect(
			parseThemeState(JSON.stringify({ version: 1, mode: 'dark', source: 'user', osAtPick: 'light' }))
		).toBeNull();
		expect(
			parseThemeState(JSON.stringify({ version: 2, mode: 'blue', source: 'user', osAtPick: 'light' }))
		).toBeNull();
		expect(
			parseThemeState(JSON.stringify({ version: 2, mode: 'dark', source: 'x', osAtPick: 'light' }))
		).toBeNull();
		expect(parseThemeState(JSON.stringify({ version: 2, mode: 'dark', source: 'user' }))).toBeNull();
	});
});

describe('resolveTheme (last change wins, OS-drift-aware)', () => {
	it('follows the OS on a first visit', () => {
		const result = resolveTheme(null, 'dark');
		expect(result.mode).toBe('dark');
		expect(result.state).toEqual(systemState('dark'));
		expect(result.fresh).toBe(true);
	});

	it('restores a manual pick when the OS has not changed while away', () => {
		const pick = userState('dark', 'light');
		const result = resolveTheme(pick, 'light');
		expect(result.mode).toBe('dark');
		expect(result.state).toBe(pick);
		expect(result.fresh).toBe(false);
	});

	it('lets the OS win when it changed while away (drift)', () => {
		const pick = userState('dark', 'light');
		const result = resolveTheme(pick, 'dark');
		expect(result.mode).toBe('dark');
		expect(result.state).toEqual(systemState('dark'));
		expect(result.fresh).toBe(true);
	});

	it('restores a stored system state unchanged when the OS is steady', () => {
		const stored = systemState('dark');
		const result = resolveTheme(stored, 'dark');
		expect(result.mode).toBe('dark');
		expect(result.state).toBe(stored);
		expect(result.fresh).toBe(false);
	});

	it('treats corrupt storage as a first visit', () => {
		const result = resolveTheme(parseThemeState('nonsense'), 'light');
		expect(result.mode).toBe('light');
		expect(result.fresh).toBe(true);
	});
});

describe('toMode', () => {
	it('maps the media-query boolean to a mode', () => {
		expect(toMode(true)).toBe('dark');
		expect(toMode(false)).toBe('light');
	});
});
