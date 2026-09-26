# Line Tool

The line tool edits independent attestation and translation boundary arrays.
A boundary is an interior token-sequence position, not a token ID. Splitting
after index i adds i+1; merging removes that boundary. Tokens, canonical text,
mappings and pinyin remain unchanged.

## The core functions

`src/lib/breaks.ts` validates sorted unique boundaries and implements immutable
`editBreak` and `replaceBreaks`. The store calls these helpers and owns animation.
`src/lib/tokenMutation.ts` handles count-changing edits with explicit identity
correspondence; those operations are domain utilities, not additional UI tools.

## The line-tool affordances

`LineDivisor.svelte` owns split-zone, whitespace and merge-zone controls, touch
staging, focus and animation wiring. Source controls appear between punctuation
groups. `groupSourceTokens(tokens, breaks)` respects imported boundaries even
when they separate punctuation from its usual base.

Target interior whitespace provides the split control. At a break after that
whitespace, the same token is visually replaced by a merge control; its text
remains in the canonical stream. A valid break after a non-whitespace token also
renders a merge control. Terminal whitespace is text, never a split control.

`QuoteWorkbench` calls `store.split(zone, text, afterIndex, scope)` or
`store.merge(zone, text, boundary, scope)`; neither accepts or rewrites tokens.

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
