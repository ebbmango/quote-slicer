# Plan: Collapse `LinkContext` into `Alignment`

## What

Rename `LinkContext` → `Alignment` (file, class, context key, exports), and
reshape its click/state-derivation interface to reduce branch complexity and
add unit-test coverage. No change to the underlying mapping data model
(`Mapping`, `MappingId`, `TokenState`, `QuoteExport` all stay as-is).

## Why

`LinkContext` already owns mapping state, click-to-link state machine, and
token-state derivation behind a fairly contained interface — but two methods
(`clickSource`, `clickTarget`) carry asymmetric branch logic (5 vs 3 branches,
shift/force-add + pinyin side effects only on source) with zero tests, only
reachable via DOM click handlers. Same asymmetry in `getSourceTokenState` /
`getTargetTokenState` (target adds whitespace bridging).

"Alignment" names the concept this class is the model *of* — useful since
`view` mode (not yet built, per [overview.md](../overview.md)) will likely
read from the same model. New domain term → added to `CONTEXT.md`.

## Where

- [src/lib/context/link.svelte.ts](../../src/lib/context/link.svelte.ts) — the class itself
- [src/lib/tokenState.ts](../../src/lib/tokenState.ts) — pure derive functions (imports only, no rename)
- [src/lib/components/QuoteWorkbench.svelte](../../src/lib/components/QuoteWorkbench.svelte)
- [src/lib/components/InteractiveSourceText.svelte](../../src/lib/components/InteractiveSourceText.svelte)
- [src/lib/components/InteractiveTargetText.svelte](../../src/lib/components/InteractiveTargetText.svelte)
- [src/lib/components/Mapping.svelte](../../src/lib/components/Mapping.svelte)
- [src/routes/+page.svelte](../../src/routes/+page.svelte)
- `src/lib/vitest-examples/` — new test file(s)
- `docs/data-model.md`, `docs/link-mode.md`, `docs/file-map.md`, `docs/ui-architecture.md`
- `CONTEXT.md` (new, repo root)

## How

### 1. Rename file + class + context plumbing

- `src/lib/context/link.svelte.ts` → `src/lib/context/alignment.svelte.ts`
- `LinkContext` → `Alignment`
- `LINK_KEY` → `ALIGNMENT_KEY`
- `setLinkContext()` / `getLinkContext()` → `setAlignmentContext()` / `getAlignmentContext()`
- Re-export `Mapping`, `MappingId`, `QuoteExport`, `QuoteExportMeta`, `TokenState` unchanged (still re-exported from `tokenState.ts`)

### 2. Reshape click handlers

Replace `clickSource(i, shift)` / `clickTarget(i)` with `toggleSource(i, opts)` /
`toggleTarget(i)`, sharing a private helper for the identical
claimed-by-active/claimed-by-other skeleton:

```ts
toggleSource(i: number, opts: { force?: boolean } = {}): void {
  const tokenId = this.sourceTokens[i].id;
  if (this.tryRemoveOrSwitch('source', tokenId)) return;

  const m = this.activeMapping;
  if (m && (opts.force || m.sourceTokenIds.length === 0)) {
    m.sourceTokenIds = [...m.sourceTokenIds, tokenId];
  } else {
    const newM = this.createMapping();
    newM.sourceTokenIds = [tokenId];
    this.mappings = [...this.mappings, newM];
    this.activeMappingId = newM.id;
  }
  this.setSourceTokenPinyin(tokenId, tokenPinyin(this.sourceTokens[i]));
}

toggleTarget(i: number): void {
  if (this.targetTokens[i]?.type === 'whitespace') return;
  const tokenId = this.targetTokens[i].id;
  if (this.tryRemoveOrSwitch('target', tokenId)) return;

  if (this.activeMapping) {
    this.activeMapping.targetTokenIds = [...this.activeMapping.targetTokenIds, tokenId];
  } else {
    const m = this.createMapping();
    m.targetTokenIds = [tokenId];
    this.mappings = [...this.mappings, m];
    this.activeMappingId = m.id;
  }
}

private tryRemoveOrSwitch(panel: 'source' | 'target', tokenId: number): boolean {
  const key = panel === 'source' ? 'sourceTokenIds' : 'targetTokenIds';
  const claimed = this.mappings.find((m) => m[key].includes(tokenId));
  if (!claimed) return false;
  if (claimed.id === this.activeMappingId) {
    claimed[key] = claimed[key].filter((id) => id !== tokenId);
    if (panel === 'source') this.setSourceTokenPinyin(tokenId, undefined);
    this.pruneActive();
  } else {
    this.activeMappingId = claimed.id;
  }
  return true;
}
```

### 3. Reshape state derivation getters

`getSourceTokenState(i)` → `stateOfSource(i)`, `getTargetTokenState(i)` →
`stateOfTarget(i)`. Same bodies (delegate to `deriveSourceTokenState` /
`deriveTargetTokenState` in `tokenState.ts`), just renamed for symmetry with
`toggleSource`/`toggleTarget`.

### 4. Update call sites

In `QuoteWorkbench.svelte`, `InteractiveSourceText.svelte`,
`InteractiveTargetText.svelte`, `Mapping.svelte`, `+page.svelte`:

- `getLinkContext()` → `getAlignmentContext()` / `setLinkContext()` → `setAlignmentContext()`
- local variable `link` → `alignment`
- `link.clickSource(i, shift)` → `alignment.toggleSource(i, { force: shift })`
- `link.clickTarget(i)` → `alignment.toggleTarget(i)`
- `link.getSourceTokenState(i)` → `alignment.stateOfSource(i)`
- `link.getTargetTokenState(i)` → `alignment.stateOfTarget(i)`
- everything else (`mappings`, `activeMappingId`, `sortedMappingViews`,
  `setPinyin`, `setSourceTokens`/`setTargetTokens`/`setMeta`, `exportData`/
  `exportJson`, `findDefaultTokenIndex`, `deselect`/`deleteActive`/
  `deleteById`) — rename receiver only, no signature change

Note: `InteractiveSourceText.svelte`'s `longpress` action calls
`link.clickSource(i, true)` for force-add — becomes
`alignment.toggleSource(i, { force: true })`.

### 5. New unit tests

`src/lib/vitest-examples/alignment.spec.ts` (or `tokenState.spec.ts` if
splitting by file) covering, with no Svelte runtime needed:

- `tokenState.ts` pure functions:
  - `buildTargetText` — single group, multi-group with `, ` join, bridging
    across whitespace/punctuation within the 5-token threshold, bridging
    refused beyond threshold or across non-whitespace/punctuation, empty
    input
  - `findBridgeMappingId` — both-sides-same-mapping bridges, mismatched
    sides don't bridge, no mapping on either side
  - `deriveSourceTokenState` / `deriveTargetTokenState` — unmapped, idle,
    active, target whitespace bridging→idle/active

- `Alignment.toggleSource` / `toggleTarget` branch matrix:
  - no active mapping → creates new mapping, sets pinyin (source only)
  - active mapping, no sources yet → appends
  - active mapping with existing source, no force → creates new mapping
  - active mapping with existing source, force → appends
  - click on token already in active mapping → removes + prunes if empty,
    clears pinyin (source only)
  - click on token in another mapping → switches active
  - target: whitespace token → no-op

To exercise `Alignment` without a Svelte component tree, instantiate it
directly (`new Alignment()`) and call `setSourceTokens`/`setTargetTokens`
before exercising `toggleSource`/`toggleTarget` — Svelte 5 `$state`/`$derived`
work in plain `.svelte.ts` modules outside components, no `setContext`
required for the test.

### 6. New `CONTEXT.md`

Create at repo root:

```md
# quote-slicer

quote-slicer aligns Chinese source text with English translations, character
by character, recording pinyin and color-coded mappings.

## Language

**Alignment**:
The model owning mappings, source/target token arrays, the click-to-link
state machine, and per-token display state (`TokenState`). Implemented as
`Alignment` in `src/lib/context/alignment.svelte.ts`.
_Avoid_: LinkContext, link state
```

(Keep `Mapping`, `SourceToken`/`TargetToken`, `MappingView`, etc. defined in
`CLAUDE.md` — `CONTEXT.md` only adds `Alignment` since it's the one new term.)

### 7. Doc updates

Replace `LinkContext` references with `Alignment` (and `link.svelte.ts` with
`alignment.svelte.ts`) in:

- `docs/data-model.md`
- `docs/link-mode.md`
- `docs/file-map.md`
- `docs/ui-architecture.md`

## Out of scope (future work)

- Token-grid keyboard navigation module (separate candidate — depends on
  `Alignment.findDefaultTokenIndex`, unchanged here)
- `setSourceTokens`/`setTargetTokens` shadow-copy pattern (token cache
  ownership — separate candidate)
- Shared Flip-transition extraction for `InteractiveSourceText`/
  `InteractiveTargetText` (separate candidate, unrelated to `Alignment`)

## Verification

- `npx tsc --noEmit`
- `npx vitest` — new `Alignment`/`tokenState` tests pass
- `npm run dev` — link mode: click-to-map, force-add (Alt+Shift+Space /
  long-press), pinyin auto-fill/clear, mapping switch/remove/prune,
  whitespace bridging in target panel all behave as before
