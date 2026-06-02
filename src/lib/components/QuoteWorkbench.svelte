<script lang="ts">
	let { sourceText, targetText, authorship, autosize } = $props();
</script>

<textarea
	id="source-text"
	name="source-text"
	bind:value={sourceText}
	rows="1"
	use:autosize
	class="max-h-[40vh] w-full resize-none overflow-y-auto bg-transparent text-center font-wenkai text-3xl font-light opacity-30 outline-none"
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
<textarea
	id="authorship"
	name="authorship"
	bind:value={authorship}
	rows="1"
	use:autosize
	class="max-h-[10vh] w-full resize-none overflow-y-auto bg-transparent text-center font-ss4 text-sm font-[350] opacity-40 outline-none"
	placeholder="Source"
></textarea>
