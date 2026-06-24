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
	const dracula = $derived({
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
	// Pre-build as $derived so the prop passes a simple Identifier to HighlightedCode.
	// An inline object literal ({ dracula }) is an ObjectExpression — Svelte 5 wraps it
	// in $.derived() and re-evaluates it on every parent update, creating a new reference
	// even when dracula hasn't changed and triggering a spurious codeToTokens() call.
	const colorReplacements = $derived({ dracula });
</script>

<div class="shiki-export h-full w-full overflow-auto p-6 text-xs no-scrollbar">
	<HighlightedCode code={exportJson} {colorReplacements} />
</div>

<style lang="postcss">
	.shiki-export :global(pre) {
		background: transparent !important;
	}
</style>
