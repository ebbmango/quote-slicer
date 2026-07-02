<script lang="ts">
	import { getAlignmentContext, type MappingView } from '$lib/context/alignment.svelte';
	import PinyinInput from './PinyinInput.svelte';
	import { MAPPING_COLORS } from '$lib/constants/colors';
	import { theme as appTheme } from '$lib/theme';
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

	const isDark = $derived(appTheme.current === 'dark');
	const colorVariant = $derived(isDark ? color.dark : color.light);

	// Collapses every active/inactive color pair into one lookup so the markup
	// reads `theme.X` instead of repeating `isActive ? colorVariant.A : colorVariant.B`.
	// Inline styles can't be gated by a `.dark` CSS class, so light/dark is
	// handled via `colorVariant` (derived from `appTheme.current`); tune dark
	// values in colors.ts under each palette entry's `dark` key.
	const theme = $derived(
		isActive
			? {
					cardBg: colorVariant.base,
					hanziText: colorVariant.text,
					pinyinText: colorVariant.text,
					separator: colorVariant.tagBgActive,
					separatorOpacity: 0.3,
					tagBg: colorVariant.tagBgActive,
					tagText: colorVariant.tagNoActive,
					outlinePct: '50%',
					botBg: colorVariant.botActive,
					botText: colorVariant.botTextActive
				}
			: {
					cardBg: isDark ? '#3e3e3e' : 'white',
					hanziText: isDark ? 'white' : '#555',
					pinyinText: isDark ? 'white' : '#666',
					separator: colorVariant.botInactive,
					separatorOpacity: 0.7,
					tagBg: colorVariant.tagBgInactive,
					tagText: colorVariant.tagNoInactive,
					outlinePct: '75%',
					botBg: colorVariant.botInactive,
					botText: colorVariant.botTextInactive
				}
	);
	const hanziOpacity = $derived(isEmpty ? 0.3 : isActive ? 1 : 0.65);
	const pinyinOpacity = $derived(isEmpty ? 0.3 : isActive ? 0.85 : 0.6);
	const botTextOpacity = $derived(!isActive && isDark ? 0.5 : 1);
	const botTextEmptyOpacity = $derived(!isActive && isDark ? 0.3 : 0.55);
	// The delete button is an action affordance, not a state indicator: it always
	// renders in the *active* palette regardless of the card's active/inactive
	// state. Coupling it to `isActive` caused a flash — the button reveals on
	// focus (fires at mousedown) one paint before the click sets `isActive`
	// (fires at mouseup), so it briefly showed inactive colors before snapping to
	// active for the whole duration the mouse was held down. Decoupling removes
	// the inactive→active change entirely, so there is nothing left to flash.
	const deleteIconFill = $derived(
		isButtonHovered ? colorVariant.tagBgActive : colorVariant.botActive
	);
	const deleteGlyphOpacity = $derived(isFocused && !isButtonHovered ? 0.7 : 1);
	const deleteGlyphFill = $derived(
		isButtonHovered
			? colorVariant.tagNoActive
			: isDark
				? colorVariant.botTextActive
				: colorVariant.tagBgActive
	);

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
	class="group flex touch-pan-y flex-col rounded-md outline-0 transition-[outline-color] duration-200 select-none"
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
		class="relative grid w-full flex-1 rounded-t-md transition-colors duration-500"
		style="grid-template-columns: 1fr 1fr 1fr; grid-template-rows: repeat({rowCount}, 1fr); background: {theme.cardBg};"
	>
		{#each isEmpty ? EMPTY_ROW : mappingView.sourceEntries as entry, i (entry?.tokenId ?? 'empty')}
			{#if i > 0}
				<!-- divisory line -->
				<div
					class="pointer-events-none absolute left-0 w-full transition-[background-color,opacity] duration-500"
					style="top: calc({(i / rowCount) *
						100}%); height: 1px; opacity: {theme.separatorOpacity}; background: {theme.separator}; z-index: 0;"
				></div>
			{/if}

			<!-- Hanzi cell -->
			<div class="flex items-center justify-center">
				<span
					class="font-wenkai text-[1.75rem] font-[320] transition-colors duration-500"
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
					onCommit={isEmpty ? undefined : (raw) => alignment.setPinyin(mappingView.id, i, raw)}
				/>
			</div>

			<!-- Badge + delete button — col 3, spanning all source rows. -->
			{#if i === 0}
				<div
					class="relative flex items-center justify-center px-3 transition-colors duration-500"
					style="grid-column: 3; grid-row: 1 / span {rowCount}; z-index: 1;"
				>
					{#if !isEmpty}
						<span
							class="rounded px-2 py-0.5 font-ss4 text-sm transition-colors duration-500"
							style="background: {theme.tagBg}; color: {theme.tagText};">{label}</span
						>
					{/if}
					<button
						onmouseover={() => (isButtonHovered = true)}
						onmouseleave={() => (isButtonHovered = false)}
						onfocus={() => (isButtonHovered = true)}
						onblur={() => (isButtonHovered = false)}
						tabindex={-1}
						class="absolute -right-4 flex cursor-pointer items-center justify-center opacity-0 outline-0 transition-opacity duration-100 hover:opacity-100 coarse:hidden"
						class:opacity-100={isFocused}
						style="color: {theme.tagBg};"
						aria-label="Delete mapping"
						onclick={(e) => {
							e.stopPropagation();
							alignment.deleteById(mappingView.id);
						}}
					>
						<!--
							Re-key on theme: while hidden (opacity-0) the button's SVG is
							paint-culled, so a theme switch updates the `fill` attrs but Chrome
							does not re-rasterize the hidden subtree. The first reveal after a
							switch would composite the stale pre-switch texture (the previous
							theme's color) for one frame. Recreating the node on `isDark` forces
							a fresh raster with the current colors. Invisible: toggling the theme
							moves focus to the theme button, so every delete button is hidden
							during the swap.
						-->
						{#key isDark}
							<svg viewBox={icons['delete-left'].viewBox} class="size-7">
								<path d={icons['delete-left'].classic.solid[0]} fill={deleteIconFill} />
								<path
									d={icons['delete-left'].classic.solid[1]}
									fill={deleteGlyphFill}
									fill-opacity={deleteGlyphOpacity}
								/>
							</svg>
						{/key}
					</button>
				</div>
			{/if}
		{/each}
	</div>

	<!-- Bottom bar: translation -->
	<div
		class="flex h-6 w-full items-center justify-center overflow-hidden rounded-b-md transition-colors duration-500"
		style="background: {theme.botBg};"
	>
		<!-- transition-[color,opacity]: botTextOpacity/botTextEmptyOpacity depend on
		     isDark, so on a theme flip the opacity must ease alongside the 500ms colour
		     transition — transition-colors alone let it snap in one frame (the
		     bottom-text "flicker" visible in every browser). -->
		{#if mappingView.targetText}
			<span
				class="truncate px-3 font-ss4 text-xs font-[380] transition-[color,opacity] duration-500"
				style="color: {theme.botText}; opacity: {botTextOpacity};"
				>&ldquo;{mappingView.targetText}&rdquo;</span
			>
		{:else}
			<span
				class="font-ss4 text-xs font-[350] italic transition-[color,opacity] duration-500"
				style="color: {theme.botText}; opacity: {botTextEmptyOpacity};">no translation</span
			>
		{/if}
	</div>
</li>
