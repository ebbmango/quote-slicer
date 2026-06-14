# Token Store

`src/lib/animation/tokenStore.svelte.ts` — `createTokenStore()` /
`setTokenStoreContext()` / `getTokenStoreContext()`.

## Why it exists

Two facts about the app are in tension:

1. **Line edits must survive.** When the user splits or merges a line, only the tokens'
   `.line` fields change. But the tokenizer reads the *raw text string* — so naively
   re-tokenizing on every render would throw the user's line breaks away.
2. **Pinyin must survive.** Pinyin is annotated onto source tokens as they join
   mappings, and it must persist across line edits too.

Earlier versions split these concerns across `QuoteWorkbench` (which held the cache)
and `Alignment` (which held a synced copy of the tokens, with pinyin on it). Keeping
two token owners in sync via `$effect` was fragile: split/merge had to be handed the
*specific* pinyin-bearing array, and passing the "wrong" (freshly-tokenized) array
silently dropped pinyin.

The token store collapses all of this into **one owner**. It is the single source of
truth for the source/target token arrays: it tokenizes, holds the line-edit cache,
holds the pinyin overlay, and runs the split/merge animation. Both `QuoteWorkbench`
and `Alignment` *derive* their token views from it — neither keeps a copy.

> Naming: always call this the **token store**. Avoid the old name *lineEdit*, and
> avoid "token cache" (the cache is only one part of it). See
> [`CONTEXT.md`](../CONTEXT.md).

## The text-keyed cache

The cache answers "have the tokens for *this exact text* been line-edited?"

```ts
let sourceCache: { text: string; tokens: SourceToken[] } | null = $state(null);

function sourceTokens(text: string): SourceToken[] {
  const base =
    sourceCache !== null && sourceCache.text === text
      ? sourceCache.tokens     // cache hit: text unchanged → reuse split/merged tokens
      : tokenizeSource(text);  // cache miss: text changed → re-tokenize fresh
  return applyPinyin(base);    // overlay pinyin either way
}
```

- **Cache hit** (text unchanged) → the line-edited token array is returned, so manual
  line breaks are preserved across re-renders.
- **Cache miss** (text changed) → fresh tokenize. The old cache is simply ignored, so
  editing the raw text implicitly resets the line structure.

`split`/`merge` write the cache (keyed by the text they ran against). The target side
works identically via `targetCache`.

## The pinyin overlay

Pinyin is kept **separate** from the cache, in an id-keyed map:

```ts
let pinyin: Map<number, string | undefined> = $state(new Map());
```

Why separate? Because pinyin is annotated *before* any split exists to populate the
cache. If pinyin lived only on the cached tokens, a cache miss (the common case before
the first line edit) would lose it. Keeping it in its own id-keyed overlay means it is
re-applied on **every** read, cache hit or miss:

```ts
function applyPinyin(tokens: SourceToken[]): SourceToken[] {
  return tokens.map((t) => {
    if (pinyin.has(t.id)) return { ...t, pinyin: pinyin.get(t.id) };
    if (t.pinyin != null) return { ...t, pinyin: undefined };
    return t;
  });
}
```

`setPinyin(tokenId, value)` reassigns a **new** `Map` (rather than mutating in place)
so dependent `$derived` recompute. Passing `undefined` deletes the entry (clearing
pinyin when a token leaves a mapping).

> Trade-off: `applyPinyin` allocates a new array on every read (`.map()`). That is the
> price of `$derived` recomputing when pinyin changes — don't memoize it without
> confirming pinyin updates still propagate.

## The public surface, and `TokenAccess`

The store exposes:

| Member | Used by | Purpose |
|--------|---------|---------|
| `sourceTokens(text)` / `targetTokens(text)` | `QuoteWorkbench`, `Alignment` | read tokens for a given text (cache + pinyin applied) |
| `setPinyin(id, value)` | `Alignment` | annotate/clear a source token's pinyin |
| `split(...)` / `merge(...)` | `QuoteWorkbench` | line edit + animation |
| `animating` (getter) | `QuoteWorkbench` → panels | true while a split/merge tween is in flight |

`Alignment` only needs read + pinyin-write access, so its constructor takes a narrowed
type:

```ts
type TokenAccess = Pick<TokenStore, 'sourceTokens' | 'targetTokens' | 'setPinyin'>;
```

This keeps the animation-only members (`split`/`merge`/`animating`) out of
`Alignment`'s type surface, so changes to the animation internals can't ripple into
the alignment logic.

## The unified Flip (split/merge animation)

A line edit changes the height of one panel, which shifts everything below it. The
store animates this as **one** GSAP Flip over an **edit scope** — instead of the old
arrangement of an intra-panel Flip plus a separate cross-panel Y-shift, which could
fight over the same elements' boxes.

The **edit scope** is the bundle of DOM refs a single edit animates over, built by
`QuoteWorkbench.editScope()`:

```ts
type EditScope = {
  sourceWrapperEl, targetWrapperEl, authorshipEl,   // whole-unit repositioning targets
  sourceScrollEl,  targetScrollEl                    // the [data-scrollbox] of each panel
};
```

`animate(zone, scope, mutate)` runs the sequence:

1. `Flip.getState(...)` over the flip targets — the **edited** panel's individual
   tokens (each carries `data-flip-id`; they reflow) plus the **other** panel's
   wrapper and the authorship element (they only reposition, as whole units).
2. Lock the edited scroll box to its current pixel height and set `animating = true`,
   so the panel's own instant-fit `$effect` won't snap the height mid-flight.
3. Run `mutate()` (the split/merge + cache write) and `await tick()`.
4. Measure the settled height (briefly set `height: auto`, read `scrollHeight`), then
   GSAP-tween the scroll box from the locked height to the new one; on complete,
   release back to `height: ''` (auto) so the box can follow later in-flow changes.
5. `Flip.from(state, { duration: 0.35, ease: 'power2.inOut', absolute: false })`.
   `absolute: false` keeps the boxes in flow while transforms resolve — the height
   tween supplies the room they need.

Both the Flip and the height tween use the same `DURATION = 0.35` /
`EASE = 'power2.inOut'`, so the panel boundary and the token slide move as one motion.

`Flip` and `gsap` are lazy-loaded in `onMount` (the app is statically prerendered, so
import-time browser API calls must be avoided). **If they haven't loaded yet,
`mutate()` runs synchronously with no animation** — the edit still happens, it just
doesn't tween.

For the panel-side details (the `data-scrollbox` contract, the `animating`-gated
height `$effect`, the index-keyed `{#each}` that keeps spans alive for Flip), see
[Line Mode](line-mode.md#the-splitmerge-animation) and
[Mode Transitions](mode-transitions.md).
