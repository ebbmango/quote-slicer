import { getContext, onMount, setContext } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';

const BREAKPOINT_KEY = Symbol('breakpoints');

// Keep these thresholds and their combinations in sync with the layout @media blocks.
const WIDE_QUERY = '(min-width: 1200px)';
// NOTE: the existing max-899/min-900 split can diverge at fractional widths.
// Fix it only by moving this and every CSS mirror to complementary ranges together.
const NARROW_QUERY = '(max-width: 899px)';
// Tall is intentionally independent from width. Combined with narrow below, it
// also guarantees portrait because 1000px > 899px; revisit if either limit changes.
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
