# Line Mode

Line mode (`mode.current === 'line'`) lets users adjust where line breaks fall in the source and target texts independently. Line edits do not change the raw text strings — they mutate the token array's `.line` fields and are preserved by the text-keyed cache.

## Core functions

All three live in `src/lib/line.ts` as pure generics over `T extends { line: number }`.

### `splitAfterToken(tokens, afterIndex)`

Inserts a line break after `tokens[afterIndex]`. Returns a new array — does not mutate. Logic:

- Tokens on lines **above** `splitLine` → unchanged
- Tokens at index `afterIndex` and before on `splitLine` → unchanged
- Tokens **after** `afterIndex` on `splitLine` → `line = splitLine + 1` (moved to new line)
- Tokens on lines **below** `splitLine` → `line + 1` (shift down to make room)

No tokens are added or removed. Token IDs are invariant.

### `mergeLines(tokens, lineN)`

Merges line `lineN + 1` into line `lineN`. Returns a new array. Logic:

- Tokens on `lineN + 1` → `line = lineN`
- Tokens on lines above `lineN + 1` → `line - 1` (close the gap)
- All other tokens → unchanged

### `groupByLine(tokens)`

Groups a flat token array into line buckets. Returns:

```ts
{ lineNum: number; group: { token: T; globalIndex: number }[] }[]
```

Each entry carries `globalIndex` — the token's position in the original flat array. Used as a `$derived` in `InteractiveSourceText` for rendering line rows.

## Text-keyed cache pattern

Fresh tokenization discards any manual line splits because the tokenizer re-reads the raw text string. `QuoteWorkbench.svelte` prevents this with a text-keyed cache:

```ts
let sourceTokensCache = $state<{ text: string; tokens: SourceToken[] } | null>(null);

let sourceTokens = $derived(
  sourceTokensCache !== null && sourceTokensCache.text === sourceText
    ? sourceTokensCache.tokens    // cache hit: text unchanged, use split/merged tokens
    : tokenizeSource(sourceText)  // cache miss: text changed, re-tokenize fresh
);
```

Split and merge write to the cache:

```ts
function splitSource(afterIndex: number) {
  sourceTokensCache = { text: sourceText, tokens: splitAfterToken(sourceTokens, afterIndex) };
}
```

When the user edits the raw text, `sourceText` changes → cache key mismatch → fresh tokenize → cache cleared implicitly. When the user only adjusts line breaks, `sourceText` stays the same → cache hit → line structure preserved across re-renders.

The same pattern applies to target tokens via `targetTokensCache`.

## Interaction model

### Source panel (InteractiveSourceText)

In line mode the source panel renders a flat `{#each tokens}` loop with `data-flip-id="src-{i}"` on every token span. Between tokens, zero-width buttons appear:

- **Between tokens on the same line** → split button (vertical hairline indicator on hover)
- **At a line boundary** → merge button (horizontal hairline indicator on hover)

Clicking a split button calls `onSplit(globalIndex)` which bubbles up to `QuoteWorkbench.splitSource`. Clicking a merge button calls `onMerge(lineN)` which bubbles to `QuoteWorkbench.mergeSource`.

### Target panel (InteractiveTargetText)

The target panel uses whitespace tokens as the interaction surface rather than zero-width buttons:

- **Interior whitespace tokens** (not at a line boundary) → rendered as `<button class="ws-split">`, clicking triggers `handleSplit(i)`
- **Boundary whitespace tokens** (the synthetic token appended between lines during tokenization) → rendered as `<button class="ws-boundary">` plus a merge-zone button below it, clicking either triggers `handleMerge(token.line)`

Non-whitespace tokens and non-boundary whitespace tokens are plain spans.

## Animation

Both panels lazy-load GSAP's `Flip` plugin inside `onMount`. On split or merge:

1. `Flip.getState(querySelectorAll('[data-flip-id]'))` captures positions before the mutation
2. The mutation fires (writes to cache → `sourceTokens` / `targetTokens` update reactively)
3. `await tick()` lets Svelte apply the DOM changes
4. `Flip.from(state, { duration: 0.35, ease: 'power2.inOut', absolute: true })` animates each token from its old position to its new one

The flat `{#each tokens (i)}` loop in `InteractiveSourceText` (keyed by index, not token identity) keeps every span alive across mutations so Flip can track all elements. `InteractiveTargetText` is keyed by index in line mode for the same reason.

`InteractiveSourceText` sets an explicit pixel height on its outer container after every token change (`$effect` at `InteractiveSourceText.svelte:52`). This prevents Flip's `absolute: true` from collapsing the container while tokens are temporarily taken out of flow.

### Cross-panel sibling shift

When source splits or merges, the target panel (and authorship textarea) shift vertically. `QuoteWorkbench.withShiftAnimation()` handles this:

1. Snapshot `getBoundingClientRect()` for each sibling element before the mutation
2. Call `mutate()` (writes to cache), `await tick()`
3. If a `lockEl` is provided, lock its pixel height to prevent any concurrent Flip animation from collapsing it mid-transition
4. Animate each displaced sibling with `gsap.fromTo(el, { y: dy }, { y: 0, … })`
5. Release the height lock after all animations complete

`targetWrapperEl` is passed as `lockEl` when the target panel mutates, because Flip's `absolute: true` would otherwise collapse it. Source mutations don't need a lock because `InteractiveSourceText` manages its own height via the `$effect`.

`justify-center` on the workbench parent means all three panels shift together when total height changes — source must be included in the sibling list even when only target mutates.
