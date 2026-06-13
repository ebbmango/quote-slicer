<script lang="ts">
	// version B
	import { onMount, tick } from 'svelte';
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getAlignmentContext } from '$lib/context/alignment.svelte';
	import { tokenizeSource, tokenizeTarget, SOURCE_INPUT_RE } from '$lib/tokenize';
	import type { SourceToken, TargetToken } from '$lib/tokenize';
	import { splitAfterToken, mergeLines } from '$lib/line';
	import { createTokenGridNav, getZone, type Zone } from '$lib/navigation/tokenGridNav';
	import InteractiveSourceText from '$lib/components/InteractiveSourceText.svelte';
	import InteractiveTargetText from '$lib/components/InteractiveTargetText.svelte';

	const LINE_ITEM_SELECTOR = '.split-zone, .merge-zone, .ws-split, .ws-boundary';

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

	// Text-keyed caches: if text matches, use the cached (possibly split/merged) token array;
	// otherwise fall through to fresh tokenization. This makes the final token arrays purely
	// $derived while still allowing split/merge mutations to persist within an editing session.
	let sourceTokensCache = $state<{ text: string; tokens: SourceToken[] } | null>(null);
	let targetTokensCache = $state<{ text: string; tokens: TargetToken[] } | null>(null);

	let sourceTokens = $derived(
		sourceTokensCache !== null && sourceTokensCache.text === sourceText
			? sourceTokensCache.tokens
			: tokenizeSource(sourceText)
	);
	let targetTokens = $derived(
		targetTokensCache !== null && targetTokensCache.text === targetText
			? targetTokensCache.tokens
			: tokenizeTarget(targetText)
	);

	$effect(() => {
		alignment.setSourceTokens(sourceTokens);
	});
	$effect(() => {
		alignment.setTargetTokens(targetTokens);
	});
	$effect(() => {
		alignment.setMeta({ sourceText, targetText, authorship });
	});

	let sourceWrapperEl: HTMLDivElement | null = $state(null);
	let targetWrapperEl: HTMLDivElement | null = $state(null);
	let authorshipEl: HTMLTextAreaElement | null = $state(null);
	let gsap: (typeof import('gsap'))['gsap'] | null = $state(null);

	onMount(async () => {
		const { gsap: g } = await import('gsap');
		gsap = g;
	});

	async function withShiftAnimation(els: HTMLElement[], mutate: () => void, lockEl?: HTMLElement | null) {
		if (!gsap) {
			mutate();
			return;
		}
		const rects = els.map((el) => el.getBoundingClientRect());
		mutate();
		await tick();
		// Lock lockEl to its post-mutation pixel height so any concurrent Flip animation
		// using absolute:true can't collapse it and shift our GSAP targets mid-animation.
		if (lockEl) lockEl.style.height = lockEl.getBoundingClientRect().height + 'px';
		const animations: Promise<void>[] = [];
		els.forEach((el, i) => {
			if (!el.isConnected) return;
			const dy = rects[i].top - el.getBoundingClientRect().top;
			if (Math.abs(dy) < 0.5) return;
			animations.push(new Promise<void>((resolve) => {
				gsap!.fromTo(el, { y: dy }, { y: 0, duration: 0.35, ease: 'power2.inOut', clearProps: 'y', onComplete: resolve });
			}));
		});
		await Promise.all(animations);
		if (lockEl) lockEl.style.height = '';
	}

	function splitSource(afterIndex: number) {
		// Operate on alignment's live tokens (which carry pinyin), not the raw
		// derived array — on the first split the derived is fresh tokenize() output
		// without pinyin. See Alignment.sourceTokenList.
		const els = [targetWrapperEl, authorshipEl].filter((el): el is HTMLDivElement | HTMLTextAreaElement => el !== null);
		withShiftAnimation(els, () => {
			sourceTokensCache = { text: sourceText, tokens: splitAfterToken(alignment.sourceTokenList, afterIndex) };
		});
	}
	function mergeSource(lineN: number) {
		const els = [targetWrapperEl, authorshipEl].filter((el): el is HTMLDivElement | HTMLTextAreaElement => el !== null);
		withShiftAnimation(els, () => {
			sourceTokensCache = { text: sourceText, tokens: mergeLines(alignment.sourceTokenList, lineN) };
		});
	}
	function splitTarget(afterIndex: number) {
		const els = [sourceWrapperEl, authorshipEl].filter((el): el is HTMLDivElement | HTMLTextAreaElement => el !== null);
		withShiftAnimation(els, () => {
			targetTokensCache = { text: targetText, tokens: splitAfterToken(targetTokens, afterIndex) };
		}, targetWrapperEl);
	}
	function mergeTarget(lineN: number) {
		const els = [sourceWrapperEl, authorshipEl].filter((el): el is HTMLDivElement | HTMLTextAreaElement => el !== null);
		withShiftAnimation(els, () => {
			targetTokensCache = { text: targetText, tokens: mergeLines(targetTokens, lineN) };
		}, targetWrapperEl);
	}

	let tokenContainer: HTMLDivElement = $state(null!);

	const tokenGridNav = createTokenGridNav(
		() => tokenContainer,
		{
			itemSelector: () => (mode.current === 'line' ? LINE_ITEM_SELECTOR : '[role="option"]'),
			crossZoneJump: () => mode.current !== 'line',
			getDefaultIndex: (zone: Zone) =>
				mode.current === 'line' ? -1 : alignment.findDefaultTokenIndex(zone),
			onActivate: (el, e) => {
				if (mode.current === 'line') {
					el.click();
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
		<div bind:this={sourceWrapperEl} data-zone="source">
			<InteractiveSourceText tokens={sourceTokens} onSplit={splitSource} onMerge={mergeSource} />
		</div>
		<div bind:this={targetWrapperEl} data-zone="target">
			<InteractiveTargetText tokens={targetTokens} onSplit={splitTarget} onMerge={mergeTarget} />
		</div>
	</div>
{/if}
<textarea
	id="authorship"
	name="authorship"
	bind:value={authorship}
	bind:this={authorshipEl}
	rows="1"
	use:autosize
	class="max-h-[10vh] w-full resize-none overflow-y-auto bg-transparent text-center font-ss4 text-sm font-[350] opacity-40 outline-none"
	placeholder="Source"
></textarea>
