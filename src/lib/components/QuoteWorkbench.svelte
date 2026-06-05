<script lang="ts">
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getLinkContext } from '$lib/context/link.svelte';
	import { tokenizeSource, tokenizeTargetSeparate } from '$lib/tokenize';
	import InteractiveSourceText from '$lib/components/InteractiveSourceText.svelte';
	import InteractiveTargetText from '$lib/components/InteractiveTargetText.svelte';

	let {
		sourceText = $bindable(),
		targetText = $bindable(),
		authorship = $bindable(),
		autosize
	} = $props();
	let composing = $state(false);

	let mode = getModeContext();
	let editing = $derived(mode.current === 'text');
	const link = getLinkContext();

	let sourceTokens = $derived(tokenizeSource(sourceText));
	let targetTokens = $derived(tokenizeTargetSeparate(targetText));

	$effect(() => {
		link.sourceTokens = sourceTokens;
		link.targetTokens = targetTokens;
	});
</script>

{#if editing}
	<textarea
		id="source-text"
		name="source-text"
		bind:value={sourceText}
		rows="1"
		use:autosize
		oncompositionstart={() => (composing = true)}
		oninput={(e) => {
			if ((e as InputEvent).isComposing) return;
			const el = e.currentTarget;
			const start = el.selectionStart ?? 0;
			const end = el.selectionEnd ?? 0;
			const filtered = el.value.replace(/[^\p{Script=Han}\u3000-\u303F\uFF00-\uFFEF]/gu, '');
			const removed = el.value.length - filtered.length;
			if (removed > 0) {
				el.value = filtered;
				sourceText = filtered;
				el.setSelectionRange(start - removed, end - removed);
			}
		}}
		oncompositionend={(e) => {
			composing = false;
			const el = e.currentTarget;
			const start = el.selectionStart ?? 0;
			const end = el.selectionEnd ?? 0;
			const filtered = el.value.replace(/[^\p{Script=Han}\u3000-\u303F\uFF00-\uFFEF]/gu, '');
			const removed = el.value.length - filtered.length;
			if (removed > 0) {
				el.value = filtered;
				sourceText = filtered;
				el.setSelectionRange(start - removed, end - removed);
			}
		}}
		class="max-h-[40vh] w-full resize-none overflow-y-auto bg-transparent text-center text-3xl font-light opacity-30 outline-none {composing
			? 'font-ss4'
			: 'font-wenkai'}"
		placeholder="空"
	></textarea>
	<textarea
		id="target-text"
		name="target-text"
		bind:value={targetText}
		rows="1"
		use:autosize
		class="max-h-[25vh] w-full resize-none overflow-y-auto bg-transparent text-center font-ss4 text-base font-[350] italic outline-none"
		placeholder="Use this box to enter your translated text."
	></textarea>
{:else}
	<InteractiveSourceText tokens={sourceTokens} />
	<InteractiveTargetText tokens={targetTokens} />
{/if}
<textarea
	id="authorship"
	name="authorship"
	bind:value={authorship}
	disabled={mode.current !== "text"}
	rows="1"
	use:autosize
	class="max-h-[10vh] w-full resize-none overflow-y-auto bg-transparent text-center font-ss4 text-sm font-[350] opacity-40 outline-none"
	placeholder="Source"
></textarea>
