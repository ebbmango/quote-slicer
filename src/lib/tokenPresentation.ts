import type { TokenState } from '$lib/tokenState';
import { HIGHLIGHT_COLOR } from '$lib/constants/colors';

// The per-token color/opacity/weight/focus decision, shared by both interactive
// panels. DOM-free and pure so it's unit-testable and lives in one place instead
// of being copied into each panel's `tokenStyle` / `tokenOpacity`.
//
// `state` is only read in link mode; callers pass `null` outside it (and for source
// punctuation, which never carries a mapping state). `viewOpacity` and `fontWeight`
// are the only per-panel differences: source uses opacity-80 / no weight, target
// uses opacity-85 / a 350|600 weight.
export function tokenPresentation(o: {
	mode: 'link' | 'line' | 'view';
	state: TokenState | null;
	focused: boolean;
	highlighted: boolean;
	viewOpacity: string;
	fontWeight: boolean;
}): { style: string; opacityClass: string } {
	const { mode, state, focused, highlighted, viewOpacity, fontWeight } = o;

	if (mode === 'line') return { style: '', opacityClass: 'opacity-70' };

	if (mode === 'view') {
		return {
			style: highlighted ? `color: ${HIGHLIGHT_COLOR};` : '',
			opacityClass: highlighted ? 'opacity-100' : viewOpacity
		};
	}

	// link mode — source punctuation (state null) gets no color, just dimmed.
	if (state === null) return { style: '', opacityClass: 'opacity-30' };

	const weight = (px: string) => (fontWeight ? ` font-weight: ${px};` : '');

	let style = '';
	if (state.kind === 'active') {
		style = `color: ${state.color};${weight('600')}${focused ? ' filter: brightness(0.75);' : ''}`;
	} else if (state.kind === 'idle') {
		style = focused ? `color: ${state.color};${weight('350')}` : weight('350').trimStart();
	} else {
		style = weight('350').trimStart(); // unmapped
	}

	let opacityClass = '';
	if (state.kind === 'unmapped') opacityClass = focused ? 'opacity-50' : 'opacity-30';
	else if (state.kind === 'idle') opacityClass = 'opacity-70';
	// active → '' (the spans inherit full opacity)

	return { style, opacityClass };
}
