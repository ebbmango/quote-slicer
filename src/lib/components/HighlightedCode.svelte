<script lang="ts">
	import type { BundledLanguage, BundledTheme, ThemedToken } from 'shiki';

	let {
		code,
		lang = 'json',
		theme = 'github-light'
	}: { code: string; lang?: BundledLanguage; theme?: BundledTheme } = $props();

	let lines: ThemedToken[][] = $state([]);

	$effect(() => {
		const currentCode = code;
		import('shiki')
			.then(({ codeToTokens }) => codeToTokens(currentCode, { lang, theme }))
			.then((result) => {
				lines = result.tokens;
			});
	});
</script>

<!-- prettier-ignore -->
<pre class="highlighted-code"><code>{#each lines as line, i (i)}{#each line as token, j (j)}<span style="color: {token.color}">{token.content}</span>{/each}
{/each}</code></pre>

<style>
	.highlighted-code {
		margin: 0;
		white-space: pre;
	}
</style>
