# Line Mode

Line mode (`mode.current === 'line'`) lets the user adjust where line breaks fall in
the source and target texts **independently**. A line edit never changes the raw text
strings — it only rewrites the tokens' `.line` fields, and those edits are preserved by
the token store's [text-keyed cache](token-store.md#the-text-keyed-cache).

## The core functions

All three live in `src/lib/line.ts` as pure generics over `T extends { line: number }`,
so they work on both `SourceToken` and `TargetToken` and are trivially testable.

### `splitAfterToken(tokens, afterIndex)`

Inserts a line break *after* `tokens[afterIndex]`. Returns a new array (no mutation):

- tokens on lines **above** `splitLine` → unchanged;
- tokens at/before `afterIndex` on `splitLine` → unchanged;
- tokens **after** `afterIndex` on `splitLine` → `line = splitLine + 1` (the new line);
- tokens on lines **below** `splitLine` → `line + 1` (shift down to make room).

### `mergeLines(tokens, lineN)`

Merges line `lineN + 1` up into line `lineN`. Returns a new array:

- tokens on `lineN + 1` → `line = lineN`;
- tokens on lines below that → `line - 1` (close the gap);
- everything else → unchanged.

Neither function adds or removes tokens, so **token IDs are invariant** across line
edits — this is the whole reason mappings (which store IDs) survive them. See
[Data Model](data-model.md#stable-token-ids).

### `groupByLine(tokens)`

Buckets a flat token array by line, preserving each token's original flat-array index
as `globalIndex`:

```ts
{ lineNum: number; group: { token: T; globalIndex: number }[] }[]
```

A utility for any consumer that needs to render or reason about lines as units.

## The line-tool affordances

The source and target panels expose split/merge differently, because their token
streams differ (source has no whitespace tokens; target does).

### Source panel (`InteractiveSourceText`)

Between every pair of adjacent tokens, a zero-width `<button>` is rendered:

- **same line** → a `.split-zone` button; clicking it calls `onSplit(globalIndex)`.
- **line boundary** (the next token is on a different line) → a `.merge-zone` button;
  clicking it calls `onMerge(token.line)`.

Each carries a hairline indicator (`.split-indicator` / `.merge-indicator`) that
appears on hover/focus.

### Target panel (`InteractiveTargetText`)

The target panel reuses its **whitespace tokens** as the interaction surface:

- **interior whitespace** → a `<span role="button" class="ws-split">`. Using a span
  (not a `<button>`) with `user-select: text` keeps the space copyable when selecting
  target text; the split click is wired via `onclick` + `role="button"`.
- **boundary whitespace** (the synthetic token appended between lines during
  tokenization) → a full-width `.merge-zone` button; clicking it merges the two lines.

> Earlier there were *two* overlapping merge affordances on the target boundary (a
> `.ws-boundary` text button plus a `.merge-zone`). The redundant `.ws-boundary` was
> removed; the boundary token now renders as a single `.merge-zone` button.

These callbacks bubble up to `QuoteWorkbench`, which forwards them into the token store:

```ts
function splitSource(afterIndex) { store.split('source', sourceText, sourceTokens, afterIndex, editScope()); }
function mergeSource(lineN)      { store.merge('source', sourceText, sourceTokens, lineN, editScope()); }
// …and splitTarget / mergeTarget for the target zone.
```

Because the rendered `sourceTokens`/`targetTokens` already carry pinyin from the
store's overlay, they are passed straight in — there is no special "live" array to fish
out (a past source of pinyin-loss bugs, now eliminated by the
[single-owner store](token-store.md#why-it-exists)).

## The split/merge animation

The actual height tween + token reflow is owned by the token store, not these
components — it runs **one unified Flip** over the
[edit scope](token-store.md#the-unified-flip-splitmerge-animation). The panel
components contribute three things to make that work:

1. **An index-keyed `{#each tokens (i)}` loop.** Keying by index (not token identity)
   keeps every span element *alive* across a mutation, so Flip can match old positions
   to new ones. Each span carries a `data-flip-id`.
2. **A `data-scrollbox` marker** on the panel's overflow container, so the store can
   find the box whose height it must tween.
3. **An `animating`-gated height `$effect`.** The store passes `store.animating` down
   as a prop. While it's `true`, the panel leaves the scroll box's height alone (the
   store owns it). While it's `false`, the panel keeps the box at `height: auto` so it
   follows content in flow — including the mode-change separator transitions described
   in [Mode Transitions](mode-transitions.md).

Because the workbench centres its three stacked panels, a height change in one panel
shifts the others too — which is why the *other* panel's wrapper and the authorship
field are also flip targets, repositioned as whole units.

## Keyboard scheme (line mode)

Same `createTokenGridNav()` instance as link mode, reconfigured per mode (see
[Keyboard & Navigation](keyboard-navigation.md)). Here the navigable elements are the
split/merge controls — the selector is `.split-zone, .merge-zone, .ws-split,
.ws-boundary` — all focusable.

| Shortcut | Action |
|----------|--------|
| Alt+↑ / Alt+↓ | Focus the split/merge control on the visual row above/below |
| Alt+← / Alt+→ | Focus the prev/next control in DOM order |
| Alt+Space / Alt+Shift+Space | Activate the focused control (calls its `click` → `handleSplit`/`handleMerge`) |
| Escape | Blur the focused control |

Alt+Enter and the source↔target edge jump are **link-mode only** (`crossZoneJump` is
`false` in line mode), so at a panel edge Alt+↑/↓ simply does nothing.
