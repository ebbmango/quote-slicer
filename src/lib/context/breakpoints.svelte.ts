import { getContext, onMount, setContext } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';

const BREAKPOINT_KEY = Symbol('breakpoints');

// Keep these queries in sync with the layout @media blocks in src/routes/+page.svelte.
const WIDE_QUERY = '(min-width: 1200px)';
const NARROW_QUERY = '(max-width: 899px)';
const TALL_NARROW_PORTRAIT_QUERY =
	'(orientation: portrait) and (min-height: 1000px) and (max-width: 899px)';

export type LayoutMode = 'dual' | 'single' | 'stacked' | 'mini';

class BreakpointContext {
	// Keep SSR and hydration on the same fallback until the real viewport is available.
	#mounted = $state(false);
	#isWide = new MediaQuery(WIDE_QUERY);
	#isNarrow = new MediaQuery(NARROW_QUERY);
	#isTallNarrowPortrait = new MediaQuery(TALL_NARROW_PORTRAIT_QUERY);

	layoutMode: LayoutMode = $derived.by(() => {
		if (!this.#mounted) return 'single';
		if (this.#isWide.current) return 'dual';
		if (!this.#isNarrow.current) return 'single';
		return this.#isTallNarrowPortrait.current ? 'stacked' : 'mini';
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
