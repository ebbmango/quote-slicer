<script lang="ts">
	let {
		icon,
		label,
		active,
		onclick,
		testid,
		tabindex = -1
	}: {
		icon: { viewBox: string; path: string };
		label: string;
		active: boolean;
		onclick: () => void;
		testid?: string;
		tabindex?: number;
	} = $props();
</script>

<button
	aria-label={label}
	data-testid={testid}
	{tabindex}
	class="size-6 outline-0 duration-150"
	class:opacity-20={!active}
	{onclick}
>
	<svg viewBox={icon.viewBox}>
		<path d={icon.path} />
	</svg>
</button>
