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

And what it derives:

- `sourceIdToIndex` / `targetIdToIndex` — token ID → current array index.
- `sourceMappingIndex` / `targetMappingIndex` — array index → owning mapping ID.
- `sortedMappingViews` — the display snapshots ([MappingView](data-model.md#mappingview--the-display-snapshot)),
  sorted by each mapping's first source-token position.
- `exportData` — the [export shape](export.md).

## The click state machine

Clicking a token routes to `toggleSource` or `toggleTarget`. Both first try a shared
`tryRemoveOrSwitch()` helper: if the token already belongs to a mapping, either remove
it (if that's the active mapping) or switch the active mapping to it (if it's another).

### `toggleSource(i, opts)`

`i` is the clicked token's current array index. `opts.force` is `true` when Cmd/Ctrl
is held (mouse), Alt+Shift+Space is pressed (keyboard), or on longpress (mobile).

| Token state | force | Action |
|-------------|-------|--------|
| Whitespace or punctuation | any | **No-op** (guarded — can't start a mapping from these) |
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

> Both toggles guard `type === 'whitespace' || type === 'punctuation'` so a stray click
> on a space or a comma can't spawn an empty mapping.

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

## Pinyin auto-fill

When a source `'character'` token joins a mapping, `tokenPinyin()` calls `pinyin-pro`
with `toneType: 'symbol'` (tone marks, not numbers) and `separator: ' '`. The result
is written via `this.store.setPinyin(tokenId, value)` — into the token store's id-keyed
[pinyin overlay](token-store.md#the-pinyin-overlay), **not** onto the mapping.

- Only `'character'` tokens get pinyin; `tokenPinyin()` returns `''` for anything else.
- Removing a token from a mapping clears its pinyin (`setPinyin(tokenId, undefined)`).
- The user can override pinyin in the mapping card's input; `Mapping.svelte` calls
  `alignment.setPinyin(mappingId, position, value)`, which resolves the source token at
  that position and writes the override through the same store path.

## Whitespace bridging

A whitespace target token can't be mapped, but it can *display* a mapping's color when
it sits between two tokens of the same mapping — so a multi-word phrase reads as one
continuous highlight instead of striped gaps.

`findBridgeMappingId()` (`tokenState.ts`) scans left and right past consecutive
whitespace tokens, finds the nearest non-whitespace token on each side, and returns a
mapping ID only if **both** sides resolve to the same mapping. The bridged token then
renders `idle` or `active` depending on whether that mapping is the active one. See
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
