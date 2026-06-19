<script lang="ts">
	import { getAlignmentContext, type MappingView } from '$lib/context/alignment.svelte';
	import PinyinInput from './PinyinInput.svelte';
	import { MAPPING_COLORS } from '$lib/constants/colors';
	import icons from '$lib/assets/icons.json';
	import type { TransitionConfig } from 'svelte/transition';

	// exit / onExitStart / onExitEnd are owned by MappingsList — the leaving card's
	// slide and the gap-close Flip (run when the slide ends) are orchestrated there.
	let {
		mappingView,
		index,
		exit = () => ({ duration: 0 }),
		onExitStart,
		onExitEnd
	}: {
		mappingView: MappingView;
		index: number;
		exit?: (node: HTMLElement) => TransitionConfig;
		onExitStart?: (e: Event) => void;
		onExitEnd?: (e: Event) => void;
	} = $props();

	const alignment = getAlignmentContext();
	const color = $derived(MAPPING_COLORS[mappingView.colorIndex % MAPPING_COLORS.length]);
	const isActive = $derived(alignment.activeMappingId === mappingView.id);
	let isFocused = $state(false);
	let isButtonHovered = $state(false);
	const isEmpty = $derived(mappingView.sourceEntries.length === 0);
	const rowCount = $derived(Math.max(mappingView.sourceEntries.length, 1));
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
		if (alignment.activeMappingId === mappingView.id) alignment.deselect();
		else alignment.setActive(mappingView.id);
	}
</script>

<li
	role="option"
	aria-selected={isActive}
	tabindex="0"
	data-mapping-id={mappingView.id}
	class="group flex flex-col rounded-md outline-0 transition-[outline-color] duration-200 select-none"
	style="grid-row: span {r}; outline-color: color-mix(in srgb, {theme.tagBg} {theme.outlinePct}, transparent);"
	out:exit
	onoutrostart={onExitStart}
	onoutroend={onExitEnd}
	onfocus={() => (isFocused = true)}
	onblur={() => (isFocused = false)}
	onclick={toggleActive}
	onkeydown={(e) => {
		if (e.target instanceof HTMLInputElement) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			alignment.deselect();
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
		{#each isEmpty ? EMPTY_ROW : mappingView.sourceEntries as entry, i (entry?.tokenId ?? 'empty')}
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
					class="font-wenkai text-[1.75rem] font-[320] transition-colors duration-200"
					style="color: {theme.hanziText}; opacity: {hanziOpacity};"
					>{isEmpty ? '未定' : (entry?.text ?? '?')}</span
				>
			</div>

			<!-- Pinyin cell -->
			<div class="flex items-center justify-center">
				<PinyinInput
					disabled={isEmpty}
					tabindex={isActive && !isEmpty ? 0 : -1}
					color={theme.pinyinText}
					opacity={pinyinOpacity}
					value={isEmpty ? '- - - -' : (entry?.pinyin ?? '')}
					onCommit={isEmpty
						? undefined
						: (raw) => alignment.setPinyin(mappingView.id, i, raw)}
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
							alignment.deleteById(mappingView.id);
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
		{#if mappingView.targetText}
			<span class="truncate px-3 font-ss4 text-xs font-[380]" style="color: {theme.botText};"
				>&ldquo;{mappingView.targetText}&rdquo;</span
			>
		{:else}
			<span
				class="font-ss4 text-xs font-[350] italic"
				style="color: {theme.botText}; opacity: 0.55;">no translation</span
			>
		{/if}
	</div>
</li>
