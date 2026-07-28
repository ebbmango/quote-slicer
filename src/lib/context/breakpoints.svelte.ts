import { getContext, onMount, setContext } from 'svelte';

const BREAKPOINT_KEY = Symbol('breakpoints');

// Keep these queries in sync with the layout @media blocks in src/routes/+page.svelte.
const WIDE_QUERY = '(min-width: 1200px)';
const NARROW_QUERY = '(max-width: 899px)';
const TALL_NARROW_PORTRAIT_QUERY =
	'(orientation: portrait) and (min-height: 1000px) and (max-width: 899px)';

export type LayoutMode = 'dual' | 'single' | 'stacked' | 'mini';

class BreakpointContext {
	isWide = $state(false);
	isNarrow = $state(false);
	isTallNarrowPortrait = $state(false);

	layoutMode: LayoutMode = $derived(
		this.isWide
			? 'dual'
			: this.isNarrow
				? this.isTallNarrowPortrait
					? 'stacked'
					: 'mini'
				: 'single'
	);
}

export function setBreakpointContext(): BreakpointContext {
	const ctx = new BreakpointContext();

	onMount(() => {
		const mqWide = window.matchMedia(WIDE_QUERY);
		const mqNarrow = window.matchMedia(NARROW_QUERY);
		const mqTallNarrowPortrait = window.matchMedia(TALL_NARROW_PORTRAIT_QUERY);

		ctx.isWide = mqWide.matches;
		ctx.isNarrow = mqNarrow.matches;
		ctx.isTallNarrowPortrait = mqTallNarrowPortrait.matches;

		const handleWide = (e: MediaQueryListEvent) => (ctx.isWide = e.matches);
		const handleNarrow = (e: MediaQueryListEvent) => (ctx.isNarrow = e.matches);
		const handleTallNarrowPortrait = (e: MediaQueryListEvent) =>
			(ctx.isTallNarrowPortrait = e.matches);

		mqWide.addEventListener('change', handleWide);
		mqNarrow.addEventListener('change', handleNarrow);
		mqTallNarrowPortrait.addEventListener('change', handleTallNarrowPortrait);

		return () => {
			mqWide.removeEventListener('change', handleWide);
			mqNarrow.removeEventListener('change', handleNarrow);
			mqTallNarrowPortrait.removeEventListener('change', handleTallNarrowPortrait);
		};
	});

	return setContext(BREAKPOINT_KEY, ctx);
}

export function getBreakpointContext(): BreakpointContext {
	return getContext<BreakpointContext>(BREAKPOINT_KEY);
}
