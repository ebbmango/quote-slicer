# Line Editing Architecture

How tokens are split across lines, how lines are merged, and how the UI renders by line.

---

## Core Module

`src/lib/line.ts` — three pure, generic functions operating on any `T extends { line: number }`.

---

## Functions

### `groupByLine(tokens)`

Groups a flat token array into line buckets for rendering. Returns:

```ts
{ lineNum: number; group: { token: T; globalIndex: number }[] }[]
```

Sorted by `lineNum`. Each entry carries `globalIndex` (position in the original flat array) so callers can pass token indices back to `LinkContext` without offset math.

Used by `InteractiveSourceText` and `InteractiveTargetText` as a `$derived`:

```ts
let lineGroups = $derived(groupByLine(tokens));
```

### `splitAfterToken(tokens, afterIndex)`

Inserts a line break after the token at `afterIndex`. Pure — returns new array, does not mutate.

Logic:
- Tokens on lines **after** `splitLine` → `line + 1` (shift everything down)
- Tokens **after** `afterIndex` on the **same** line → `line + 1` (move to new line)
- All other tokens → unchanged

### `mergeLines(tokens, lineN)`

Merges line `lineN + 1` into line `lineN`. Pure — returns new array.

Logic:
- Tokens on `lineN + 1` → `line = lineN`
- Tokens on lines above `lineN + 1` → `line - 1` (close the gap)
- All other tokens → unchanged

---

## Token Array Design

Tokens always live in a **single flat array**. The `line` field is purely a logical grouping — it does not affect token order or index. `splitAfterToken` and `mergeLines` only reassign `line` values; no tokens are added or removed.

This means `globalIndex` in `groupByLine` output is stable across splits and merges, so `LinkContext`'s `sourceIndices` / `targetIndices` remain valid after line edits.

---

## Cache Pattern (QuoteWorkbench)

Fresh tokenization discards any manual line splits. `QuoteWorkbench.svelte` solves this with a text-keyed cache:

```ts
let sourceTokensCache = $state<{ text: string; tokens: RawSourceToken[] } | null>(null);

let sourceTokens = $derived(
  sourceTokensCache !== null && sourceTokensCache.text === sourceText
    ? sourceTokensCache.tokens          // use split/merged version
    : tokenizeSource(sourceText)        // text changed — re-tokenize
);
```

Split/merge functions write to the cache:

```ts
function splitSource(afterIndex: number) {
  sourceTokensCache = { text: sourceText, tokens: splitAfterToken(sourceTokens, afterIndex) };
}
function mergeSource(lineN: number) {
  sourceTokensCache = { text: sourceText, tokens: mergeLines(sourceTokens, lineN) };
}
```

When the user edits the raw text, `sourceText` changes → cache key mismatches → fresh tokenization → cache cleared implicitly. When the user only splits/merges lines, `sourceText` stays the same → cache hit → line structure preserved.

Same pattern applies to target tokens (`targetTokensCache`, `splitTarget`, `mergeTarget`).

---

## Data Flow

```
sourceText / targetText
    │
    ▼
tokenizeSource / tokenizeTargetSeparate   ← fresh (cache miss)
    │                     ▲
    ▼                     │ cache miss
sourceTokensCache ────────┘
    │
    ▼
splitAfterToken / mergeLines   ← user line edits
    │
    ▼
groupByLine   ← InteractiveSourceText / InteractiveTargetText
    │
    ▼
rendered line rows (onSplit / onMerge callbacks bubble up to QuoteWorkbench)
```
