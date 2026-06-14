# Token store consolidation: one owner for source/target token arrays

> Commits: `59cf15c`
> Date: 2026-06-14

## Overview

`lineEdit.svelte.ts` is renamed to `tokenStore.svelte.ts` and absorbs the source/target
token arrays that `Alignment` used to hold separately. The token store is now the single
owner of tokenization, the text-keyed split/merge cache, per-character pinyin, and the
split/merge Flip animation. `Alignment` derives its token views from the store instead of
keeping its own copy.

## Motivation

Before this change, the token arrays had two owners kept in sync via `$effect`:
`QuoteWorkbench` derived `sourceTokens`/`targetTokens` from `lineEdit` and pushed them into
`Alignment` via `setSourceTokens`/`setTargetTokens`. Pinyin was annotated onto `Alignment`'s
copy (`sourceTokenList`), so split/merge had to be called with `alignment.sourceTokenList`
specifically — not the plain derived array — or a split would silently drop pinyin on the
affected tokens. This invariant was documented only in a comment (`Alignment.sourceTokenList`'s
docstring), with nothing enforcing it.

## Architecture

`tokenStore.svelte.ts` exports `createTokenStore()` plus a context pair
(`setTokenStoreContext` / `getTokenStoreContext`). The store's surface splits into:

- `TokenStore` — the full surface, including `split`, `merge`, `animating`, and `EditScope`
  handling, used by `QuoteWorkbench` for editing/animation.
- `TokenAccess` — a `Pick` of `TokenStore` containing only `sourceTokens`, `targetTokens`,
  and `setPinyin`. This is what `Alignment` depends on, so changes to the animation-only
  members of `TokenStore` can't ripple into `Alignment`'s type.

`Alignment`'s constructor now takes a `TokenAccess` (the token store, set up once in
`+page.svelte` via `setTokenStoreContext()` and passed into `setAlignmentContext(store)`).

## Implementation Details

The store adds an id-keyed pinyin overlay (`pinyin: Map<number, string | undefined>`),
separate from the text-keyed split/merge cache — pinyin is annotated via `setPinyin(tokenId,
value)` before any split exists, so a cache miss must still surface it. `sourceTokens(text)`
applies this overlay on every read via `applyPinyin()`, reassigning (not mutating) the
returned array so `$derived` consumers recompute.

`Alignment.sourceTokens`/`targetTokens` become `$derived.by(() => store.sourceTokens(this.meta.sourceText))`
(and the target equivalent), keyed off `Alignment`'s own `meta.sourceText`/`meta.targetText`.
`Alignment.setPinyin` and the toggle/claim paths that used to call the private
`setSourceTokenPinyin` now call `store.setPinyin(tokenId, value)` directly.

In `QuoteWorkbench`, the two `$effect`s that pushed `sourceTokens`/`targetTokens` into
`Alignment` are deleted entirely — `Alignment` now reads the same store `QuoteWorkbench`
reads from. `splitSource`/`mergeSource` now pass the plain derived `sourceTokens` (which
already carries pinyin from the overlay) instead of `alignment.sourceTokenList`, which no
longer exists.

## Design Decisions

- **Single owner over synced copies.** The two-owner arrangement required a documented
  invariant (pass the "live" array, not the derived one) that had no compiler or runtime
  enforcement. Collapsing to one owner removes the possibility of passing the "wrong" array
  — there's only one array.
- **Split the store's type into `TokenStore` vs `TokenAccess`.** `Alignment` only needs
  read + pinyin-write access; exposing the full `TokenStore` (with `split`/`merge`/`animating`)
  would let `Alignment`'s type surface grow coupled to animation internals it doesn't use.
- **Pinyin as an id-keyed overlay, not stored on the cached tokens.** Keeps pinyin
  orthogonal to the text-keyed split/merge cache (which can be invalidated/retokenized
  independently) while still surviving cache misses, since it's reapplied on every read.

## Areas to Be Careful

- `applyPinyin` is called on every `sourceTokens(text)` read — it allocates a new array each
  time via `.map()`. This is the trade for `$derived` recomputation on pinyin changes; don't
  memoize this without checking that pinyin updates still propagate.
- `TokenAccess` is a structural `Pick` of `TokenStore`. If `TokenStore`'s `sourceTokens`/
  `targetTokens`/`setPinyin` signatures change, `Alignment` picks up the new signature
  automatically — there's no separate interface to keep in sync, but also no compile error
  pointing at `Alignment` if the new signature doesn't fit its usage.
