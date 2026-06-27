# Link Mode

Link mode (`mode.current === 'link'`) is where the user draws the alignment — clicking
source characters and target words to bind them into colored mappings. All of the
state and logic lives in **`Alignment`** (`src/lib/context/alignment.svelte.ts`).

## Alignment — the model

`Alignment` is a Svelte 5 class, instantiated once in `+page.svelte` via
`setAlignmentContext(tokenStore)` and read anywhere via `getAlignmentContext()`.

It is deliberately *not* the owner of the token arrays — the
[token store](token-store.md) is. `Alignment` takes the store (as a narrowed
`TokenAccess`) and **derives** its token views from it, keyed by the current text:

```ts
private sourceTokens = $derived.by(() => this.store.sourceTokens(this.meta.sourceText));
private targetTokens = $derived.by(() => this.store.targetTokens(this.meta.targetText));
```

So there is exactly one token owner; `Alignment` never holds a synced copy. What it
*does* own:

| State | Kind | Purpose |
|-------|------|---------|
| `mappings` | private `$state` | the full list of mappings |
| `activeMappingId` | public `$state` | the currently selected mapping (or `null`) |
| `meta` | private `$state` | `{ sourceText, targetText, authorship }`, pushed in by `QuoteWorkbench.setMeta()` |
| `nextColorIndex` | private `$state` | monotonic counter for assigning mapping colors |
| `listAnimating` | public `$state` | true while the mappings list is mid-animation; throttles mutations (see [Mappings List](mappings-list.md#the-listanimating-mutation-throttle)) |

And what it derives:

- `sourceIdToIndex` / `targetIdToIndex` — token ID → current array index.
- `sourceMappingIndex` / `targetMappingIndex` — array index → the owning `Mapping`,
  built by [`buildMappingIndex`](data-model.md#buildmappingindex).
- `sourceDisplayPinyin` — each source token's diacritic pinyin for display (see below).
- `sortedMappingViews` — the display snapshots ([MappingView](data-model.md#mappingview--the-display-snapshot)),
  sorted by each mapping's first source-token position.
- `exportData` — the [export shape](export.md).

`Alignment` also hosts the **view-mode** mapping highlight, delegated to an internal
`ViewHighlight` instance — see [View Mode](view-mode.md).

## The click state machine

Clicking a token routes to `toggleSource` or `toggleTarget`. Both first try a shared
`tryRemoveOrSwitch()` helper: if the token already belongs to a mapping, either remove
it (if that's the active mapping) or switch the active mapping to it (if it's another).

### `toggleSource(i, opts)`

`i` is the clicked token's current array index. `opts.force` is `true` when Cmd/Ctrl
is held (mouse), Alt+Shift+Space is pressed (keyboard), or on longpress (mobile).

| Token state | force | Action |
|-------------|-------|--------|
| Punctuation | any | **No-op** (guarded — can't anchor a mapping; the source stream has no whitespace tokens) |
| Belongs to active mapping | any | Remove from mapping; clear its pinyin; prune if empty |
| Belongs to another mapping | any | Switch active mapping to that one |
| Unmapped; active mapping exists, has no source yet | any | Append to active mapping |
| Unmapped; active mapping exists, already has a source | `false` | Create a **new** mapping for this token |
| Unmapped; active mapping exists, already has a source | `true` | Append to active mapping (force-add) |
| Unmapped; no active mapping | any | Create a new mapping for this token |

On any add, pinyin is auto-filled (see below).

### `toggleTarget(i)`

| Token state | Action |
|-------------|--------|
| Whitespace or punctuation | **No-op** (guarded) |
| Belongs to active mapping | Remove from mapping; prune if empty |
| Belongs to another mapping | Switch active mapping |
| Unmapped; active mapping exists | Append to active mapping |
| Unmapped; no active mapping | Create a new mapping for this token |

Target tokens have no force/multi-add distinction — any non-whitespace, non-punctuation
target token can be freely added to the active mapping.

> Both toggles guard the un-mappable types so a stray click can't spawn an empty
> mapping: `toggleTarget` rejects `'whitespace'` and `'punctuation'`; `toggleSource`
> rejects `'punctuation'` (the source stream never contains whitespace).

## Mapping lifecycle

- **Create** — `createMapping()`: a fresh UUID, the next `colorIndex` from the
  monotonic counter, empty token-ID arrays.
- **Prune** — `pruneActive()`: deletes the active mapping if it has zero source *and*
  zero target tokens. Called after every removal, so emptying a mapping out cleans it up.
- **Deselect** — `deselect()`: `activeMappingId = null`, without deleting.
- **Delete** — `deleteById(id)` / `deleteActive()`: removes by ID; clears
  `activeMappingId` if it matches.

`colorIndex` comes from a counter that **never resets**. Color is therefore decoupled
from list position — deleting or reordering mappings can never reassign an existing
card's color.

## Pinyin auto-fill and canonical storage

Pinyin is **stored in canonical numbered form** (`"zhi1"`) and **displayed as
diacritics** (`"zhī"`). Storing the numbered form — the shape `pinyin-pro` emits with
`toneType: 'num'` — makes the stored/exported value system-agnostic: tone marks sit on
different vowels per syllable, so a numbered tone is far easier to convert to other
transliteration systems (Wade-Giles, Zhuyin) than a diacritic one. Diacritic is then
just one display option, derived on the way out.

When a source `'character'` token joins a mapping, `tokenPinyin()` calls `pinyin-pro`
with `toneType: 'num'` and writes the result via `this.store.setPinyin(tokenId, value)`
— into the token store's id-keyed [pinyin overlay](token-store.md#the-pinyin-overlay),
**not** onto the mapping.

- Only `'character'` tokens get pinyin; `tokenPinyin()` returns `''` for anything else.
- Removing a token from a mapping clears its pinyin (`setPinyin(tokenId, undefined)`).
- The user can override pinyin in the mapping card's input. `Mapping.svelte` uses the
  **`PinyinInput.svelte`** component, which holds a local edit buffer while focused (so
  typing `"zhi1"` isn't reformatted to `"zhī"` mid-keystroke) and commits on blur via
  `alignment.setPinyin(mappingId, position, value)`. `Alignment` is the single owner of
  canonicalization: it runs the raw text through `toCanonical()` (from `pinyinConvert.ts`)
  before writing to the store — the UI never canonicalizes.

`Alignment` derives `sourceDisplayPinyin` (each token's stored canonical pinyin mapped
to its diacritic form via `toDisplay()`), memoized separately from `sortedMappingViews`
so the conversion only re-runs when the tokens change, not on every mapping select.

> `pinyinConvert.ts` carries a 407-syllable table of valid toneless Mandarin syllables.
> It exists to tell toneless pinyin (`"zhi"` → gets a neutral tone) apart from free-text
> annotation notes (`"river"` → stored as-is), so unparseable input survives as a literal
> note rather than being mangled. Blank input clears the annotation to `undefined` (so
> export omits the field rather than storing `""`).

## Whitespace bridging

A whitespace target token can't be mapped, but it can *display* a mapping's color when
it sits between two tokens of the same mapping — so a multi-word phrase reads as one
continuous highlight instead of striped gaps.

`findBridgeMapping()` (an internal helper in `tokenState.ts`, called by
`deriveTargetTokenState`) scans left and right past consecutive whitespace tokens, finds
the nearest non-whitespace token on each side, and returns a `Mapping` only if **both**
sides resolve to the **same** mapping (compared by object identity). The bridged token
then renders `idle` or `active` depending on whether that mapping is the active one. See
[Tokenization](tokenization.md#whitespace-strategy) for the companion text-output
bridging in `buildTargetText()`.

## Keyboard scheme (link mode)

Token navigation is provided by the shared `createTokenGridNav()` instance (see
[Keyboard & Navigation](keyboard-navigation.md) for the mechanism). Tokens are removed
from the Tab order; you move between them with Alt+Arrow inside the token workspace.

| Shortcut | Action |
|----------|--------|
| Alt+↑ / Alt+↓ | Focus the token on the visual row above/below; wraps source↔target at the panel edges |
| Alt+← / Alt+→ | Focus the prev/next token in DOM order |
| Alt+Enter | Toggle focus between the source and target panels (remembers the last focused token per panel) |
| Alt+Space | Select/deselect the focused token (`toggleSource`/`toggleTarget`) |
| Alt+Shift+Space | Force-add the source token to the active mapping |
| Escape | Blur the focused token, then deselect the active mapping |
| Backspace / Delete | Delete the focused mapping card, or the active mapping if none is focused |

Backspace/Delete is a document-level handler (`initAlignmentShortcuts`), not part of
the grid nav — see [Keyboard & Navigation](keyboard-navigation.md#document-level-shortcuts).
