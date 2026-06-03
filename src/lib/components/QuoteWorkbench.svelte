<script lang="ts">
	import { getModeContext } from '$lib/context/mode.svelte';

	let {
		sourceText = $bindable(),
		targetText = $bindable(),
		authorship = $bindable(),
		autosize
	} = $props();
	let composing = $state(false);

	let mode = getModeContext();
	let disabled = $derived(() => mode.current !== 'text');
</script>

<textarea
	id="source-text"
	name="source-text"
	bind:value={sourceText}
	rows="1"
	use:autosize
	{disabled}
	oncompositionstart={() => (composing = true)}
	oninput={(e) => {
		if (e.isComposing) return;
		const el = e.currentTarget;
		const start = el.selectionStart ?? 0;
		const end = el.selectionEnd ?? 0;
		const filtered = el.value.replace(/[^\p{Script=Han}　-〿＀-￯]/gu, '');
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
		const filtered = el.value.replace(/[^\p{Script=Han}　-〿＀-￯]/gu, '');
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
	{disabled}
	id="target-text"
	name="target-text"
	bind:value={targetText}
	rows="1"
	use:autosize
	class="max-h-[25vh] w-full resize-none overflow-y-auto bg-transparent text-center font-ss4 text-base font-[350] italic outline-none"
	placeholder="Use this box to enter your translated text."
></textarea>
<textarea
	{disabled}
	id="authorship"
	name="authorship"
	bind:value={authorship}
	rows="1"
	use:autosize
	class="max-h-[10vh] w-full resize-none overflow-y-auto bg-transparent text-center font-ss4 text-sm font-[350] opacity-40 outline-none"
	placeholder="Source"
></textarea>
