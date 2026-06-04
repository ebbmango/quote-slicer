import { getContext, setContext } from 'svelte';

export type Mode = 'text' | 'link' | 'part' | 'join' | 'view';

const MODE_KEY = Symbol('mode');

class ModeContext {
	current = $state<Mode>('text');
}

export function setModeContext(): ModeContext {
	return setContext(MODE_KEY, new ModeContext());
}

export function getModeContext(): ModeContext {
	return getContext<ModeContext>(MODE_KEY);
}
