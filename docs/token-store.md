# Token Store

`src/lib/context/tokenStore.svelte.ts` owns canonical source and target tokens,
independent break arrays, the ID-keyed pinyin overlay, and line-edit animation.
Alignment and QuoteWorkbench read the same store.

## Token identity and draft text

Tokenization is memoized by exact input text. IDs are allocated monotonically
per side; a raw-text edit consumes fresh IDs rather than reusing positions.
Plain memoization avoids reactive writes from derived readers.

Break edits are separate reactive arrays keyed to the draft text. A split or
merge modifies only one array. Source and target tokens are never copied into
a line-bearing view or compatibility adapter.

Creating the first mapping locks text identity on both sides. Annotated source
text is also protected against retokenization. Future text editing must use the
explicit correspondence utilities in `tokenMutation.ts`; a string replacement
cannot silently reuse IDs for new text.

## Pinyin

The overlay is keyed by token ID and applied on read. Setting undefined removes
an annotation; null remains not-applicable. Alignment converts display pinyin
to its canonical numbered form before storing it.

## Public surface

- `sourceTokens(text)` / `targetTokens(text)`: canonical sequences.
- `sourceBreaks(text)` / `targetBreaks(text)`: independent editorial boundaries.
- `setPinyin(id, value)`: annotation only.
- `lockText()`: prohibit unsafe retokenization.
- `split(zone, text, afterIndex, scope)`: add boundary after an index.
- `merge(zone, text, boundary, scope)`: remove a boundary.
- `animating`: whether the line-edit animation is in progress.

Alignment receives the narrower `TokenAccess` surface without animation methods.
Store tests exercise identity, independent lineation, canonical whitespace and
pinyin preservation.

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
	provenanceEl: HTMLElement | null; // the provenance textarea
};
```

The provenance ref (`provenanceEl`) is **passed in**, not discovered: the workbench owns the
layout, so the store reads only what its scope hands it rather than walking the DOM up
from a panel to find `#provenance`. See [`CONTEXT.md`](../CONTEXT.md) ("edit scope").

`animate(zone, scope, mutate)` runs one Flip over the whole vertical layout — no manual
height locking, measuring, or tweening:

1. Capture the edited panel's tokens (`[data-flip-id]` inside its scroll box) and the
   other wrapper's height, then `Flip.getState(...)` over the flip targets: **both panel
   wrappers + the provenance field + the edited tokens**. Capturing the _layout boxes_
   (not just the tokens) is what lets the panel boundary animate from its pre-edit
   position instead of snapping there on the first frame.
2. Set `animating = true` (gates the panel's height `$effect`), run `mutate()`
   (break-array update), `await tick()`, then force one synchronous reflow
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

`Flip.getState` _includes_ the other (non-edited) wrapper and the provenance field, but
they are not meant to carry an independent transform — they should ride the flow as the
edited wrapper's height changes. Because `absolute: false` reverts the layout to "before"
when `Flip.from` starts, any transform Flip computed for them (from the full before→after
delta) lands on an element already at its before-flow position and **double-counts** the
displacement. So immediately after `Flip.from` the store clears those transforms:

```js
if (scope.provenanceEl) gsap.set(scope.provenanceEl, { clearProps: 'transform' });
if (otherWrapper && !otherHeightChanged) gsap.set(otherWrapper, { clearProps: 'transform' });
```

Provenance is always cleared (it has no height of its own — it only moves with the stack
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
