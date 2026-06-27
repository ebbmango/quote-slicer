# Data Model

This page defines the types that flow through the whole app. Everything else —
tokenization, link mode, the export — is built on these.

## Token types

Defined in `src/lib/tokenize.ts`. A **token** is the smallest selectable unit of
text.

```ts
type SourceToken = {
  id: number;   // stable across split/merge; assigned once as flat-array position
  text: string;
  line: number; // which line the token currently belongs to
  type: 'character' | 'punctuation' | 'number' | 'symbol';
  pinyin?: string | null; // undefined: character not yet annotated; null: not applicable
};

type TargetToken = {
  id: number;   // stable across split/merge; assigned once as flat-array position
  text: string;
  line: number;
  type: 'text' | 'hanzi' | 'punctuation' | 'whitespace';
};
```

Source tokens are individual Chinese characters (plus any punctuation/numbers that
slip through). Target tokens are words, punctuation runs, single Han characters, and
whitespace runs. How a string becomes these tokens is covered in
[Tokenization](tokenization.md).

### Why `pinyin` is `string | null | undefined`

The three states are meaningful and distinct:

- **`undefined`** — a Han character that has *not yet* been annotated (e.g. not in a
  mapping yet). The export prints this literally as `undefined` so an un-annotated
  character is visible rather than silently dropped (see [Export](export.md)).
- **`null`** — a token type that *can't* have pinyin (punctuation, numbers, symbols).
- **`string`** — the romanisation, auto-filled or user-edited.

Pinyin is not stored directly on the cached token. It lives in an id-keyed overlay in
the [token store](token-store.md) and is applied on read; the field above is what
consumers see after that overlay is applied.

## Mapping type

Defined in `src/lib/tokenState.ts`.

```ts
type MappingId = string; // crypto.randomUUID()

type Mapping = {
  id: MappingId;
  colorIndex: number;       // index into MAPPING_COLORS; assigned at creation, never changes
  sourceTokenIds: number[]; // stable token IDs, NOT array indices
  targetTokenIds: number[]; // stable token IDs, NOT array indices
};
```

A mapping stores **token IDs**, not array positions — this is what lets line edits
(which reshuffle the arrays) leave mappings untouched. See *Stable token IDs* below.

## Stable token IDs

`SourceToken.id` / `TargetToken.id` are assigned as the token's position in the flat
array at tokenization time, then **never change** (`tokenize.ts`,
`.map((t, id) => ({ ...t, id }))`).

The line-edit functions in `src/lib/line.ts` (`splitAfterToken`, `mergeLines`) only
ever mutate the `.line` field and spread tokens — they never insert or remove tokens.
So IDs survive split/merge intact, and a mapping's stored IDs keep pointing at the
same characters no matter how the lines are rearranged.

Because mappings hold IDs but rendering needs array indices, `Alignment` derives two
reverse maps at runtime:

- `sourceIdToIndex: Map<tokenId, arrayIndex>`
- `targetIdToIndex: Map<tokenId, arrayIndex>`

These are `$derived` and rebuild whenever the token arrays change. The
**index → mapping** lookups `sourceMappingIndex` / `targetMappingIndex` are built from
them in turn by `buildMappingIndex` (see [TokenState](#tokenstate--per-token-display-state)).
If a token ID is ever *not* found in the current array, it simply drops out of the
derived maps — no corruption, no error. This means a future feature that removes tokens
(e.g. editing the source text after linking) cannot leave dangling references inside a
mapping.

## TokenState — per-token display state

`TokenState` is what a token span needs in order to color itself. Returned by
`deriveSourceTokenState()` / `deriveTargetTokenState()` in `src/lib/tokenState.ts`:

```ts
type TokenState =
  | { kind: 'unmapped' }            // not in any mapping
  | { kind: 'idle';   color: string } // in a mapping, but that mapping isn't selected
  | { kind: 'active'; color: string }; // in the currently selected (active) mapping
```

Both derive functions take the per-token-index→`Mapping` map, the active mapping ID,
and a `mode: 'light' | 'dark'` (which selects the light/dark colour variant — see
[Dark Mode](dark-mode.md)). `deriveTargetTokenState` also takes the target token array
so it can apply [whitespace bridging](link-mode.md#whitespace-bridging).

### `buildMappingIndex`

The index those functions consume is built by `buildMappingIndex(mappings, idToIndex,
tokenIds)` — a pure function that returns `Map<number, Mapping>` (token array index →
the `Mapping` that claims it). It stores the **`Mapping` object**, not a `MappingId`
string: an earlier version stored the ID and made the derive functions do an O(n)
`mappings.find(...)` per token per render to resolve it. Storing the object eliminates
that scan and makes the index a first-class source of truth — whitespace bridging can
then compare `Mapping` references by identity (`left === right`), safe because the
builder stores exactly one object per mapping.

These functions are framework-free (no Svelte imports), so they're unit-testable —
see `tokenState.spec.ts`.

## MappingView — the display snapshot

`Mapping.svelte` must never touch raw `Mapping` state or the token arrays. Instead it
reads a **`MappingView`**: a derived, read-only snapshot built for display
(`src/lib/context/alignment.svelte.ts`).

```ts
type MappingView = {
  id: MappingId;
  colorIndex: number;
  sourceEntries: { tokenId: number; tokenIndex: number; text: string; pinyin: string }[];
  targetText: string;
};
```

- Each `sourceEntries` row carries both `tokenId` (the stable identity) and
  `tokenIndex` (the current array position). `tokenId` is the stable key used to look
  up display pinyin in the memoized `sourceDisplayPinyin` array; `tokenIndex` is what
  the card needs to address the live token.
- `sourceEntries[].pinyin` is the **diacritic display form** (`"zhī"`), converted from
  the token's stored canonical pinyin (`"zhi1"`) — see
  [Link Mode → Pinyin](link-mode.md#pinyin-auto-fill-and-canonical-storage). Pinyin
  lives on the token, not on the mapping.
- `targetText` is built by `buildTargetText()`, which stitches contiguous runs of the
  mapping's target tokens into phrases (bridging short whitespace/punctuation gaps of
  ≤ 5 tokens) and joins non-contiguous runs with `, `.

## Export types

Also in `src/lib/tokenState.ts` — the shape the app serialises to JSON (see
[Export](export.md)):

```ts
type QuoteExportMeta = {
  sourceText: string;
  targetText: string;
  authorship: string;
};

type ExportMapping = Omit<Mapping, 'colorIndex'>; // colorIndex is presentation-only

type QuoteExport = {
  meta: QuoteExportMeta;
  sourceTokens: SourceToken[];
  targetTokens: TargetToken[];
  mappings: ExportMapping[];
};
```

`colorIndex` is dropped from the export because color is a UI concern, not part of the
alignment data.

## Colors

The palette lives in `src/lib/constants/colors.ts`: `MAPPING_COLORS` is an array of 9
named palettes (`applesour`, `lush`, `seabreeze`, `azure`, `compostella`, `sugar`,
`strawberry`, `maple`, `beeswax`). Each entry is a `MappingColor`, a `{ light, dark }`
wrapper around two `MappingColorVariant`s. The **variant** is what holds the roles —
`source`/`target` (token text colours used by the interactive panels) plus a dozen
card colours (backdrop, badge, bottom bar, etc.) used by `Mapping.svelte`. The light/
dark split lives in the data because card colours are applied as inline `style`
attributes that a CSS `.dark` class can't reach (see [Dark Mode](dark-mode.md)).

A mapping's `colorIndex` indexes this array modulo its length, so the palette cycles
if more than 9 mappings exist. A parallel `colors` lookup (keyed by name) is exported
for code that wants a *specific* palette entry rather than the Nth — e.g.
`colors.azure.light.base`, used by the [export panel recolor](export.md). `colors.ts`
also exports `HIGHLIGHT_COLOR` (the flat [view-mode highlight](view-mode.md) red) and
`divisorColor(ordinal, field, mode)` (the [line-mode divisor](line-mode.md) palette
sweep).
