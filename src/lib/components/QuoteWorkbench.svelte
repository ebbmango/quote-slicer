<script lang="ts">
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getLinkContext } from '$lib/context/link.svelte';
	import { tokenizeSource, tokenizeTargetSeparate, SOURCE_INPUT_RE } from '$lib/tokenize';
	import InteractiveSourceText from '$lib/components/InteractiveSourceText.svelte';
	import InteractiveTargetText from '$lib/components/InteractiveTargetText.svelte';

	let {
		sourceText = $bindable(),
		targetText = $bindable(),
		authorship = $bindable(),
		autosize
	} = $props();
	let composing = $state(false);

	let mode = getModeContext();
	let editing = $derived(mode.current === 'text');
	const link = getLinkContext();

	let sourceTokens = $derived(tokenizeSource(sourceText));
	let targetTokens = $derived(tokenizeTargetSeparate(targetText));

	$effect(() => {
		link.sourceTokens = sourceTokens;
		link.targetTokens = targetTokens;
	});

	let tokenContainer: HTMLDivElement;
	let lastSourceEl: HTMLElement | null = $state(null);
	let lastTargetEl: HTMLElement | null = $state(null);

	function handleFocusIn(e: FocusEvent) {
		const el = e.target as HTMLElement;
		if (el.getAttribute('role') !== 'option') return;
		if (el.closest('[aria-label="Source tokens"]')) lastSourceEl = el;
		else if (el.closest('[aria-label="Target tokens"]')) lastTargetEl = el;
	}

	function getZone(el: HTMLElement): 'source' | 'target' | null {
		if (el.closest('[aria-label="Source tokens"]')) return 'source';
		if (el.closest('[aria-label="Target tokens"]')) return 'target';
		return null;
	}

	function findDefaultToken(zone: 'source' | 'target'): HTMLElement | null {
		const tokens = zone === 'source' ? link.sourceTokens : link.targetTokens;
		const getState = zone === 'source'
			? (i: number) => link.getSourceTokenState(i)
			: (i: number) => link.getTargetTokenState(i);
		const label = zone === 'source' ? 'Source tokens' : 'Target tokens';
		const isWord = (t: { type: string }) => t.type !== 'whitespace' && t.type !== 'punctuation';

		let idx = tokens.findIndex((t, i) => isWord(t) && getState(i).kind === 'unmapped');
		if (idx === -1) idx = tokens.findIndex(isWord);
		if (idx === -1) return null;

		return tokenContainer.querySelector(
			`[aria-label="${label}"] [data-token-index="${idx}"]`
		) as HTMLElement | null;
	}

	function jumpTo(zone: 'source' | 'target'): void {
		const remembered = zone === 'source' ? lastSourceEl : lastTargetEl;
		const el = (remembered && tokenContainer.contains(remembered))
			? remembered
			: findDefaultToken(zone);
		el?.focus();
	}

	function findVisualNeighbor(
		currentEl: HTMLElement,
		all: HTMLElement[],
		dir: 'up' | 'down'
	): HTMLElement | null {
		const r = currentEl.getBoundingClientRect();
		const cx = r.left + r.width / 2;

		const candidates = all.filter((el) => {
			const er = el.getBoundingClientRect();
			return dir === 'down' ? er.top > r.bottom - 4 : er.bottom < r.top + 4;
		});

		if (!candidates.length) return null;

		const rowEdge =
			dir === 'down'
				? Math.min(...candidates.map((el) => el.getBoundingClientRect().top))
				: Math.max(...candidates.map((el) => el.getBoundingClientRect().bottom));

		const rowCandidates = candidates.filter((el) => {
			const t = el.getBoundingClientRect();
			return dir === 'down' ? Math.abs(t.top - rowEdge) < 4 : Math.abs(t.bottom - rowEdge) < 4;
		});

		return rowCandidates.reduce((best, el) => {
			const bx = el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2;
			const bestx = best.getBoundingClientRect().left + best.getBoundingClientRect().width / 2;
			return Math.abs(bx - cx) < Math.abs(bestx - cx) ? el : best;
		});
	}

	// ─── Link mode keyboard scheme ───────────────────────────────────────────
	// Alt+↑ / Alt+↓        Navigate focus to token on visual row above/below.
	//                       At source bottom → jumps to target (remembered pos).
	//                       At target top    → jumps to source (remembered pos).
	// Alt+← / Alt+→        Move focus to prev/next token in DOM order.
	// Alt+Enter            Toggle focus between source and target (remembered
	//                       position, or first unmapped word, or first word).
	// Alt+Space            Select token / create new mapping.
	// Alt+Shift+Space      Force-add source token to current mapping.
	// Escape               Deselect active mapping.
	// Tab / Shift+Tab      Move focus between larger UI elements (skips tokens).
	// ─────────────────────────────────────────────────────────────────────────
	function handleArrowNav(e: KeyboardEvent) {
		if (!e.altKey) return;
		if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) return;
		const target = e.target as HTMLElement;

		// Alt+Enter: toggle between source and target (remembered position)
		if (e.key === 'Enter') {
			e.preventDefault();
			const zone = getZone(target);
			jumpTo(zone === 'source' ? 'target' : 'source');
			return;
		}

		const all = Array.from(tokenContainer.querySelectorAll('[role="option"]')) as HTMLElement[];

		// Container itself is focused — enter token area
		if (target === tokenContainer) {
			if (!all.length) return;
			e.preventDefault();
			const entry = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? all[all.length - 1] : all[0];
			entry?.focus();
			return;
		}

		if (target.getAttribute('role') !== 'option') return;
		e.preventDefault();

		const currentIndex = all.indexOf(target);
		let neighbor: HTMLElement | null = null;

		if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
			neighbor = findVisualNeighbor(target, all, e.key === 'ArrowDown' ? 'down' : 'up');
			if (!neighbor) {
				const zone = getZone(target);
				if (e.key === 'ArrowDown' && zone === 'source') jumpTo('target');
				else if (e.key === 'ArrowUp' && zone === 'target') jumpTo('source');
				return;
			}
		} else if (e.key === 'ArrowLeft') {
			neighbor = currentIndex > 0 ? all[currentIndex - 1] : null;
		} else if (e.key === 'ArrowRight') {
			neighbor = currentIndex < all.length - 1 ? all[currentIndex + 1] : null;
		}

		neighbor?.focus();
	}
</script>

{#if editing}
	<textarea
		id="source-text"
		name="source-text"
		bind:value={sourceText}
		rows="1"
		use:autosize
		oncompositionstart={() => (composing = true)}
		oninput={(e) => {
			if ((e as InputEvent).isComposing) return;
			const el = e.currentTarget;
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
		oncompositionend={(e) => {
			composing = false;
			const el = e.currentTarget;
			const start = el.selectionStart ?? 0;
			const end = el.selectionEnd ?? 0;
			const filtered = el.value.replace(/[^\p{Script=Han}\u3000-\u303F\uFF00-\uFFEF]/gu, '');
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
		class="flex flex-col gap-3 py-4 px-1 rounded-xl focus:bg-blue-50 duration-200 outline-0"
		tabindex="0"
		onkeydown={handleArrowNav}
		onfocusin={handleFocusIn}
	>
		<InteractiveSourceText tokens={sourceTokens} />
		<InteractiveTargetText tokens={targetTokens} />
		<textarea
			id="authorship"
			name="authorship"
			bind:value={authorship}
			disabled={mode.current !== 'text'} // maybe always enabled?
			rows="1"
			use:autosize
			class="max-h-[10vh] w-full resize-none overflow-y-auto bg-transparent text-center font-ss4 text-sm font-[350] opacity-40 outline-none"
			placeholder="Source"
		></textarea>
	</div>
{/if}
