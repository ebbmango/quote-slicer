# Token Store

`src/lib/context/tokenStore.svelte.ts` — `createTokenStore()` /
`setTokenStoreContext()` / `getTokenStoreContext()`.

## Why it exists

Two facts about the app are in tension:

1. **Line edits must survive.** When the user splits or merges a line, only the tokens'
   `.line` fields change. But the tokenizer reads the _raw text string_ — so naively
   re-tokenizing on every render would throw the user's line breaks away.
2. **Pinyin must survive.** Pinyin is annotated onto source tokens as they join
   mappings, and it must persist across line edits too.

Earlier versions split these concerns across `QuoteWorkbench` (which held the cache)
and `Alignment` (which held a synced copy of the tokens, with pinyin on it). Keeping
two token owners in sync via `$effect` was fragile: split/merge had to be handed the
_specific_ pinyin-bearing array, and passing the "wrong" (freshly-tokenized) array
silently dropped pinyin.

The token store collapses all of this into **one owner**. It is the single source of
truth for the source/target token arrays: it tokenizes, holds the line-edit cache,
holds the pinyin overlay, and runs the split/merge animation. Both `QuoteWorkbench`
and `Alignment` _derive_ their token views from it — neither keeps a copy.

> Naming: always call this the **token store**. Avoid the old name _lineEdit_, and
> avoid "token cache" (the cache is only one part of it). See
> [`CONTEXT.md`](../CONTEXT.md).

The cache and overlay behaviour below is unit-tested in `tokenStore.spec.ts` — under
plain node, since `onMount` (which arms the animation) is a no-op there. See
[Testing](testing.md).

## The text-keyed cache

The cache answers "have the tokens for _this exact text_ been line-edited?"

```ts
let sourceCache: { text: string; tokens: SourceToken[] } | null = $state(null);

function sourceTokens(text: string): SourceToken[] {
	const base =
		sourceCache !== null && sourceCache.text === text
			? sourceCache.tokens // cache hit: text unchanged → reuse split/merged tokens
			: tokenizeSource(text); // cache miss: text changed → re-tokenize fresh
	return applyPinyin(base); // overlay pinyin either way
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

Why separate? Because pinyin is annotated _before_ any split exists to populate the
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

The value stored here is **canonical numbered pinyin** (`"zhi1"`), not the diacritic
display form — `Alignment` canonicalizes before calling `setPinyin`, and the diacritic
is derived for display only. See
[Link Tool → Pinyin](link-tool.md#pinyin-auto-fill-and-canonical-storage).

> Trade-off: `applyPinyin` allocates a new array on every read (`.map()`). That is the
> price of `$derived` recomputing when pinyin changes — don't memoize it without
> confirming pinyin updates still propagate.

## The public surface, and `TokenAccess`

The store exposes:

| Member                                      | Used by                       | Purpose                                               |
| ------------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| `sourceTokens(text)` / `targetTokens(text)` | `QuoteWorkbench`, `Alignment` | read tokens for a given text (cache + pinyin applied) |
| `setPinyin(id, value)`                      | `Alignment`                   | annotate/clear a source token's pinyin                |
| `split(...)` / `merge(...)`                 | `QuoteWorkbench`              | line edit + animation                                 |
| `animating` (getter)                        | `QuoteWorkbench` → panels     | true while a split/merge tween is in flight           |

`Alignment` only needs read + pinyin-write access, so its constructor takes a narrowed
type:

```ts
type TokenAccess = Pick<TokenStore, 'sourceTokens' | 'targetTokens' | 'setPinyin'>;
```

This keeps the animation-only members (`split`/`merge`/`animating`) out of
`Alignment`'s type surface, so changes to the animation internals can't ripple into
the alignment logic.

## The line-edit animation (split/merge)

A line edit changes the height of one panel, which moves the panel boundary and — when
the quote stack grows — re-centres the whole block. The store animates all of this with
a **single GSAP Flip** keyed by an **edit scope**, replacing an older arrangement of an
intra-panel Flip plus a separate cross-panel Y-shift that fought over the same boxes.

The **edit scope** is the bundle of DOM refs a single edit operates on, built by
`QuoteWorkbench.editScope()`:

```ts
type EditScope = {
	sourceWrapperEl: HTMLElement | null; // the data-zone panel wrappers (height-tweened
	targetWrapperEl: HTMLElement | null; //   when the edited one can grow)
	sourceScrollEl: HTMLElement | null; // each panel's [data-scrollbox] — the edited one's
	targetScrollEl: HTMLElement | null; //   tokens (data-flip-id) are found inside it
	authEl: HTMLElement | null; // the authorship textarea
};
```

The authorship ref (`authEl`) is **passed in**, not discovered: the workbench owns the
layout, so the store reads only what its scope hands it rather than walking the DOM up
from a panel to find `#authorship`. See [`CONTEXT.md`](../CONTEXT.md) ("edit scope").

`animate(zone, scope, mutate)` runs one Flip over the whole vertical layout — no manual
height locking, measuring, or tweening:

1. Capture the edited panel's tokens (`[data-flip-id]` inside its scroll box) and the
   other wrapper's height, then `Flip.getState(...)` over the flip targets: **both panel
   wrappers + the authorship field + the edited tokens**. Capturing the _layout boxes_
   (not just the tokens) is what lets the panel boundary animate from its pre-edit
   position instead of snapping there on the first frame.
2. Set `animating = true` (gates the panel's height `$effect`), run `mutate()`
   (split/merge + cache write), `await tick()`, then force one synchronous reflow
   (read `offsetHeight`) so flex fully resolves before Flip reads the after-state.
   (Flex settles in a _single_ reflow — confirmed with GSAP disabled — so no
   release-and-wait loop is needed.)
3. `Flip.from(state, { duration: 0.35, ease: 'power2.inOut', absolute: false, nested: true })`.
   - **`absolute: false`** keeps the boxes in flow, so the edited wrapper's height change
     drives the surrounding layout naturally; **`nested: true`** lets each token's flip
     ride inside its wrapper's flip.
   - The tokens already **overflow** their `overflow-clip` wrapper, so the wrapper's own
     height animation never fights the token slide inside it.

### The slide is flow-driven, not a second Flip

`Flip.getState` _includes_ the other (non-edited) wrapper and the authorship field, but
they are not meant to carry an independent transform — they should ride the flow as the
edited wrapper's height changes. Because `absolute: false` reverts the layout to "before"
when `Flip.from` starts, any transform Flip computed for them (from the full before→after
delta) lands on an element already at its before-flow position and **double-counts** the
displacement. So immediately after `Flip.from` the store clears those transforms:

```js
if (scope.authEl) gsap.set(scope.authEl, { clearProps: 'transform' });
if (otherWrapper && !otherHeightChanged) gsap.set(otherWrapper, { clearProps: 'transform' });
```

Auth is always cleared (it has no height of its own — it only moves with the stack
re-centring). The other wrapper is cleared **only if its height didn't change**: a changed
height signals the constrained/overflow regime, where flex redistributes both panels and
the Flip transform _is_ load-bearing for the position animation. The other wrapper's
height is measured before and after the mutation so the regime check uses settled values.

This dual-regime behaviour — flow-driven slide when the stack can grow, Flip-driven
position when it's capped — is recorded in
[ADR-0001](adr/0001-line-edit-dual-scroll-regime.md), which also lists the alternatives
tried and the residual ~10 px settle.

> Avoid calling this a "unified Flip" or "double Flip" (see `CONTEXT.md`): there is one
> Flip, and the panels below the edit move because flow pushes them, not because a Flip
> transform carries them (except in the capped regime).

`Flip` and `gsap` are lazy-loaded in `onMount` (the app is statically prerendered, so
import-time browser API calls must be avoided). **If they haven't loaded yet, or
`prefers-reduced-motion` is set, `mutate()` runs synchronously with no animation** — the
edit still happens, it just doesn't tween.

For the panel-side details (the `data-scrollbox` contract, the `animating`-gated
height `$effect`, the index-keyed `{#each}` that keeps spans alive for Flip), see
[Line Tool](line-tool.md#the-splitmerge-animation) and
[Tool Transitions](tool-transitions.md).
