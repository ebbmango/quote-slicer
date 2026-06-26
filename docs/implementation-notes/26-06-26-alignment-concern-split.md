# Alignment concern split: ViewHighlight and colouring index

> Commits: `d998e63`  
> Date: 2026-06-26

## Overview

`Alignment` had grown to carry two unrelated responsibilities: the link-mode
mapping model (mappings list, active mapping, toggle state machine, pinyin,
export) and the view-mode hover-highlight timer machine. This commit pulls both
out cleanly. The timer machine becomes `ViewHighlight`; the index-building
logic moves into a pure function `buildMappingIndex` in `tokenState.ts`. No
caller API changed.

## Motivation

Two separate issues pushed toward this split.

**Testability.** The view-mode highlight logic — a three-state machine (cold/warm/grace)
built on `setTimeout` — was buried inside `Alignment` and could only be exercised
through a live Svelte context. Writing fake-timer tests for it required mocking
the whole class. Extracted as `ViewHighlight`, it can be instantiated directly
and driven with `vi.useFakeTimers()`.

**Hidden coupling in the colouring path.** `Alignment` built two private `$derived`
maps (`sourceMappingIndex`, `targetMappingIndex`) that translated token indices
to `MappingId` strings, then passed those maps *and* the full `mappings` array
into `deriveSourceTokenState` / `deriveTargetTokenState`. The derive functions
then did a `mappings.find(x => x.id === claimed)` on every call — an O(n) scan
that was also untestable in isolation, since you had to construct both the index
and the full array correctly to reach the look-up path. The index-building itself
lived entirely in `Alignment`, so tests for the derive functions had to hand-craft
mock indexes, leaving the real build logic uncovered.

## Architecture

**`ViewHighlight`** (`src/lib/context/viewHighlight.svelte.ts`) is a standalone
Svelte 5 reactive class. Its only dependency is a `MappingAtResolver` — a
`(zone, i) => MappingId | null` closure — injected via the constructor. `Alignment`
provides this closure at construction time, pointing it at the live `$derived`
index maps, so the resolver always reflects the current token layout.

**`buildMappingIndex`** (`src/lib/tokenState.ts`) is a plain TypeScript function,
no framework dependency. It takes `mappings`, an `idToIndex` map, and a
`tokenIds` accessor, and returns `Map<number, Mapping>`. The change in value
type — from `MappingId` to `Mapping` — is the key move: the derive functions now
read the Mapping object directly from the index and no longer need the full
`mappings` array. The `findBridgeMapping` helper (whitespace bridging for target
tokens) similarly compares Mapping object references instead of ID strings.

## Design Decisions

**`Map<number, Mapping>` not `Map<number, MappingId>`.** Storing the Mapping
object directly eliminates the secondary look-up (`mappings.find`) that was
O(n) per token per render. It also means the index becomes a first-class source
of truth rather than an intermediate pointer. Bridging (`findBridgeMapping`)
uses `left === right` object identity — safe because `buildMappingIndex` stores
exactly one Mapping object per mapping, so all indices for the same mapping hold
the same reference.

**Delegation, not re-exposure.** `Alignment`'s public surface is unchanged —
`hoverSource`, `tapTarget`, `isSourceHighlighted`, `clearHighlight`, etc. are
thin one-line delegates to the internal `ViewHighlight` instance. No caller
had to change. This was possible because `ViewHighlight` was designed to accept
a resolver closure rather than to take ownership of the index maps, keeping the
coupling to a single call-time function rather than a structural reference.

**`tokenState.ts` stays framework-free.** `buildMappingIndex` is pure TS —
no Svelte import. This preserves the existing property that `tokenState.ts`
is importable without a Svelte context, and all its logic (including the new
function) remains unit-testable without the runes runtime.

## Areas to Be Careful

The `ViewHighlight` resolver closure captures `this` from `Alignment`'s
constructor. It reads `this.sourceMappingIndex` and `this.targetMappingIndex`
at *call time*, which is correct — those are `$derived` fields and will be
current. But if `ViewHighlight.movePointer` or a timer callback were to invoke
the resolver after `Alignment` had been garbage-collected, the closure would
read stale/undefined state. In practice this can't happen because `ViewHighlight`
is held by `Alignment` and shares its lifetime, but it is an implicit assumption
worth knowing.
