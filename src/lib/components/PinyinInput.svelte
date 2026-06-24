<script lang="ts">
	// One pinyin cell. While focused it shows the user's raw keystrokes untouched
	// (a local edit buffer), so typing canonical input like "zhi1" never gets
	// reformatted to "zhī" mid-edit. The display value (diacritic, derived from
	// the canonical store) only drives the field when it is not being edited.
	// The buffer is committed once, on blur, via `onCommit`.

	let {
		value,
		disabled = false,
		tabindex = -1,
		color,
		opacity,
		onCommit
	}: {
		value: string;
		disabled?: boolean;
		tabindex?: number;
		color: string;
		opacity: number;
		onCommit?: (raw: string) => void;
	} = $props();

	let buffer = $state<string | null>(null);

	const shown = $derived(buffer ?? value);
</script>

<input
	{disabled}
	{tabindex}
	class="w-full max-w-[9ch] bg-transparent text-center font-ss4 text-base transition-colors duration-500 outline-none placeholder:opacity-40"
	style="color: {color}; opacity: {opacity};"
	placeholder="Empty"
	value={shown}
	onfocus={(e) => (buffer = e.currentTarget.value)}
	oninput={(e) => (buffer = e.currentTarget.value)}
	onblur={() => {
		const committed = buffer;
		buffer = null;
		onCommit?.(committed ?? '');
	}}
	onclick={(e) => e.stopPropagation()}
/>
