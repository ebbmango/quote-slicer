<script lang="ts">
	import { getLinkContext, type Mapping } from '$lib/context/link.svelte';
	import { MAPPING_COLORS } from '$lib/constants/colors';
	import icons from '$lib/assets/icons.json';

	let { mapping, index }: { mapping: Mapping; index: number } = $props();

	const link = getLinkContext();
	const color = $derived(MAPPING_COLORS[index % MAPPING_COLORS.length]);
	const isActive = $derived(link.activeMappingId === mapping.id);
	let isFocused = $state(false);
	let isMappingHovered = $state(false);
	let isButtonHovered = $state(false);
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
	data-mapping-id={mapping.id}
	class="group flex w-full shrink-0 flex-col rounded-md outline-0 duration-200 select-none"
	style="outline-color: color-mix(in srgb, {isActive
		? color.tagBgActive
		: color.tagBgInactive} {isActive ? '50%' : '75%'}, transparent);"
	onfocusin={() => (isFocused = true)}
	onfocusout={(e) => {
		if (!e.currentTarget.contains(e.relatedTarget as Node)) isFocused = false;
	}}
	onmouseenter={() => (isMappingHovered = true)}
	onmouseleave={() => (isMappingHovered = false)}
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
		class="relative grid w-full rounded-t-md transition-colors duration-200"
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
					<!-- Segment 1: col 1 + col 2 + left half of col 3 -->
					<div
						class="pointer-events-none absolute left-0 w-full duration-200"
						style="top: {i * ROW_H}px; height: 1px; background: {isActive
							? color.tagBgActive
							: color.botInactive}; z-index: 0;"
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
							onmouseover={() => (isButtonHovered = true)}
							onmouseleave={() => (isButtonHovered = false)}
							tabindex={-1}
							class="absolute -right-4 flex cursor-pointer items-center justify-center opacity-0 outline-0 duration-100"
							class:opacity-100={isFocused || isButtonHovered}
							style="color: {isActive ? color.tagBgActive : color.tagBgInactive};"
							aria-label="Delete mapping"
							onclick={(e) => {
								e.stopPropagation();
								link.deleteById(mapping.id);
							}}
						>
							<svg viewBox={icons['delete-left'].viewBox} class="size-7">
								<path
									class="duration-100"
									d={icons['delete-left'].classic.solid[0]}
									fill={isActive
										? isButtonHovered
											? color.tagBgActive
											: color.botActive
										: isButtonHovered
											? color.tagBgInactive
											: color.botInactive}
								/>
								<path
									class="duration-100"
									d={icons['delete-left'].classic.solid[1]}
									fill={isActive ? (isButtonHovered ? 'white' : color.tagBgActive) : 'white'}
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
		class="flex h-6 w-full items-center justify-center overflow-hidden rounded-b-md transition-colors duration-200"
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
