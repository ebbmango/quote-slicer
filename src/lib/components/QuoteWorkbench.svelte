<script lang="ts">
	import { getModeContext } from '$lib/context/mode.svelte';
	import { getLinkContext } from '$lib/context/link.svelte';
	import { tokenizeSource, tokenizeTargetSeparate } from '$lib/tokenize';
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

	function handleArrowNav(e: KeyboardEvent) {
		if (!e.altKey) return;
		if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
		const target = e.target as HTMLElement;

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
			const filtered = el.value.replace(/[^\p{Script=Han}\u3000-\u303F\uFF00-\uFFEF]/gu, '');
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
