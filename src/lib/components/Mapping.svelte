<script lang="ts">
	import { getLinkContext, type Mapping } from '$lib/context/link.svelte';
	import { MAPPING_COLORS } from '$lib/constants/colors';

	let { mapping, index }: { mapping: Mapping; index: number } = $props();

	const link = getLinkContext();
	const color = $derived(MAPPING_COLORS[index % MAPPING_COLORS.length]);
	const isActive = $derived(link.activeMappingId === mapping.id);
	let isFocused = $state(false);
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
	class="group flex w-full shrink-0 flex-col overflow-hidden rounded-md duration-200 select-none focus:outline-2 focus:outline-solid"
	style="outline-color: color-mix(in srgb, {isActive
		? color.tagBgActive
		: color.tagBgInactive} {isActive? "50%": "75%"}, transparent);"
	onfocusin={() => (isFocused = true)}
	onfocusout={(e) => {
		if (!e.currentTarget.contains(e.relatedTarget as Node)) isFocused = false;
	}}
	onclick={() =>
		link.activeMappingId === mapping.id ? link.deselect() : (link.activeMappingId = mapping.id)}
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
		style="grid-template-columns: 1fr 1fr 1fr; background: {isActive ? color.base : 'white'};"
	>
		{#if mapping.sourceIndices.length === 0}
			<div class="flex h-17 items-center justify-center opacity-30">
				<span
					class="font-noto text-[28px] font-[320]"
					style="color: {isActive ? color.text : '#555'}">—</span
				>
			</div>
			<div class="flex h-17 items-center justify-center"></div>
		{:else}
			{#each mapping.sourceIndices as srcIdx, i (srcIdx)}
				{#if i > 0}
					{@const numSeps = mapping.sourceIndices.length - 1}
					{@const isMidSep = numSeps % 2 === 1 && i === Math.ceil(numSeps / 2)}
					<!-- Segment 1: col 1 + col 2 + left half of col 3 -->
					<div
						class="pointer-events-none absolute left-0"
						style="top: {i * ROW_H}px; height: 1px; background: {isActive
							? color.tagBgActive
							: color.botInactive}; z-index: 0; right: calc(100% / 6);"
					></div>
					<!-- Segment 2: right half of col 3 -->
					<div
						class="pointer-events-none absolute right-0"
						class:opacity-0={isMidSep && isActive}
						style="top: {i * ROW_H}px; height: 1px; background: {isActive
							? color.tagBgActive
							: color.botInactive}; z-index: 0; left: calc(100% * 5 / 6);"
					></div>
				{/if}

				<!-- Hanzi cell -->
				<div class="flex h-17 items-center justify-center">
					<span
						class="font-wenkai text-[28px] font-[320] transition-colors duration-200"
						style="color: {isActive ? color.text : '#555'}; opacity: {isActive ? 1 : 0.65};"
						>{link.sourceTokens[srcIdx]?.text ?? '?'}</span
					>
				</div>

				<!-- Pinyin cell -->
				<div class="flex h-17 items-center justify-center">
					<input
						tabindex={isActive ? 0 : -1}
						class="w-full max-w-[9ch] bg-transparent text-center font-ss4 text-base transition-colors duration-200 outline-none placeholder:opacity-40"
						style="color: {isActive ? color.text : '#666'}; opacity: {isActive ? 0.85 : 0.6};"
						placeholder="Empty"
						value={mapping.pinyin[i] ?? ''}
						oninput={(e) => {
							mapping.pinyin[i] = e.currentTarget.value;
						}}
						onclick={(e) => e.stopPropagation()}
					/>
				</div>

				<!-- Badge + delete button — col 3, spanning all source rows. -->
				{#if i === 0}
					<div
						class="relative flex items-center justify-center px-3 transition-colors duration-200"
						style="grid-column: 3; grid-row: 1 / span {rowCount}; z-index: 1;"
					>
						<span
							class="rounded px-2 py-0.5 font-ss4 text-sm"
							style="background: {isActive
								? color.tagBgActive
								: color.tagBgInactive}; color: {isActive ? 'white' : color.tagNoInactive};"
							>{label}</span
						>
						<button
							tabindex={-1}
							class="absolute right-1.5 flex size-5 cursor-pointer items-center justify-center opacity-0 outline-0 transition-opacity group-hover:opacity-60 hocus:opacity-100"
							style="color: {color.tagBgActive};"
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
									stroke-width="1.5"
									stroke-linecap="round"
								/>
							</svg>
						</button>
					</div>
				{/if}
			{/each}
		{/if}
	</div>

	<!-- Bottom bar: translation -->
	<div
		class="flex h-6 w-full items-center justify-center overflow-hidden transition-colors duration-200"
		style="background: {isActive ? color.botActive : color.botInactive};"
	>
		{#if computed_targetText}
			<span
				class="truncate px-3 font-ss4 text-xs font-[380]"
				style="color: {isActive ? color.botTextActive : color.botTextInactive};"
				>&ldquo;{computed_targetText}&rdquo;</span
			>
		{:else}
			<span
				class="font-ss4 text-xs font-[350] italic"
				style="color: {isActive ? color.botTextActive : color.botTextInactive}; opacity: 0.55;"
				>no translation</span
			>
		{/if}
	</div>
</li>
