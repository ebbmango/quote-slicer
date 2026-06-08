<script lang="ts">
	import { getLinkContext, type Mapping } from '$lib/context/link.svelte';
	import { MAPPING_COLORS } from '$lib/constants/colors';
	import icons from '$lib/assets/icons.json';

	let { mapping, index }: { mapping: Mapping; index: number } = $props();

	const link = getLinkContext();
	const color = $derived(MAPPING_COLORS[mapping.colorIndex % MAPPING_COLORS.length]);
	const isActive = $derived(link.activeMappingId === mapping.id);
	let isFocused = $state(false);
	let isButtonHovered = $state(false);
	const isEmpty = $derived(mapping.sourceIndices.length === 0);
	const rowCount = $derived(Math.max(mapping.sourceIndices.length, 1));
	const label = $derived(String(index + 1).padStart(2, '0'));

	const r = $derived(Math.floor(rowCount / 2) + 1);
	const EMPTY_ROW = [null];

	// Collapses every active/inactive color pair into one lookup so the markup
	// reads `theme.X` instead of repeating `isActive ? color.A : color.B`.
	const theme = $derived(
		isActive
			? {
					cardBg: color.base,
					hanziText: color.text,
					pinyinText: color.text,
					separator: color.tagBgActive,
					separatorOpacity: 0.3,
					tagBg: color.tagBgActive,
					tagText: 'white',
					outlinePct: '50%',
					deleteHoverText: 'white',
					botBg: color.botActive,
					botText: color.botTextActive
				}
			: {
					cardBg: 'white',
					hanziText: '#555',
					pinyinText: '#666',
					separator: color.botInactive,
					separatorOpacity: 0.7,
					tagBg: color.tagBgInactive,
					tagText: color.tagNoInactive,
					outlinePct: '75%',
					deleteHoverText: color.botTextActive,
					botBg: color.botInactive,
					botText: color.botTextInactive
				}
	);
	const hanziOpacity = $derived(isEmpty ? 0.3 : isActive ? 1 : 0.65);
	const pinyinOpacity = $derived(isEmpty ? 0.3 : isActive ? 0.85 : 0.6);
	const deleteIconFill = $derived(isButtonHovered ? theme.tagBg : theme.botBg);
	const deleteGlyphFill = $derived(isButtonHovered ? theme.deleteHoverText : color.tagBgActive);

	function toggleActive() {
		if (link.activeMappingId === mapping.id) link.deselect();
		else link.activeMappingId = mapping.id;
	}

	function buildTargetText(): string {
		const indices = mapping.targetIndices;
		const tokens = link.targetTokens;
		if (!indices.length || !tokens.length) return '';
		const sorted = [...indices].sort((a, b) => a - b);
		const groups: number[][] = [[sorted[0]]];
		for (let i = 1; i < sorted.length; i++) {
			const group = groups[groups.length - 1];
			const prev = group[group.length - 1];
			const curr = sorted[i];
			// Bridge gap if only whitespace/punctuation between them (max gap of 5)
			let bridgeable = curr - prev <= 5;
			for (let k = prev + 1; bridgeable && k < curr; k++) {
				const t = tokens[k];
				bridgeable = t?.type === 'whitespace' || t?.type === 'punctuation';
			}
			if (bridgeable) group.push(curr);
			else groups.push([curr]);
		}
		return groups
			.map((group) => {
				let text = '';
				for (let i = group[0]; i <= group[group.length - 1]; i++) text += tokens[i]?.text ?? '';
				return text;
			})
			.join(', ');
	}

	const targetText = $derived(buildTargetText());
</script>

<li
	role="option"
	aria-selected={isActive}
	tabindex="0"
	data-mapping-id={mapping.id}
	class="group flex flex-col rounded-md outline-0 duration-200 select-none"
	style="grid-row: span {r}; outline-color: color-mix(in srgb, {theme.tagBg} {theme.outlinePct}, transparent);"
	onfocus={() => (isFocused = true)}
	onblur={() => (isFocused = false)}
	onclick={toggleActive}
	onkeydown={(e) => {
		if (e.target instanceof HTMLInputElement) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			link.deselect();
			(e.currentTarget as HTMLElement).blur();
			return;
		}
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggleActive();
		}
	}}
>
	<!-- Top section: hanzi | pinyin | badge -->
	<div
		class="relative grid flex-1 w-full rounded-t-md transition-colors duration-200"
		style="grid-template-columns: 1fr 1fr 1fr; grid-template-rows: repeat({rowCount}, 1fr); background: {theme.cardBg};"
	>
		{#each isEmpty ? EMPTY_ROW : mapping.sourceIndices as srcIdx, i (srcIdx ?? 'empty')}
			{#if i > 0}
				<!-- divisory line -->
				<div
					class="pointer-events-none absolute left-0 w-full transition-[background-color,opacity] duration-200"
					style="top: calc({(i / rowCount) * 100}%); height: 1px; opacity: {theme.separatorOpacity}; background: {theme.separator}; z-index: 0;"
				></div>
			{/if}

			<!-- Hanzi cell -->
			<div class="flex items-center justify-center">
				<span
					class="font-wenkai text-[28px] font-[320] transition-colors duration-200"
					style="color: {theme.hanziText}; opacity: {hanziOpacity};"
					>{isEmpty ? '未定' : (link.sourceTokens[srcIdx as number]?.text ?? '?')}</span
				>
			</div>

			<!-- Pinyin cell -->
			<div class="flex items-center justify-center">
				<input
					disabled={isEmpty}
					tabindex={isActive && !isEmpty ? 0 : -1}
					class="w-full max-w-[9ch] bg-transparent text-center font-ss4 text-base transition-colors duration-200 outline-none placeholder:opacity-40"
					style="color: {theme.pinyinText}; opacity: {pinyinOpacity};"
					placeholder="Empty"
					value={isEmpty ? '- - - -' : (mapping.pinyin[i] ?? '')}
					oninput={isEmpty
						? undefined
						: (e) => {
								mapping.pinyin[i] = e.currentTarget.value;
							}}
					onclick={isEmpty ? undefined : (e) => e.stopPropagation()}
				/>
			</div>

			<!-- Badge + delete button — col 3, spanning all source rows. -->
			{#if i === 0}
				<div
					class="relative flex items-center justify-center px-3 transition-colors duration-200"
					style="grid-column: 3; grid-row: 1 / span {rowCount}; z-index: 1;"
				>
					{#if !isEmpty}
						<span
							class="rounded px-2 py-0.5 font-ss4 text-sm duration-200"
							style="background: {theme.tagBg}; color: {theme.tagText};"
							>{label}</span
						>
					{/if}
					<button
						onmouseover={() => (isButtonHovered = true)}
						onmouseleave={() => (isButtonHovered = false)}
						onfocus={() => (isButtonHovered = true)}
						onblur={() => (isButtonHovered = false)}
						tabindex={-1}
						class="absolute -right-4 flex cursor-pointer items-center justify-center opacity-0 outline-0 duration-100 hover:opacity-100"
						class:opacity-100={isFocused}
						style="color: {theme.tagBg};"
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
								fill={deleteIconFill}
							/>
							<path
								class="duration-100"
								d={icons['delete-left'].classic.solid[1]}
								fill={deleteGlyphFill}
							/>
						</svg>
					</button>
				</div>
			{/if}
		{/each}
	</div>

	<!-- Bottom bar: translation -->
	<div
		class="flex h-6 w-full items-center justify-center overflow-hidden rounded-b-md transition-colors duration-200"
		style="background: {theme.botBg};"
	>
		{#if targetText}
			<span class="truncate px-3 font-ss4 text-xs font-[380]" style="color: {theme.botText};"
				>&ldquo;{targetText}&rdquo;</span
			>
		{:else}
			<span
				class="font-ss4 text-xs font-[350] italic"
				style="color: {theme.botText}; opacity: 0.55;">no translation</span
			>
		{/if}
	</div>
</li>
