import { getContext, onMount, setContext } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';

const BREAKPOINT_KEY = Symbol('breakpoints');

// BreakpointContext owns every viewport predicate used to classify macro layout.
// CSS and UI consumers receive only the resulting one-hot layoutMode.
const WIDE_QUERY = '(min-width: 1200px)';
const NARROW_QUERY = '(width < 900px)';
// Tall is intentionally independent from width. Combined with narrow below, it
// guarantees portrait because height >= 1000px and width < 900px.
const TALL_QUERY = '(min-height: 1000px)';

export type LayoutMode = 'double' | 'single' | 'bottom' | 'drawer';

class BreakpointContext {
	// Keep SSR and hydration on the same fallback until the real viewport is available.
	#mounted = $state(false);
	#isWide = new MediaQuery(WIDE_QUERY);
	#isNarrow = new MediaQuery(NARROW_QUERY);
	#isTall = new MediaQuery(TALL_QUERY);

	layoutMode: LayoutMode = $derived.by(() => {
		if (!this.#mounted) return 'single';
		if (this.#isWide.current) return 'double';
		if (!this.#isNarrow.current) return 'single';
		return this.#isTall.current ? 'bottom' : 'drawer';
	});

	constructor() {
		onMount(() => {
			this.#mounted = true;
		});
	}
}

export function setBreakpointContext(): BreakpointContext {
	return setContext(BREAKPOINT_KEY, new BreakpointContext());
}

export function getBreakpointContext(): BreakpointContext {
	return getContext<BreakpointContext>(BREAKPOINT_KEY);
}
