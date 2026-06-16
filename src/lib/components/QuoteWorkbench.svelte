<script lang="ts">
	// version B
	import { tick } from 'svelte';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { SOURCE_INPUT_RE } from '$lib/tokenize';
	import { getTokenStoreContext, type EditScope } from '$lib/animation/tokenStore.svelte';
	import { createTokenGridNav, getZone, type Zone } from '$lib/navigation/tokenGridNav';
	import InteractiveSourceText from '$lib/components/InteractiveSourceText.svelte';
	import InteractiveTargetText from '$lib/components/InteractiveTargetText.svelte';

	const LINE_ITEM_SELECTOR = '.split-zone, .merge-zone, .ws-split';

	let {
		sourceText = $bindable(),
		targetText = $bindable(),
		authorship = $bindable(),
		autosize
	} = $props();
	let composing = $state(false);

	let mode = getModeContext();
	let editing = $derived(mode.current === 'text');
	const alignment = getAlignmentContext();

	// The token store is the single owner of tokenization, the text-keyed split/merge
	// cache, per-character pinyin, and the unified Flip around each edit (see
	// tokenStore.svelte.ts / CONTEXT.md). Alignment derives its own token view from
	// the same store keyed by meta — so there's no token array to push into it here.
	const store = getTokenStoreContext();
	let sourceTokens = $derived(store.sourceTokens(sourceText));
	let targetTokens = $derived(store.targetTokens(targetText));

	$effect(() => {
		alignment.setMeta({ sourceText, targetText, authorship });
	});

	let sourceWrapperEl: HTMLDivElement | null = $state(null);
	let targetWrapperEl: HTMLDivElement | null = $state(null);
	let authorshipEl: HTMLTextAreaElement | null = $state(null);

	// The DOM refs one line edit animates over. Scroll boxes (the overflow-y-auto
	// elements inside each panel) are tagged data-scrollbox by the Interactive*Text
	// components; the store height-tweens the edited one.
	function editScope(): EditScope {
		return {
			sourceWrapperEl,
			targetWrapperEl,
			authorshipEl,
			sourceScrollEl: sourceWrapperEl?.querySelector<HTMLElement>('[data-scrollbox]') ?? null,
			targetScrollEl: targetWrapperEl?.querySelector<HTMLElement>('[data-scrollbox]') ?? null
		};
	}

	// sourceTokens/targetTokens already carry pinyin from the store's overlay, so
	// split/merge no longer need a special "live" array — the store owns it.
	function splitSource(afterIndex: number) {
		store.split('source', sourceText, sourceTokens, afterIndex, editScope());
	}
	function mergeSource(lineN: number) {
		store.merge('source', sourceText, sourceTokens, lineN, editScope());
	}
	function splitTarget(afterIndex: number) {
		store.split('target', targetText, targetTokens, afterIndex, editScope());
	}
	function mergeTarget(lineN: number) {
		store.merge('target', targetText, targetTokens, lineN, editScope());
	}

	// Touch line mode: which divisor is "highlighted" (first tap). Shared across
	// panels so only one is lit at a time; second tap on the same one activates.
	type TouchedDivisor = { panel: 'source' | 'target'; index: number } | null;
	let touchedDivisor: TouchedDivisor = $state(null);

	function onTouchDivisor(panel: 'source' | 'target', index: number) {
		touchedDivisor = { panel, index };
	}
	function clearTouchDivisor() {
		touchedDivisor = null;
	}

	// Drop any highlight when leaving line mode.
	$effect(() => {
		if (mode.current !== 'line') touchedDivisor = null;
	});

	let tokenContainer: HTMLDivElement = $state(null!);

	const tokenGridNav = createTokenGridNav(
		() => tokenContainer,
		{
			itemSelector: () => (mode.current === 'line' ? LINE_ITEM_SELECTOR : '[role="option"]'),
			getDefaultIndex: (zone: Zone) =>
				mode.current === 'line' ? -1 : alignment.findDefaultTokenIndex(zone),
			onActivate: (el, e) => {
				if (mode.current === 'line') {
					const zone = getZone(el);
					const divisorIndex = el.dataset.divisorIndex;
					el.click();
					if (zone && divisorIndex !== undefined) {
						tick().then(() => {
							const next = tokenContainer?.querySelector<HTMLElement>(
								`[data-zone="${zone}"] [data-divisor-index="${divisorIndex}"]`
							);
							next?.focus();
						});
					}
					return;
				}
				const zone = getZone(el);
				const idx = Number(el.dataset.tokenIndex);
				if (zone === 'source') alignment.toggleSource(idx, { force: e.shiftKey });
				else if (zone === 'target') alignment.toggleTarget(idx);
			},
			onEscape: () => {
				if (mode.current !== 'line') alignment.deselect();
			}
		}
	);
</script>

{#if editing}
	<textarea
		id="source-text"
		name="source-text"
		bind:value={sourceText}
		rows="1"
		use:autosize
		oncompositionstart={() => (composing = true)}
		oninput={(e: InputEvent) => {
			if (e.isComposing) return;
			const el = e.currentTarget as HTMLTextAreaElement;
			const start = el.selectionStart ?? 0;
			const end = el.selectionEnd ?? 0;
			const filtered = el.value.replace(SOURCE_INPUT_RE, '');
			const removed = el.value.length - filtered.length;
			if (removed > 0) {
				el.value = filtered;
				sourceText = filtered;
				el.setSelectionRange(start - removed, end - removed);
			}
		}}
		oncompositionend={(e: CompositionEvent) => {
			composing = false;
			const el = e.currentTarget as HTMLTextAreaElement;
			const start = el.selectionStart ?? 0;
			const end = el.selectionEnd ?? 0;
			const filtered = el.value.replace(SOURCE_INPUT_RE, '');
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
		id="target-text"
		name="target-text"
		bind:value={targetText}
		rows="1"
		use:autosize
		class="max-h-[25vh] w-full resize-none overflow-y-auto bg-transparent text-center font-ss4 text-base font-[350] italic outline-none"
		placeholder="Use this box to enter your translated text."
	></textarea>
{:else}
	<div
		bind:this={tokenContainer}
		role="grid"
		aria-label="Token workspace"
		class="flex flex-col gap-3 rounded-xl px-1 py-4 outline-0 duration-200 focus:bg-blue-50"
		tabindex="0"
		onkeydown={tokenGridNav.handleKeydown}
		onfocusin={tokenGridNav.handleFocusIn}
	>
		<div bind:this={sourceWrapperEl} data-zone="source" data-flip-id="source-panel">
			<InteractiveSourceText
				tokens={sourceTokens}
				onSplit={splitSource}
				onMerge={mergeSource}
				animating={store.animating}
				touchedDivisorIndex={touchedDivisor?.panel === 'source' ? touchedDivisor.index : null}
				onTouchDivisor={(i) => onTouchDivisor('source', i)}
				onClearTouchDivisor={clearTouchDivisor}
			/>
		</div>
		<div bind:this={targetWrapperEl} data-zone="target" data-flip-id="target-panel">
			<InteractiveTargetText
				tokens={targetTokens}
				onSplit={splitTarget}
				onMerge={mergeTarget}
				animating={store.animating}
				divisorOffset={Math.max(0, sourceTokens.length - 1)}
				touchedDivisorIndex={touchedDivisor?.panel === 'target' ? touchedDivisor.index : null}
				onTouchDivisor={(i) => onTouchDivisor('target', i)}
				onClearTouchDivisor={clearTouchDivisor}
			/>
		</div>
	</div>
{/if}
<textarea
	id="authorship"
	name="authorship"
	bind:value={authorship}
	bind:this={authorshipEl}
	data-flip-id="authorship"
	rows="1"
	use:autosize
	disabled={mode.current === 'view'}
	class="max-h-[10vh] w-full resize-none overflow-y-auto bg-transparent text-center font-ss4 text-sm font-[350] opacity-40 outline-none disabled:cursor-default"
	placeholder="Source"
></textarea>
