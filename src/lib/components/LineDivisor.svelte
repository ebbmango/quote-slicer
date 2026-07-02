<script lang="ts">
	// The line-tool divisor: the single owner of the split/merge affordance shared
	// by both panels. One module renders all three surfaces — the source panel's
	// zero-width `.split-zone` button, the target panel's `.ws-split` whitespace
	// span, and the full-width `.merge-zone` band (identical in both panels) — and
	// owns the whole interaction (touch first-tap-highlight / second-tap-activate,
	// the mouse/keyboard hover-spread via redistribute, and the instant-clear that
	// precedes a split/merge Flip). Before this, both InteractiveSourceText and
	// InteractiveTargetText carried near-identical copies of this markup, the touch
	// state machine, and ~200 lines of identical CSS.
	//
	// The panel owns its token stream, its row container, and its panel-specific
	// `SPREAD` tuning + palette field; it passes those down and delegates the
	// divisor through this one interface. See docs/line-mode.md.
	import { getModeContext } from '$lib/context/mode.svelte';
	import { interactionMode } from '$lib/context/interactionMode.svelte';
	import {
		redistributeRow,
		clearRedistribute,
		type RedistributeOpts
	} from '$lib/actions/redistribute';

	let {
		kind,
		surface = 'zone',
		divisorIndex,
		color,
		text = '',
		flipId,
		container,
		spread,
		touchedDivisorIndex = null,
		onActivate,
		onTouch = () => {},
		onClearTouch = () => {}
	}: {
		/** `split` opens a new line break here; `merge` collapses the next line up. */
		kind: 'split' | 'merge';
		/** Split surface: `zone` = source's zero-width button; `whitespace` = target's
		 *  copyable whitespace span. Ignored for `merge` (always the full-width band). */
		surface?: 'zone' | 'whitespace';
		/** The token index this divisor sits *after* (source) or *on* (target ws). Read
		 *  by redistribute (gap addressing) and tokenGridNav (keyboard focus restore). */
		divisorIndex: number;
		/** Resolved `--line-tool-color` for this divisor's indicator. */
		color: string;
		/** Whitespace text rendered by the `whitespace` surface (keeps it copyable). */
		text?: string;
		/** GSAP Flip id — set for target divisors (they reflow during a target edit),
		 *  omitted for source divisors (only source tokens are flipped). */
		flipId?: string;
		/** The panel's flex row container — redistribute operates over its `.tok`s. */
		container: HTMLElement | undefined;
		/** Row-spread tuning for this panel (source and target differ). */
		spread: RedistributeOpts;
		/** Index of the divisor lit by a first touch-tap in THIS panel (null if none). */
		touchedDivisorIndex?: number | null;
		/** Perform the edit (split/merge); the instant-clear runs here before it. */
		onActivate: () => void;
		/** First touch-tap on this divisor — request the highlight. */
		onTouch?: (index: number) => void;
		/** Drop the touch highlight (second tap / leaving). */
		onClearTouch?: () => void;
	} = $props();

	const mode = getModeContext();
	let isLineMode = $derived(mode.current === 'line');
	let isTouch = $derived(interactionMode.current === 'touch');
	let touchLit = $derived(isLineMode && isTouch && touchedDivisorIndex === divisorIndex);

	function activate() {
		// Snap any first-tap / hover spread back instantly so its `--rd-x` ease isn't
		// baked into the GSAP Flip from-state (which made the row wobble mid-flight).
		clearRedistribute(container, { instant: true });
		onActivate();
	}

	// Touch divisor tap: first tap highlights (+ spread, split only); second tap on
	// the same divisor activates. Mouse/keyboard activate immediately.
	function handleClick(e: MouseEvent) {
		e.stopPropagation();
		if (!isLineMode) return;
		if (!isTouch) {
			activate();
			return;
		}
		if (touchedDivisorIndex === divisorIndex) {
			onClearTouch();
			activate();
		} else {
			onTouch(divisorIndex);
			if (kind === 'split') redistributeRow(container, divisorIndex, spread);
		}
	}

	// Mouse/keyboard hover feedback for split surfaces only (merge spreads nothing).
	function openSpread() {
		if (isLineMode && !isTouch) redistributeRow(container, divisorIndex, spread);
	}
	function closeSpread() {
		if (!isTouch) clearRedistribute(container);
	}
</script>

{#if kind === 'merge'}
	<button
		data-flip-id={flipId}
		class="merge-zone"
		class:line-active={isLineMode}
		class:touch-lit={touchLit}
		data-divisor-index={divisorIndex}
		style="--line-tool-color: {color}"
		tabindex={-1}
		onclick={handleClick}
		aria-label="Merge with next line"
	>
		<span class="merge-indicator"></span>
	</button>
{:else if surface === 'whitespace'}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<span
		data-flip-id={flipId}
		role="button"
		class="ws-split"
		class:line-active={isLineMode}
		class:touch-lit={touchLit}
		data-divisor-index={divisorIndex}
		style="--line-tool-color: {color}"
		tabindex={-1}
		onclick={handleClick}
		onmouseenter={openSpread}
		onmouseleave={closeSpread}
		onfocus={openSpread}
		onblur={closeSpread}
		aria-label="Split line here">{text}</span
	>
{:else}
	<button
		class="split-zone"
		class:line-active={isLineMode}
		class:touch-lit={touchLit}
		data-divisor-index={divisorIndex}
		style="--line-tool-color: {color}"
		tabindex={-1}
		onclick={handleClick}
		onmouseenter={openSpread}
		onmouseleave={closeSpread}
		onfocus={openSpread}
		onblur={closeSpread}
		aria-label="Split line here"
	>
		<span class="split-indicator"></span>
	</button>
{/if}

<style>
	/* Register --rd-x so it always resolves to a concrete length (0px) instead of a
	   var() fallback. Transitions on transform: translateX(var(--rd-x)) only ease
	   when both ends are explicit values; an unset/fallback end snaps. Registering
	   keeps every redistribution explicit→explicit, so collapsing a previously-spread
	   row and opening a new one both animate. See actions/redistribute.ts. */
	@property --rd-x {
		syntax: '<length>';
		initial-value: 0px;
		inherits: true; /* indicators read it via inheritance from their zone */
	}

	/* While GSAP Flip runs, kill pointer events on divisors — prevents hover
	   activation, opacity flash, and spread animations mid-animation. `.flipping`
	   lives on the panel's row container (outside this component), so it's :global. */
	:global(.flipping) .split-zone,
	:global(.flipping) .ws-split,
	:global(.flipping) .merge-zone.line-active .merge-indicator {
		pointer-events: none;
	}

	/* Snap the indicator back instantly when the redistribution is cleared just
	   before a Flip (clearRedistribute({ instant: true })) so its `--rd-x` ease
	   doesn't run alongside the Flip. `.rd-instant` is set on the panel container. */
	:global(.rd-instant) .split-indicator,
	:global(.rd-instant) .ws-split::after {
		transition: none;
	}

	/* ── Source split surface: a zero-width button between groups ──────────────── */
	.split-zone {
		display: flex;
		align-items: center;
		justify-content: center;
		/* Hit target spans roughly a full character so the whole inter-word gap is
		   hoverable, not just a narrow band over the indicator. `margin: -width/2`
		   keeps the layout contribution net-zero (zones overlap into the flanking
		   glyphs but don't reflow them); z-index:1 keeps them on top for the hit. */
		width: 1em;
		margin: 0 -0.5em;
		z-index: 1;
		align-self: stretch;
		padding: 0;
		background: none;
		border: none;
		cursor: pointer;
		outline: none;
	}

	/* Outside line mode the zone occupies its net-zero slot but takes no clicks. */
	.split-zone:not(.line-active) {
		pointer-events: none;
	}

	.split-indicator {
		display: block;
		width: var(--line-tool-width);
		height: 0.85em;
		background: var(--line-tool-color);
		opacity: var(--line-tool-opacity-idle);
		/* The hit-zone stays anchored under the pointer; only the indicator slides
		   to stay centred in the resized gap during the hover redistribution. This
		   prevents the divisor "dancing" out from under a stationary pointer (the
		   8px zone moving triggered leave/enter flicker). See actions/redistribute.ts. */
		transform: translateX(var(--rd-x, 0)) skewX(-10deg);
		transition:
			opacity 150ms,
			transform 150ms ease;
	}

	:global(html[data-interaction='mouse']) .split-zone.line-active:hover .split-indicator,
	:global(html[data-interaction='keyboard']) .split-zone.line-active:focus .split-indicator {
		opacity: var(--line-tool-opacity-hover);
	}

	/* Touch-highlighted split divisor — same visual as hover/focus. No media gate:
	   touch-lit is only set when interactionMode === 'touch'. */
	.split-zone.touch-lit .split-indicator {
		opacity: var(--line-tool-opacity-hover);
	}

	/* ── Target split surface: the copyable whitespace span ───────────────────── */
	.ws-split {
		display: inline-block;
		position: relative;
		font-size: inherit;
		font-family: inherit;
		font-style: inherit;
		font-weight: inherit;
		color: inherit;
		background: none;
		border: none;
		/* Hit target reaches into the flanking words so the whole inter-word space is
		   hoverable, not just the thin whitespace glyph. The negative margin cancels
		   the padding so layout is net-zero (words don't reflow); z-index:1 keeps the
		   zone on top of the overlapped word edges for the hit. The indicator is
		   centred on the box (left:50%), which stays over the original gap. */
		padding: 0 0.5em;
		margin: 0 -0.5em;
		z-index: 1;
		cursor: pointer;
		outline: none;
		white-space: pre;
		opacity: 0.9;
		user-select: text;
		-webkit-user-select: text;
	}

	.ws-split:not(.line-active) {
		pointer-events: none;
	}

	.ws-split::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		/* The hit-zone stays anchored under the pointer; only this indicator slides
		   (via the inherited `--rd-x`) to stay centred in the resized gap. Keeps the
		   divisor from "dancing" out from under a stationary pointer during the hover
		   redistribution. See actions/redistribute.ts. */
		transform: translate(calc(-50% + var(--rd-x, 0)), -50%) skewX(-10deg);
		width: var(--line-tool-width);
		height: 0.85em;
		background: var(--line-tool-color);
		opacity: var(--line-tool-opacity-idle);
		transition:
			opacity 150ms,
			transform 150ms ease;
	}

	/* Gate hover vs focus-visible by interaction mode so a mouse-hovered zone and
	   a Tab-focused zone never light up at once (see interactionMode.svelte.ts). */
	:global(html[data-interaction='mouse']) .ws-split.line-active:hover::after,
	:global(html[data-interaction='keyboard']) .ws-split.line-active:focus::after {
		opacity: var(--line-tool-opacity-hover);
	}

	.ws-split.touch-lit::after {
		opacity: var(--line-tool-opacity-hover);
	}

	/* ── Merge surface: the full-width line-break band (identical in both panels) ─ */
	/* Height animates 0 ↔ 1.5rem on the mode change so the lines "come apart"; the
	   scroll box (height: auto) follows in flow. At height 0 it still forces a flex
	   wrap, so it doubles as the plain line break in link/view modes. */
	.merge-zone {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 0;
		padding: 0;
		overflow: hidden;
		background: none;
		border: none;
		outline: none;
		transition: height 350ms ease;
	}

	/* NOTE: in one headless/automated probe, forcing `height` on this flex item
	   (even via inline style, transition disabled) computed to 0px, while
	   `min-height` worked. Looked fine in a real browser. If this ever shows up as a
	   real bug, swap `height` for `min-height` here and re-check the close transition. */
	.merge-zone.line-active {
		height: 1.5rem;
		/* The full-width band is only here to force the flex wrap (the line break).
		   Hover/click belong to the dashed line itself, not the empty span beside it —
		   so the band takes no pointer events; the indicator re-enables them. */
		pointer-events: none;
	}

	.merge-zone:not(.line-active) {
		pointer-events: none;
	}

	.merge-zone:not(.line-active) .merge-indicator {
		opacity: 0;
	}

	.merge-indicator {
		display: block;
		width: 2.5rem;
		height: var(--line-tool-width);
		/* Vertical padding gives the thin line a hittable height without thickening
		   it — the dashes are clipped to the content box, so the padding stays
		   invisible. `box-sizing: content-box` keeps the line height exact. */
		box-sizing: content-box;
		padding: 0.45rem 0;
		background-clip: content-box;
		background-image: linear-gradient(to right, var(--line-tool-color) 0 50%, transparent 50% 100%);
		background-repeat: repeat-x;
		background-size: calc(var(--line-tool-dash) + var(--line-tool-gap)) 100%;
		opacity: var(--line-tool-opacity-idle-merge);
		transition:
			opacity 340ms,
			width 340ms ease,
			background-size 340ms ease;
	}

	/* The line itself is the only interactive part of the band (see .merge-zone).
	   Raise it above the flanking tokens, whose tall (leading-10) line-boxes spill
	   into the gap and would otherwise capture the hit. */
	.merge-zone.line-active .merge-indicator {
		pointer-events: auto;
		cursor: pointer;
		position: relative;
		z-index: 2;
	}

	:global(html[data-interaction='mouse']) .merge-zone.line-active .merge-indicator:hover,
	:global(html[data-interaction='keyboard']) .merge-zone.line-active:focus .merge-indicator {
		opacity: var(--line-tool-opacity-hover);
		width: 30%;
		background-size: calc((var(--line-tool-dash) + var(--line-tool-gap)) * 1.5) 100%;
	}

	.merge-zone.touch-lit .merge-indicator {
		opacity: var(--line-tool-opacity-hover);
		width: 30%;
		background-size: calc((var(--line-tool-dash) + var(--line-tool-gap)) * 1.5) 100%;
	}

	@media (prefers-reduced-motion: reduce) {
		.merge-zone,
		.split-zone,
		.ws-split::after {
			transition: none;
		}
	}
</style>
