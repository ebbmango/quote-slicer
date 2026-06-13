<script lang="ts">
	import type { BundledLanguage, BundledTheme, ThemedToken } from 'shiki';

	let {
		code,
		lang = 'json',
		theme = 'dracula',
		colorReplacements
	}: {
		code: string;
		lang?: BundledLanguage;
		theme?: BundledTheme;
		colorReplacements?: Record<string, Record<string, string>>;
	} = $props();

	let lines: ThemedToken[][] = $state([]);

	$effect(() => {
		const currentCode = code;
		import('shiki')
			.then(({ codeToTokens }) => codeToTokens(currentCode, { lang, theme, colorReplacements }))
			.then((result) => {
				lines = result.tokens;
			});
	});
</script>

<!-- prettier-ignore -->
<!-- Inside <pre>, every whitespace char is rendered literally — keep this on as few
     lines as possible. Reformatting adds newlines/indentation between tokens. -->
<pre class="highlighted-code"><code>{#each lines as line, i (i)}{#each line as token, j (j)}<span style="color: {token.color}">{token.content}</span>{/each}
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
