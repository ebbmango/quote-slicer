<script lang="ts">
	import type { BundledLanguage, BundledTheme, ThemedToken } from 'shiki';

	let {
		code,
		lang = 'json',
		theme = 'dracula',
		colorMap
	}: {
		code: string;
		lang?: BundledLanguage;
		theme?: BundledTheme;
		// Synchronous recolour: raw theme colour → app-palette colour, applied at
		// render, so a light↔dark swap changes inline colours in the same frame.
		colorMap?: Record<string, string>;
	} = $props();

	let lines: ThemedToken[][] = $state([]);

	$effect(() => {
		// Tokenize with the raw theme only — structure and base colours depend on
		// code/lang/theme, never on the palette. The light↔dark recolour is applied
		// synchronously at render via colorMap, NOT here: re-tokenizing on a theme flip
		// was async, so the JSON panel's colours snapped ~one frame late while the rest
		// of the page eased. Theme-independent tokenization lets the flip recolour in
		// the same frame and ride the theme-anim transition.
		const currentCode = code;
		const currentLang = lang;
		const currentTheme = theme;
		import('shiki')
			.then(({ codeToTokens }) =>
				codeToTokens(currentCode, {
					lang: currentLang,
					theme: currentTheme
				})
			)
			.then((result) => {
				lines = result.tokens;
			});
	});
</script>

<!-- Inside <pre>, every whitespace char is rendered literally — keep this on as few
     lines as possible. Reformatting adds newlines/indentation between tokens, which
     then render as broken indentation in the export, so prettier-ignore guards it. -->
<!-- prettier-ignore -->
<pre class="highlighted-code"><code>{#each lines as line, i (i)}{#each line as token, j (j)}<span style="color: {colorMap?.[(token.color ?? '').toLowerCase()] ?? token.color}">{token.content}</span>{/each}
{/each}</code></pre>

<style>
	.highlighted-code {
		margin: 0;
		/* grow to longest line so panel padding reaches past overflowing text */
		width: max-content;
		white-space: pre;
		font-family: 'JetBrains Mono', ui-monospace, monospace;
	}

	.highlighted-code :global(code) {
		font-family: inherit;
	}
</style>
