import { describe, expect, it } from 'vitest';
import {
	parseThemeState,
	resolveTheme,
	systemThemeState,
	toTheme,
	userThemeState
} from './themeState';

describe('parseThemeState', () => {
	it('accepts a valid v3 state', () => {
		const state = userThemeState('dark', 'light');
		expect(parseThemeState(JSON.stringify(state))).toEqual(state);
	});

	it('migrates a valid v2 state', () => {
		expect(
			parseThemeState(
				JSON.stringify({
					version: 2,
					mode: 'dark',
					source: 'user',
					osAtPick: 'light'
				})
			)
		).toEqual(userThemeState('dark', 'light'));
	});

	it('rejects null, corrupt json, v1, and bad fields', () => {
		expect(parseThemeState(null)).toBeNull();
		expect(parseThemeState('{"version":3,"theme":"dark"')).toBeNull();
		expect(
			parseThemeState(
				JSON.stringify({
					version: 1,
					theme: 'dark',
					source: 'user',
					osThemeAtPick: 'light'
				})
			)
		).toBeNull();
		expect(
			parseThemeState(
				JSON.stringify({
					version: 3,
					theme: 'blue',
					source: 'user',
					osThemeAtPick: 'light'
				})
			)
		).toBeNull();
		expect(
			parseThemeState(
				JSON.stringify({
					version: 3,
					theme: 'dark',
					source: 'x',
					osThemeAtPick: 'light'
				})
			)
		).toBeNull();
		expect(
			parseThemeState(JSON.stringify({ version: 3, theme: 'dark', source: 'user' }))
		).toBeNull();
	});
});

describe('resolveTheme (last change wins, OS-drift-aware)', () => {
	it('follows the OS on a first visit', () => {
		const result = resolveTheme(null, 'dark');
		expect(result.theme).toBe('dark');
		expect(result.state).toEqual(systemThemeState('dark'));
		expect(result.fresh).toBe(true);
	});

	it('restores a manual pick when the OS has not changed while away', () => {
		const pick = userThemeState('dark', 'light');
		const result = resolveTheme(pick, 'light');
		expect(result.theme).toBe('dark');
		expect(result.state).toBe(pick);
		expect(result.fresh).toBe(false);
	});

	it('lets the OS win when it changed while away (drift)', () => {
		const pick = userThemeState('dark', 'light');
		const result = resolveTheme(pick, 'dark');
		expect(result.theme).toBe('dark');
		expect(result.state).toEqual(systemThemeState('dark'));
		expect(result.fresh).toBe(true);
	});

	it('restores a stored system state unchanged when the OS is steady', () => {
		const stored = systemThemeState('dark');
		const result = resolveTheme(stored, 'dark');
		expect(result.theme).toBe('dark');
		expect(result.state).toBe(stored);
		expect(result.fresh).toBe(false);
	});

	it('treats corrupt storage as a first visit', () => {
		const result = resolveTheme(parseThemeState('nonsense'), 'light');
		expect(result.theme).toBe('light');
		expect(result.fresh).toBe(true);
	});
});

describe('toTheme', () => {
	it('maps the media-query boolean to a theme', () => {
		expect(toTheme(true)).toBe('dark');
		expect(toTheme(false)).toBe('light');
	});
});
