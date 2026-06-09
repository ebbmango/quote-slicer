# LinkContext: MappingView and Interface Narrowing

> Commits: `6203692`  
> Date: 2026-06-09

## Overview

`LinkContext` was narrowed so that callers never touch its raw token arrays directly. The main addition is `MappingView` — a pre-resolved snapshot of a mapping's display data — which replaced the `Mapping` prop in `Mapping.svelte`. This is a direct follow-on to the token state extraction in `820d3db`; together the two commits complete the interface discipline on `LinkContext`.

## Motivation

Before this change, `Mapping.svelte` crossed into `LinkContext`'s internals in two places:

- `link.sourceTokens[srcIdx].text` — to display the hanzi character for each mapped source token
- `link.targetTokens` — passed as a local variable into `buildTargetText()`, which assembled the translation preview in the card's bottom bar

`QuoteWorkbench.svelte` also read `link.sourceTokens` and `link.targetTokens` directly to find the first unmapped word token for keyboard navigation.

The problem isn't that these were wrong reads — the data was there. The problem is that three callers had to understand the token array structure to do their jobs. Any change to how tokens are stored (shape, indexing, line structure) would silently break all of them.

## Architecture

`LinkContext` now exposes token data only through methods and a derived property:

- `sortedMappingViews: MappingView[]` — replaces `sortedMappings` as the external list surface. `+page.svelte` iterates this to render the sidebar.
- `getMappingView(id): MappingView` — on-demand lookup for callers that hold a mapping ID.
- `setSourceTokens / setTargetTokens` — explicit setters replace direct field assignment from `QuoteWorkbench`.
- `setActive / setPinyin` — replace direct mutation of `activeMappingId` and `mapping.pinyin[i]` from `Mapping.svelte`.
- `findDefaultTokenIndex(zone)` — hides the first-unmapped-word scan that `QuoteWorkbench` was doing by reading raw arrays.

`MappingView` is a plain object type:

```ts
type MappingView = {
  id: MappingId;
  colorIndex: number;
  sourceEntries: { tokenIndex: number; text: string; pinyin: string }[];
  targetText: string;
};
```

`Mapping.svelte` receives a `MappingView` prop and still calls `getLinkContext()` for mutations (`deleteById`, `deselect`, `setActive`, `setPinyin`), but never reads token arrays through the context.

## Design Decisions

**`buildTargetText` moved into `LinkContext`.** It was previously a private function in `Mapping.svelte` that needed `link.targetTokens` to work. The right place for logic that requires token arrays is inside the module that owns those arrays. It's now `private buildTargetText(m: Mapping)` called from `buildMappingView`.

**`isActive` is not in `MappingView`.** If it were, `sortedMappingViews` would recompute on every selection change — every click would rebuild the entire mapping list. Instead, `Mapping.svelte` derives `isActive` locally from `link.activeMappingId`, which is still public and scalar. Only the display data (text, pinyin, color index) is pre-resolved in the view.

**`tokenIndex` is kept in `sourceEntries`.** Each entry carries the original token array index as a stable identity value. This is used as the `{#each}` key in `Mapping.svelte`, preserving Svelte's ability to reconcile DOM nodes correctly across reactivity cycles even when the entry list changes.

**`sortedMappings` made private.** It was previously public but only used internally to derive `sortedMappingViews`. With `sortedMappingViews` as the external surface, the raw sorted mapping array has no reason to be visible.

## Areas to Be Careful

`MappingView` is a snapshot — it captures the state of `sourceTokens` and `targetTokens` at derivation time. `sortedMappingViews` is a `$derived` that recomputes when `mappings`, `sourceTokens`, or `targetTokens` changes, so it stays current. But any code path that calls `getMappingView(id)` imperatively (rather than reading from `sortedMappingViews`) will get a snapshot at call time. This is fine for the current usage but matters if views are ever cached or passed to async callbacks.

`setPinyin(id, position, value)` takes a position index within `sourceIndices`, not a token index. Position `0` means the first source token in that mapping, not token index `0`. This is consistent with how `sourceEntries` is ordered in the view, but the parameter name could mislead.
