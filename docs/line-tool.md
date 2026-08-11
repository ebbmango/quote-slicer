# Line Tool

Line tool (`tool.current === 'line'`) lets the user adjust where line breaks fall in
the source and target texts **independently**. A line edit never changes the raw text
strings — it only rewrites the tokens' `.line` fields, and those edits are preserved by
the token store's [text-keyed cache](token-store.md#the-text-keyed-cache).

## The core functions

All three live in `src/lib/line.ts` as pure generics over `T extends { line: number }`,
so they work on both `SourceToken` and `TargetToken` and are unit-tested directly in
`line.spec.ts` (immutability, line math, and `splitAfterToken`'s documented
precondition that `afterIndex` be in range — out of range throws).

### `splitAfterToken(tokens, afterIndex)`

Inserts a line break _after_ `tokens[afterIndex]`. Returns a new array (no mutation):

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

## The line-tool affordances

The source and target panels expose split/merge differently, because their token
streams differ (source has no whitespace tokens; target does). Both render the same
module — **`LineDivisor`** — for the affordance itself: it owns the three divisor
surfaces (`.split-zone` / `.ws-split` / `.merge-zone`), the touch first-tap/second-tap
state machine, the mouse/keyboard hover-spread wiring (`redistributeRow`), the
instant-clear that precedes a Flip, and all the divisor CSS. The panels only choose
_which_ divisor goes _where_ (from their own token stream) and pass down the resolved
palette colour, the panel-specific `SPREAD` tuning, the row container, and the
`onActivate` edit. So a change to divisor behaviour lands in one place, not two.

### Source panel (`InteractiveSourceText`)

A zero-width `<button>` is rendered **between groups** (not between every token pair) —
where a group is a base character plus its glued punctuation, from
[`groupSourceTokens`](tokenization.md#source-punctuation-grouping):

- **same line** → a `.split-zone` button; clicking it calls `onSplit(globalIndex)`.
- **line boundary** (the next group is on a different line) → a `.merge-zone` button;
  clicking it calls `onMerge(token.line)`.

Each carries a hairline indicator (`.split-indicator` / `.merge-indicator`) that
appears on hover/focus.

**A group is unsplittable.** There are no divisors _inside_ a `.tok-group`, so a line
break can fall before or after a base+punctuation group but never between a character
and its mark — which would orphan `，` or `。` at the start of a line, typographically
wrong for CJK. (This replaced a fuller, dropped design where punctuation was instead
click-to-exclude from the export; see [Future Features](future-features.md).)

### Target panel (`InteractiveTargetText`)

The target panel reuses its **whitespace tokens** as the interaction surface:

- **interior whitespace** → a `<span role="button" class="ws-split">`. Using a span
  (not a `<button>`) with `user-select: text` keeps the space copyable when selecting
  target text; the split click is wired via `onclick` + `role="button"`.
- **boundary whitespace** (the synthetic token appended between lines during
  tokenization) → a full-width `.merge-zone` button; clicking it merges the two lines.

> Earlier there were _two_ overlapping merge affordances on the target boundary (a
> `.ws-boundary` text button plus a `.merge-zone`). The redundant `.ws-boundary` was
> removed; the boundary token now renders as a single `.merge-zone` button.

These callbacks bubble up to `QuoteWorkbench`, which forwards them into the token store:

```ts
function splitSource(afterIndex) {
	store.split('source', sourceText, sourceTokens, afterIndex, editScope());
}
function mergeSource(lineN) {
	store.merge('source', sourceText, sourceTokens, lineN, editScope());
}
// …and splitTarget / mergeTarget for the target zone.
```

Because the rendered `sourceTokens`/`targetTokens` already carry pinyin from the
store's overlay, they are passed straight in — there is no special "live" array to fish
out (a past source of pinyin-loss bugs, now eliminated by the
[single-owner store](token-store.md#why-it-exists)).

### Touch: the two-tap model

On touch there is no hover, and split indicators are zero-width and invisible without
it — so a divisor's hit zone would be effectively unreachable. The substitute is a
two-tap model: the first tap "previews" a divisor (highlights it, and for split zones
calls `redistributeRow()` to spread the row open so it's tappable), the second tap on
the same one activates.

`QuoteWorkbench` owns a single `touchedDivisor: { panel, index } | null`, passed down so
only **one** divisor across both panels is lit at a time — tapping a target divisor
clears any source highlight automatically. `LineDivisor` runs the per-divisor first-tap/
second-tap branch (gated on `interactionMedium` being touch); mouse and keyboard skip the
staging step and activate immediately. An `$effect` collapses a leftover spread when the
highlight clears, but only while `!animating`, so it never fights the edit's Flip.

## The split/merge animation

The actual height tween + token reflow is owned by the token store, not these
components — it runs the single Flip of the
[line-edit animation](token-store.md#the-line-edit-animation-splitmerge) over the edit
scope. The panel components contribute three things to make that work:

1. **An index-keyed `{#each tokens (i)}` loop.** Keying by index (not token identity)
   keeps every span element _alive_ across a mutation, so Flip can match old positions
   to new ones. Each span carries a `data-flip-id`.
2. **A `data-scrollbox` marker** on the panel's overflow container, so the store can
   find the box whose height it must tween.
3. **An `animating`-gated height `$effect`.** The store passes `store.animating` down
   as a prop. While it's `true`, the panel leaves the scroll box's height alone (the
   store owns it). While it's `false`, the panel keeps the box at `height: auto` so it
   follows content in flow — including the tool-change separator transitions described
   in [Tool Transitions](tool-transitions.md).

Because the workbench centres its three stacked panels, a height change in one panel
shifts the others too — which is why the _other_ panel's wrapper and the provenance
field are also flip targets, repositioned as whole units.

## Keyboard scheme (line tool)

Same `createTokenGridNav()` instance as link tool, reconfigured per tool (see
[Keyboard & Navigation](mediums-and-keyboard-navigation.md)). Here the navigable elements are the
split/merge controls — the selector is `LINE_ITEM_SELECTOR` (`.split-zone, .merge-zone,
.ws-split`), all focusable.

| Shortcut                    | Action                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------- |
| Alt+↑ / Alt+↓               | Focus the split/merge control on the visual row above/below; at a panel edge, jump to the other zone |
| Alt+← / Alt+→               | Focus the prev/next control in DOM order                                                             |
| Alt+Enter                   | Toggle focus between the source and target panels                                                    |
| Alt+Space / Alt+Shift+Space | Activate the focused control (calls its `click` → `handleSplit`/`handleMerge`)                       |
| Escape                      | Blur the focused control                                                                             |

Cross-zone jumps (Alt+Enter and edge Alt+↑/↓) work in **every** tool — the old
`crossZoneJump` config flag that restricted them to link tool was removed. Activating a
divisor re-renders it away (the edit replaces it), so the navigator re-acquires focus by
index afterward — see
[Keyboard & Navigation](mediums-and-keyboard-navigation.md#restoring-focus-after-a-line-edit).
