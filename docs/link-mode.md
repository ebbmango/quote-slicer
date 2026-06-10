# Link Mode

Link mode (`mode.current === 'link'`) is where users draw word-to-word alignments. The state machine lives in `Alignment` (`src/lib/context/alignment.svelte.ts`).

## Alignment

`Alignment` is a Svelte 5 class instantiated once in `+page.svelte` via `setAlignmentContext()` and accessed anywhere in the tree via `getAlignmentContext()`. It owns:

- `mappings: Mapping[]` — the full list of mappings (private `$state`)
- `activeMappingId: MappingId | null` — the currently selected mapping (`$state`, public)
- `sourceTokens` / `targetTokens` — shadow copies of the token arrays, set by `QuoteWorkbench` via `$effect` on every token change
- `sourceIdToIndex` / `targetIdToIndex` — `$derived` maps from token ID to current array index
- `sourceMappingIndex` / `targetMappingIndex` — `$derived` maps from array index to mapping ID, rebuilt from the ID maps on every token or mapping update
- `sortedMappingViews: MappingView[]` — `$derived` array of display snapshots sorted by first source token position

## Click state machine

### `toggleSource(i, opts)`

`i` is the current array index of the clicked source token. `opts.force` is `true` when Cmd/Ctrl is held (mouse), Alt+Shift+Space is pressed (keyboard), or on longpress (mobile). See `alignment.svelte.ts:191`.

| Token state | force | Action |
|---|---|---|
| Belongs to active mapping | any | Remove token from mapping; prune if empty |
| Belongs to another mapping | any | Switch active mapping to that one |
| No mapping; active mapping exists; active has no sources yet | any | Append to active mapping |
| No mapping; active mapping exists; active already has a source | false | Create new mapping for this token |
| No mapping; active mapping exists; active already has a source | true | Append to active mapping (force-add) |
| No mapping; no active mapping | any | Create new mapping for this token |

The "belongs to active mapping" and "belongs to another mapping" rows are handled by a shared `tryRemoveOrSwitch()` helper (`alignment.svelte.ts:177`), also used by `toggleTarget`.

Punctuation source tokens are excluded from interaction (no `role="option"` in the DOM, no click handler).

### `toggleTarget(i)`

`i` is the current array index of the clicked target token. See `alignment.svelte.ts:209`.

| Token state | Action |
|---|---|
| Whitespace token | No-op |
| Belongs to active mapping | Remove token; prune if empty |
| Belongs to another mapping | Switch active mapping |
| No mapping; active mapping exists | Append to active mapping |
| No mapping; no active mapping | Create new mapping for this token |

Target tokens have no force/multi-add path — any non-whitespace target token can be freely added to the active mapping.

## Mapping lifecycle

- **Create** — `createMapping()` (`alignment.svelte.ts:95`): UUID, next `colorIndex` from a monotonic counter, empty token ID arrays
- **Prune** — `pruneActive()` (`alignment.svelte.ts:109`): deletes the active mapping if it has zero source + zero target tokens; called after every removal
- **Deselect** — `deselect()`: sets `activeMappingId = null` without deleting
- **Delete** — `deleteById(id)` or `deleteActive()`: removes by ID; clears `activeMappingId` if it matches

`colorIndex` is assigned at creation from a counter that never resets — it is decoupled from list position so reordering or deletion cannot reassign colors to existing cards.

## Pinyin auto-fill

When a source token is added to a mapping, `tokenPinyin()` (`alignment.svelte.ts:24`) calls `pinyin-pro` to generate the initial romanisation. It uses `toneType: 'symbol'` (tone marks, not numbers) and `separator: ' '`. The result is written to `SourceToken.pinyin` via `setSourceTokenPinyin()` (`alignment.svelte.ts:104`), keyed by token ID — not stored on `Mapping`. Users can override it in the mapping card's pinyin input (`setPinyin()`, which resolves the mapping's source token at `position` and updates that token's `pinyin`).

When a source token is removed from a mapping, its `pinyin` field is cleared back to `undefined`.

Only `'character'` type source tokens get pinyin — punctuation, numbers, and symbols are never assigned one (`MappingView.sourceEntries[].pinyin` falls back to `''`).

## Whitespace bridging

A whitespace target token is not mappable but can display a color if both its nearest non-whitespace neighbors belong to the same mapping. `findBridgeMappingId()` (`tokenState.ts:35`) scans left and right past consecutive whitespace tokens, finds the nearest non-whitespace token on each side, and returns the mapping ID only if both sides resolve to the same mapping.

The bridged token renders as `idle` or `active` depending on whether its neighbor mapping is the active one.

## Keyboard scheme (link mode)

Implemented in `QuoteWorkbench.svelte`. Tokens are removed from the Tab order; navigation is via Alt+Arrow within the token workspace.

| Shortcut | Action |
|---|---|
| Alt+↑ / Alt+↓ | Move focus to visual row above/below; wraps from source bottom to target, and target top to source |
| Alt+← / Alt+→ | Move focus to prev/next token in DOM order |
| Alt+Enter | Toggle focus between source and target panels (remembers last focused token per panel) |
| Alt+Space | Select/deselect token (calls `toggleSource` or `toggleTarget`) |
| Alt+Shift+Space | Force-add source token to current mapping |
| Escape | Deselect active mapping |
| Backspace / Delete | Delete focused mapping card (or active mapping if no card focused) |
