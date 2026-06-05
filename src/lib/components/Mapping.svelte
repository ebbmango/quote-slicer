<script lang="ts">
	import { getLinkContext, type Mapping } from '$lib/context/link.svelte';
	import { MAPPING_COLORS } from '$lib/constants/colors';

	let { mapping, index }: { mapping: Mapping; index: number } = $props();

	const link = getLinkContext();
	const color = $derived(MAPPING_COLORS[index % MAPPING_COLORS.length]);
	const isActive = $derived(link.activeMappingId === mapping.id);
	const rowCount = $derived(Math.max(mapping.sourceIndices.length, 1));
	const label = $derived(String(index + 1).padStart(2, '0'));

	// h-17 = 4.25rem. At 16px root this is 68px. Used for absolute separator placement.
	const ROW_H = 68;

	function targetText(): string {
		const indices = mapping.targetIndices;
		if (!indices.length || !link.targetTokens.length) return '';
		const sorted = [...indices].sort((a, b) => a - b);
		const groups: number[][] = [[sorted[0]]];
		for (let i = 1; i < sorted.length; i++) {
			const last = groups[groups.length - 1];
			const prev = last[last.length - 1];
			const curr = sorted[i];
			// Bridge gap if only whitespace/punctuation between them (max gap of 5)
			const bridgeable =
				curr - prev <= 5 &&
				Array.from({ length: curr - prev - 1 }, (_, k) => link.targetTokens[prev + 1 + k]).every(
					(t) => t?.type === 'whitespace' || t?.type === 'punctuation'
				);
			if (bridgeable) last.push(curr);
			else groups.push([curr]);
		}
		return groups
			.map((g) => {
				const lo = g[0],
					hi = g[g.length - 1];
				return Array.from(
					{ length: hi - lo + 1 },
					(_, k) => link.targetTokens[lo + k]?.text ?? ''
				).join('');
			})
			.join(', ');
	}

	const computed_targetText = $derived(targetText());
</script>

<li
	role="option"
	aria-selected={isActive}
	tabindex="0"
	class="flex w-full shrink-0 cursor-pointer select-none flex-col overflow-hidden rounded-md shadow-sm"
	onclick={() =>
		link.activeMappingId === mapping.id
			? link.deselect()
			: (link.activeMappingId = mapping.id)}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (link.activeMappingId === mapping.id) {
				link.deselect();
			} else {
				link.activeMappingId = mapping.id;
			}
		}
	}}
>
	<!-- Top section: hanzi | pinyin | badge -->
	<div
		class="relative grid w-full transition-colors duration-200"
		style="grid-template-columns: 1fr 1fr 1fr; background: {isActive ? color.source : 'white'};"
	>
		{#if mapping.sourceIndices.length === 0}
			<div class="flex h-17 items-center justify-center opacity-30">
				<span class="font-noto text-[28px] font-[320]" style="color: {isActive ? 'white' : '#555'}"
					>—</span
				>
			</div>
			<div class="flex h-17 items-center justify-center"></div>
		{:else}
			{#each mapping.sourceIndices as srcIdx, i (srcIdx)}
				<!-- Full-width separator: absolute so it spans all 3 cols incl. badge col.
				     Badge cell has z-index:1 + solid bg to paint over this line. -->
				{#if i > 0}
					<div
						class="pointer-events-none absolute left-0 right-0"
						style="top: {i * ROW_H}px; height: 1px; background: {isActive
							? color.target + '66'
							: '#ebebeb'}; z-index: 0;"
					></div>
				{/if}

				<!-- Hanzi cell -->
				<div class="flex h-17 items-center justify-center">
					<span
						class="font-noto text-[28px] font-[320] transition-colors duration-200"
						style="color: {isActive ? 'white' : '#555'}; opacity: {isActive ? 0.9 : 0.65};"
						>{link.sourceTokens[srcIdx]?.text ?? '?'}</span
					>
				</div>

				<!-- Pinyin cell -->
				<div class="flex h-17 items-center justify-center">
					<input
						class="w-full max-w-[9ch] bg-transparent text-center font-ss4 text-base outline-none transition-colors duration-200 placeholder:opacity-40"
						style="color: {isActive ? 'white' : '#666'}; opacity: {isActive ? 0.85 : 0.6};"
						placeholder="Empty"
						value={mapping.pinyin[i] ?? ''}
						oninput={(e) => {
							mapping.pinyin[i] = e.currentTarget.value;
						}}
						onclick={(e) => e.stopPropagation()}
					/>
				</div>

				<!-- Badge + delete button — col 3, spanning all source rows.
				     position:relative + z-index:1 + solid bg covers the separator lines. -->
				{#if i === 0}
					<div
						class="relative flex items-center justify-center gap-1.5 px-3 transition-colors duration-200"
						style="grid-column: 3; grid-row: 1 / span {rowCount}; z-index: 1;"
					>
						<span
							class="rounded px-2 py-0.5 font-ss4 text-sm"
							style="background: {isActive ? color.target : color.base}; color: {isActive
								? 'white'
								: `color-mix(in srgb, ${color.source}, black 30%)`};"
							>{label}</span
						>
						{#if isActive}
							<button
								class="flex size-5 items-center justify-center opacity-70 transition-opacity hover:opacity-100"
								style="color: white;"
								aria-label="Delete mapping"
								onclick={(e) => {
									e.stopPropagation();
									link.deleteActive();
								}}
							>
								<svg viewBox="0 0 16 16" fill="none" class="size-3.5">
									<path
										d="M3 3L13 13M13 3L3 13"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
									/>
								</svg>
							</button>
						{/if}
					</div>
				{/if}
			{/each}
		{/if}
	</div>

	<!-- Bottom bar: translation -->
	<div
		class="flex h-6 w-full items-center justify-center overflow-hidden transition-colors duration-200"
		style="background: {isActive ? color.base : color.base + '55'};"
	>
		{#if computed_targetText}
			<span
				class="truncate px-3 font-ss4 text-xs font-[380]"
				style="color: color-mix(in srgb, {color.source}, black 25%); opacity: {isActive
					? 0.85
					: 0.6};"
				>&ldquo;{computed_targetText}&rdquo;</span
			>
		{:else}
			<span
				class="font-ss4 text-xs font-[350] italic"
				style="color: color-mix(in srgb, {color.source}, black 15%); opacity: 0.4;"
				>no translation</span
			>
		{/if}
	</div>
</li>
