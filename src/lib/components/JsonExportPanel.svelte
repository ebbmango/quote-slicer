<script lang="ts">
	import HighlightedCode from '$lib/components/HighlightedCode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { formatExport } from '$lib/exportFormat';
	import { colors } from '$lib/constants/colors';
	import { theme as appTheme } from '$lib/theme';

	const alignment = getAlignmentContext();

	const exportJson = $derived(formatExport(alignment.exportData));

	// Highlight palette tracks the theme so the JSON panel doesn't stay in
	// light-mode colours under dark mode. Strings/numbers/undefined draw from the
	// matching light|dark mapping shade; the neutral grey (props, colons, braces)
	// is dimmed for the dark panel background.
	const isDark = $derived(appTheme.current === 'dark');
	const shade = $derived(isDark ? 'dark' : 'light');
	const neutral = $derived(isDark ? '#8a8a8a' : '#A8A8A8');
	// Raw dracula colour → app-palette colour. HighlightedCode tokenizes with the raw
	// dracula theme (theme-independent) and applies this map synchronously at render,
	// so a theme flip recolours the JSON in the same frame as the rest of the page and
	// rides the theme-anim colour transition instead of snapping a frame late.
	// Kept as a $derived Identifier so the prop passed to HighlightedCode stays stable
	// across unrelated parent updates (an inline object literal would be a new ref each render).
	const colorMap = $derived({
		// strings
		'#f1fa8c': colors.compostella[shade].base,
		'#e9f284': colors.compostella[shade].base,
		// properties
		'#8be9fe': neutral,
		'#8be9fd': neutral,
		// colons & brackets
		'#ff79c6': neutral,
		'#f8f8f2': neutral,
		// numbers
		'#bd93f9': colors.azure[shade].base,
		// undefined
		'#ff5555': colors.sugar[shade].base
	});
</script>

<div class="shiki-export h-full w-full overflow-auto p-6 text-xs no-scrollbar">
	<HighlightedCode code={exportJson} {colorMap} />
</div>

<style lang="postcss">
	.shiki-export :global(pre) {
		background: transparent !important;
	}

	/* Shiki spans carry an explicit inline colour (the app palette, per theme), so
	   unlike inherited text they must transition their OWN colour on a theme flip —
	   scoped to the theme-anim window so live export edits still recolour instantly.
	   Explicit colour = no inheritance compounding, so this is flicker-free. */
	:global(html.theme-anim) .shiki-export :global(span) {
		transition: color 500ms ease;
	}
</style>
