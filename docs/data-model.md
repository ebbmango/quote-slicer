# Data Model

## Token types

Defined in `src/lib/tokenize.ts`.

```ts
type SourceToken = {
  id: number;   // stable across split/merge; assigned once as flat-array position
  text: string;
  line: number;
  type: 'character' | 'punctuation' | 'number' | 'symbol';
  pinyin?: string; // set when token joins a mapping; cleared when removed
};

type TargetToken = {
  id: number;   // stable across split/merge; assigned once as flat-array position
  text: string;
  line: number;
  type: 'text' | 'hanzi' | 'punctuation' | 'whitespace';
};
```

Source tokens are individual Chinese characters (or punctuation/numbers in the source text). Target tokens are words, punctuation runs, and whitespace runs.

## Mapping type

Defined in `src/lib/tokenState.ts`.

```ts
type MappingId = string; // crypto.randomUUID()

type Mapping = {
  id: MappingId;
  colorIndex: number;         // index into MAPPING_COLORS; assigned at creation, never changes
  sourceTokenIds: number[];   // stable token IDs, not array indices
  targetTokenIds: number[];   // stable token IDs, not array indices
};
```

## Stable token IDs

`SourceToken.id` and `TargetToken.id` are assigned as the token's position in the flat array at tokenization time (`tokenize.ts:32`, `tokenize.ts:69`). They are assigned once and never change.

`splitAfterToken` and `mergeLines` in `src/lib/line.ts` only mutate the `.line` field and spread tokens — they never insert or remove tokens, so IDs survive line edits intact.

`Mapping` stores `sourceTokenIds` and `targetTokenIds` (IDs, not array indices). `Alignment` derives two reverse maps at runtime:

- `sourceIdToIndex: Map<tokenId, arrayIndex>`
- `targetIdToIndex: Map<tokenId, arrayIndex>`

These maps are `$derived` and rebuild whenever the token arrays update. The two index maps `sourceMappingIndex` and `targetMappingIndex` are then derived from them. If a token ID is not found in the current token array it simply drops out — no corruption, no error.

This design means future features that remove tokens (e.g. editing source text after linking) cannot produce dangling references in mappings.

## TokenState

`TokenState` is the per-token display state returned by `deriveSourceTokenState()` and `deriveTargetTokenState()` in `src/lib/tokenState.ts`:

```ts
type TokenState =
  | { kind: 'unmapped' }
  | { kind: 'idle';   color: string }
  | { kind: 'active'; color: string };
```

`unmapped` — not in any mapping. `idle` — in a mapping, that mapping is not selected. `active` — in the currently selected mapping.

## MappingView

`MappingView` is a derived, read-only snapshot of a `Mapping` for display, defined in `src/lib/context/alignment.svelte.ts:18`:

```ts
type MappingView = {
  id: MappingId;
  colorIndex: number;
  sourceEntries: { tokenIndex: number; text: string; pinyin: string }[];
  targetText: string;
};
```

`Mapping.svelte` reads only `MappingView` — it never touches the raw `Mapping` state or the token arrays directly. `targetText` is built by `buildTargetText()`, which spans contiguous groups of target tokens (bridging whitespace and punctuation gaps ≤ 5 tokens) and joins non-contiguous groups with `, `.

`sourceEntries[].pinyin` reads `SourceToken.pinyin ?? ''` — pinyin lives on the source token, not on `Mapping`.
