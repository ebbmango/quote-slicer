import { describe, it, expect } from 'vitest';
import { tokenPresentation } from './tokenPresentation';
import { HIGHLIGHT_COLOR } from './constants/colors';
import type { TokenState } from './tokenState';

const C = 'rgb(1,2,3)';
const active: TokenState = { kind: 'active', color: C };
const idle: TokenState = { kind: 'idle', color: C };
const unmapped: TokenState = { kind: 'unmapped' };

// Locks the exact strings the two panels produced before the extraction. If any
// of these change, the visible token color/opacity/weight changed — which the
// refactor must NOT do.
const src = (state: TokenState | null, focused: boolean) =>
	tokenPresentation({ mode: 'link', state, focused, highlighted: false, viewOpacity: 'opacity-80', fontWeight: false });
const tgt = (state: TokenState | null, focused: boolean) =>
	tokenPresentation({ mode: 'link', state, focused, highlighted: false, viewOpacity: 'opacity-85', fontWeight: true });

describe('tokenPresentation — source (link mode, no font-weight)', () => {
	it('active', () => expect(src(active, false)).toEqual({ style: `color: ${C};`, opacityClass: '' }));
	it('active + focused', () =>
		expect(src(active, true)).toEqual({ style: `color: ${C}; filter: brightness(0.75);`, opacityClass: '' }));
	it('idle', () => expect(src(idle, false)).toEqual({ style: '', opacityClass: 'opacity-70' }));
	it('idle + focused', () => expect(src(idle, true)).toEqual({ style: `color: ${C};`, opacityClass: 'opacity-70' }));
	it('unmapped', () => expect(src(unmapped, false)).toEqual({ style: '', opacityClass: 'opacity-30' }));
	it('unmapped + focused', () => expect(src(unmapped, true)).toEqual({ style: '', opacityClass: 'opacity-50' }));
	it('punctuation (null state)', () => expect(src(null, false)).toEqual({ style: '', opacityClass: 'opacity-30' }));
});

describe('tokenPresentation — target (link mode, font-weight)', () => {
	it('active', () =>
		expect(tgt(active, false)).toEqual({ style: `color: ${C}; font-weight: 600;`, opacityClass: '' }));
	it('active + focused', () =>
		expect(tgt(active, true)).toEqual({
			style: `color: ${C}; font-weight: 600; filter: brightness(0.75);`,
			opacityClass: ''
		}));
	it('idle', () => expect(tgt(idle, false)).toEqual({ style: 'font-weight: 350;', opacityClass: 'opacity-70' }));
	it('idle + focused', () =>
		expect(tgt(idle, true)).toEqual({ style: `color: ${C}; font-weight: 350;`, opacityClass: 'opacity-70' }));
	it('unmapped', () =>
		expect(tgt(unmapped, false)).toEqual({ style: 'font-weight: 350;', opacityClass: 'opacity-30' }));
	it('unmapped + focused', () =>
		expect(tgt(unmapped, true)).toEqual({ style: 'font-weight: 350;', opacityClass: 'opacity-50' }));
});

describe('tokenPresentation — line & view (panel-agnostic but for viewOpacity)', () => {
	it('line', () =>
		expect(tokenPresentation({ mode: 'line', state: null, focused: false, highlighted: false, viewOpacity: 'opacity-80', fontWeight: false }))
			.toEqual({ style: '', opacityClass: 'opacity-70' }));
	it('view, not highlighted', () =>
		expect(tokenPresentation({ mode: 'view', state: null, focused: false, highlighted: false, viewOpacity: 'opacity-85', fontWeight: true }))
			.toEqual({ style: '', opacityClass: 'opacity-85' }));
	it('view, highlighted', () =>
		expect(tokenPresentation({ mode: 'view', state: null, focused: false, highlighted: true, viewOpacity: 'opacity-80', fontWeight: false }))
			.toEqual({ style: `color: ${HIGHLIGHT_COLOR};`, opacityClass: 'opacity-100' }));
});
