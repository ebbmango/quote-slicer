# Token State Derivation: Extracted Pure Module

> Commits: `820d3db`  
> Date: 2026-06-09

## Overview

The logic for determining what visual state a token should render in — mapped/idle/active, with which color — was extracted from the `LinkContext` Svelte class into a standalone `tokenState.ts` module. The module has no framework dependency and can be exercised directly in vitest without a Svelte runtime.

## Motivation

`getSourceTokenState()` and `getTargetTokenState()` (including the whitespace bridging scan first described in the [whitespace bridging note](./26-06-09-whitespace-token-bridging.md)) were methods on the `LinkContext` class in `link.svelte.ts`. Being instance methods on a class that wraps Svelte's reactive primitives (`$state`, `$derived`) meant they could only be called inside a running Svelte component tree. There was no path to unit-testing them — any coverage had to go through an end-to-end or component test.

The logic is also pure in principle: given a token index, a mapping index, a list of mappings, and the active mapping ID, the result is deterministic. The coupling to the class was incidental, not necessary.

## Architecture

`src/lib/tokenState.ts` now owns:

- The **data types** `Mapping`, `MappingId`, and `TokenState`. These had to move with the functions to avoid a circular import: if they stayed in `link.svelte.ts`, `tokenState.ts` would need to import from it, while `link.svelte.ts` imports from `tokenState.ts`.
- **`deriveSourceTokenState()`** — looks up the token in the pre-built source mapping index, finds the mapping's color, and returns the appropriate `TokenState`.
- **`findBridgeMappingId()`** (module-private) — the whitespace bridging scan: walks left and right from a whitespace token to find the nearest non-whitespace neighbors, and returns their shared mapping ID if both sides agree.
- **`deriveTargetTokenState()`** — similar to the source variant, but delegates to `findBridgeMappingId` for whitespace tokens before falling through to `unmapped`.

`link.svelte.ts` imports all three exported types and both derivation functions. Its `getSourceTokenState()` and `getTargetTokenState()` methods become one-line delegators, passing the already-derived reactive index maps and the current state.

`link.svelte.ts` re-exports `Mapping`, `MappingId`, and `TokenState` so no existing caller has to change its import path.

## Design Decisions

**Pre-built index maps are passed in, not rebuilt internally.** `LinkContext` already maintains `sourceMappingIndex` and `targetMappingIndex` as `$derived` reactive maps. Passing them into the pure functions avoids rebuilding them per-call. The trade-off is a slightly wider function signature, but the efficiency argument is clear enough to prefer it.

**`findBridgeMappingId` is not exported.** It's an implementation detail of target token state derivation. Naming it (rather than leaving the scan inlined) gives the whitespace bridging rule a legible home without widening the module's interface.

**Delegator methods kept on `LinkContext`.** Removing `getSourceTokenState`/`getTargetTokenState` from the context and asking callers to import `tokenState.ts` directly would force changes across `InteractiveSourceText.svelte`, `InteractiveTargetText.svelte`, and `QuoteWorkbench.svelte`. The thin-delegator pattern preserves the existing call sites while the implementation moves.

## Areas to Be Careful

The functions receive `mappings.find(x => x.id === claimed)!` with a non-null assertion. This is safe as long as `sourceMappingIndex` and `targetMappingIndex` are always derived from the same `mappings` array — which is guaranteed by the `$derived` declarations in `LinkContext`. If the index maps were ever to drift from `mappings` (e.g. passed stale), the assertion would throw at runtime.
