import { getContext, onMount, setContext } from 'svelte';

const BREAKPOINT_KEY = Symbol('breakpoints');

// Keep these queries in sync with the @media blocks in <style>.
const WIDE_QUERY = '(min-width: 1200px)';
const BELOW_MEDIUM_QUERY = '(max-width: 899px)';
const TABLET_PORTRAIT_QUERY =
	'(orientation: portrait) and (min-height: 1000px) and (max-width: 899px)';

class BreakpointContext {
	wide = $state(false);
	belowMedium = $state(false);
	tabletPortrait = $state(false);
	// Minimal viewport = below medium AND not the tall-portrait tablet layout.
	// Only here does the maps/json toggle open a modal instead of an aside.
	minimal = $derived(this.belowMedium && !this.tabletPortrait);
}

export function setBreakpointContext(): BreakpointContext {
	const ctx = new BreakpointContext();

	onMount(() => {
		const mqWide = window.matchMedia(WIDE_QUERY);
		const mqBelowMedium = window.matchMedia(BELOW_MEDIUM_QUERY);
		const mqTablet = window.matchMedia(TABLET_PORTRAIT_QUERY);

		ctx.wide = mqWide.matches;
		ctx.belowMedium = mqBelowMedium.matches;
		ctx.tabletPortrait = mqTablet.matches;

		const handleWide = (e: MediaQueryListEvent) => (ctx.wide = e.matches);
		const handleBelowMedium = (e: MediaQueryListEvent) => (ctx.belowMedium = e.matches);
		const handleTablet = (e: MediaQueryListEvent) => (ctx.tabletPortrait = e.matches);

		mqWide.addEventListener('change', handleWide);
		mqBelowMedium.addEventListener('change', handleBelowMedium);
		mqTablet.addEventListener('change', handleTablet);

		return () => {
			mqWide.removeEventListener('change', handleWide);
			mqBelowMedium.removeEventListener('change', handleBelowMedium);
			mqTablet.removeEventListener('change', handleTablet);
		};
	});

	return setContext(BREAKPOINT_KEY, ctx);
}

export function getBreakpointContext(): BreakpointContext {
	return getContext<BreakpointContext>(BREAKPOINT_KEY);
}
