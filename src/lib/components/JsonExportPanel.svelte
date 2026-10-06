<script lang="ts">
	import HighlightedCode from '$lib/components/HighlightedCode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { buildQuotationFile, formatQuotationFile } from '$lib/quotationFile';
	import { colors } from '$lib/constants/colors';
	import { theme as appTheme } from '$lib/theme';

	const alignment = getAlignmentContext();

	// The quotation file Verbarium commits, exactly as it should be saved.
	const quotationFile = $derived(
		formatQuotationFile(
			buildQuotationFile(alignment.exportData, { provenance: alignment.provenance })
		)
	);
	const provenanceMissing = $derived(alignment.provenance.trim() === '');

	let copied = $state(false);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;

	async function copy() {
		await navigator.clipboard.writeText(quotationFile);
		copied = true;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copied = false), 1500);
	}

	// The author renames the file to its Quote asset name when committing it.
	function download() {
		const url = URL.createObjectURL(new Blob([quotationFile], { type: 'application/json' }));
		const link = document.createElement('a');
		link.href = url;
		link.download = 'quotation.json';
		link.click();
		URL.revokeObjectURL(url);
	}

	// Highlight palette tracks the theme so the JSON panel doesn't stay in
	// light-theme colours under dark theme. Strings/numbers/null draw from the
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
		// numbers and null
		'#bd93f9': colors.azure[shade].base
	});
</script>

<div class="shiki-export no-scrollbar h-full w-full overflow-auto p-6 text-xs">
	<div class="mb-4 flex items-center gap-3">
		<button
			type="button"
			class="rounded border border-current/25 px-2 py-1 opacity-70 transition-opacity hover:opacity-100"
			onclick={copy}
		>
			{copied ? 'Copied' : 'Copy'}
		</button>
		<button
			type="button"
			class="rounded border border-current/25 px-2 py-1 opacity-70 transition-opacity hover:opacity-100"
			onclick={download}
		>
			Download
		</button>
		{#if provenanceMissing}
			<p role="status" class="opacity-60">
				No provenance yet: Verbarium rejects a quotation file without one.
			</p>
		{/if}
	</div>
	<HighlightedCode code={quotationFile} {colorMap} />
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
