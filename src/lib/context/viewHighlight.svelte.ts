import type { MappingId } from '$lib/tokenState';

// How long to wait before lighting a mapping on first hover (nothing was lit).
// `WARM` is the shorter wait used when re-entering a mapping within `GRACE` ms
// of the previous highlight clearing. The delay stops the text flickering as
// the pointer glides across tokens; clearing is always immediate (the CSS color
// transition makes the fade-out gradual).
const HL_COLD_DELAY = 500;
const HL_WARM_DELAY = 300;
const HL_WARMTH_GRACE = 500;

// Resolves a token index in either panel to the mapping it belongs to, or null.
// Alignment passes a closure over its live `sourceMappingIndex` / `targetMappingIndex`
// maps — those are `$derived`, so they're always current when the resolver is called.
type MappingAtResolver = (zone: 'source' | 'target', i: number) => MappingId | null;

export class ViewHighlight {
	// The mapping currently lit across both panels.
	hoveredMappingId: MappingId | null = $state(null);
	// The mapping under the pointer right now (may differ from `hoveredMappingId`
	// while a light-up timer is pending).
	private pointerMapping: MappingId | null = null;
	// True while lit and for `HL_WARMTH_GRACE` ms after clearing; selects the
	// shorter `HL_WARM_DELAY` for the next hover.
	private warm = false;
	private lightTimer: ReturnType<typeof setTimeout> | null = null;
	private graceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(private mappingAt: MappingAtResolver) {}

	// Core state-machine step. `next` is the mapping under the pointer (null =
	// unmapped token, whitespace, or the pointer left the text). Light-up is
	// delayed; clearing is immediate. No-op when the pointer hasn't actually
	// changed mapping — keeps a move between two tokens of the *same* mapping lit
	// without a flash, and lets the clear come only from entering a non-mapping or
	// leaving.
	private movePointer(next: MappingId | null): void {
		if (next === this.pointerMapping) return;
		this.pointerMapping = next;
		this.clearLightTimer();

		if (next === null) {
			if (this.hoveredMappingId !== null) {
				this.hoveredMappingId = null;
				this.startGrace();
			}
			return;
		}
		if (next === this.hoveredMappingId) return; // already lit — instant stay

		const delay = this.warm ? HL_WARM_DELAY : HL_COLD_DELAY;
		this.lightTimer = setTimeout(() => {
			this.lightTimer = null;
			this.hoveredMappingId = next;
			this.warm = true;
			this.clearGrace();
		}, delay);
	}

	hoverSource(i: number): void {
		this.movePointer(this.mappingAt('source', i));
	}
	hoverTarget(i: number): void {
		this.movePointer(this.mappingAt('target', i));
	}
	hoverOut(): void {
		this.movePointer(null);
	}

	// Touch tap: instant, no delay. Tap the lit mapping again to dismiss, tap a
	// different one to switch, tap null to clear.
	private tapMapping(m: MappingId | null): void {
		this.clearLightTimer();
		// A grace timer left running from a prior hover-away would keep `warm` true
		// through the tap, so the next mouse hover would use the 300ms warm delay
		// instead of 500ms cold. Reset both for consistent timing.
		this.clearGrace();
		this.warm = false;
		// Keep `pointerMapping` in lockstep with what ends up lit, not the tapped
		// id: a toggle-off lands on null, so a later mouse hover of the same token
		// won't hit movePointer's `next === pointerMapping` early-return and stay dark.
		const next = m === this.hoveredMappingId ? null : m;
		this.pointerMapping = next;
		this.hoveredMappingId = next;
	}
	tapSource(i: number): void {
		this.tapMapping(this.mappingAt('source', i));
	}
	tapTarget(i: number): void {
		this.tapMapping(this.mappingAt('target', i));
	}

	isSourceHighlighted(i: number): boolean {
		return this.hoveredMappingId !== null && this.mappingAt('source', i) === this.hoveredMappingId;
	}
	isTargetHighlighted(i: number): boolean {
		return this.hoveredMappingId !== null && this.mappingAt('target', i) === this.hoveredMappingId;
	}

	// Reset all state and cancel pending timers. Call when leaving view mode.
	clearHighlight(): void {
		this.clearLightTimer();
		this.clearGrace();
		this.pointerMapping = null;
		this.warm = false;
		this.hoveredMappingId = null;
	}

	private clearLightTimer(): void {
		if (this.lightTimer !== null) {
			clearTimeout(this.lightTimer);
			this.lightTimer = null;
		}
	}
	private startGrace(): void {
		this.clearGrace();
		this.graceTimer = setTimeout(() => {
			this.graceTimer = null;
			this.warm = false;
		}, HL_WARMTH_GRACE);
	}
	private clearGrace(): void {
		if (this.graceTimer !== null) {
			clearTimeout(this.graceTimer);
			this.graceTimer = null;
		}
	}
}
