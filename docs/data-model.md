# Data Model

This page defines the types that flow through the whole app. Everything else —
tokenization, link tool, the export — is built on these.

## Token types

Defined in `src/lib/quotation.ts`, re-exported by `tokenize.ts`. A **token** is the smallest selectable unit of
text.

```ts
type SourceToken = {
	id: number; // opaque side-local identity; allocated monotonically
	text: string;
	type: 'character' | 'punctuation' | 'number' | 'symbol';
	pinyin?: string | null; // undefined: character not yet annotated; null: not applicable
};

type TargetToken = {
	id: number; // opaque side-local identity; allocated monotonically
	text: string;
	type: 'text' | 'hanzi' | 'punctuation' | 'whitespace';
};
```

Source tokens are individual Chinese characters (plus any punctuation/numbers that
slip through). Target tokens are words, punctuation runs, single Han characters, and
whitespace runs. How a string becomes these tokens is covered in
[Tokenization](tokenization.md).

### Why `pinyin` is `string | null | undefined`

The three states are meaningful and distinct:

- **`undefined`** — a Han character that has _not yet_ been annotated (e.g. not in a
  mapping yet). The export prints this literally as `undefined` so an un-annotated
  character is visible rather than silently dropped (see [Export](export.md)).
- **`null`** — a token type that _can't_ have pinyin (punctuation, numbers, symbols).
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
	colorIndex: number; // index into MAPPING_COLORS; assigned at creation, never changes
	sourceTokenIds: number[]; // stable token IDs, NOT array indices
	targetTokenIds: number[]; // stable token IDs, NOT array indices
};
```

A mapping stores **token IDs**, not array positions — this is what lets line edits
(which only update break arrays) leave mappings untouched. See _Stable token IDs_ below.

## Stable token IDs

Token IDs are unique within each side and independent of sequence indexes.
They may be non-contiguous and out of numeric order. The store allocates new IDs
monotonically; line edits never change them. Mapping creation freezes raw-text
retokenization. `tokenMutation.ts` provides explicit transformations for insert,
delete, replace, split and merge; ambiguous correspondence is rejected.

The renderer resolves IDs to indexes through `buildMappingIndex`. Its omission of
unresolved IDs is defensive rendering, not data validation: `validateQuotation`
rejects dangling references and overlapping membership.

## Editorial breaks

`alignment.breaks.attestation` and `alignment.breaks.translation` are sorted,
unique integer arrays. A boundary b is before index b; only 0 < b < tokenCount
is valid. Empty and one-token sequences require empty arrays. Adjacent boundaries
are allowed. Canonical reconstruction is the concatenation of token text,
including textual whitespace, without consulting breaks.

## TokenState — per-token display state

`TokenState` is what a token span needs in order to color itself. Returned by
`deriveSourceTokenState()` / `deriveTargetTokenState()` in `src/lib/tokenState.ts`:

```ts
type TokenState =
	| { kind: 'unmapped' } // not in any mapping
	| { kind: 'idle'; color: string } // in a mapping, but that mapping isn't selected
	| { kind: 'active'; color: string }; // in the currently selected (active) mapping
```

Both derive functions take the per-token-index→`Mapping` map, the active mapping ID,
and a `themeName: 'light' | 'dark'` (which selects the light/dark colour variant — see
[Themes](themes.md)). `deriveTargetTokenState` also takes the target token array
so it can apply [whitespace bridging](link-tool.md#whitespace-bridging).

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
  [Link Tool → Pinyin](link-tool.md#pinyin-auto-fill-and-canonical-storage). Pinyin
  lives on the token, not on the mapping.
- `targetText` is built by `buildTargetText()`, which stitches contiguous runs of the
  mapping's target tokens into phrases and joins non-contiguous runs with `, `. Two
  selected tokens whose indices are at most `MAX_BRIDGE_GAP = 5` apart (a named
  constant in `tokenState.ts`), with only whitespace/punctuation between them, join
  into one run instead of being comma-separated.

## Export types

The authoritative `AttestationTranslationAlignment` is defined in
`src/lib/quotation.ts`. `QuoteExport` aliases it:

```ts
{
  attestation: { tokens: SourceToken[] },
  translation: { tokens: TargetToken[] },
  alignment: {
    mappings: QuoteMapping[],
    breaks: { attestation: number[], translation: number[] }
  }
}
```

Draft `QuoteExportMeta` holds input strings and provenance, separately from the
exported alignment. Provenance is displayed separately for Verbarium's existing
prop; source URL remains lesson-owned. `colorIndex` is never exported.

## Colors

The palette lives in `src/lib/constants/colors.ts`: `MAPPING_COLORS` is an array of 9
named palettes (`applesour`, `lush`, `seabreeze`, `azure`, `compostella`, `sugar`,
`strawberry`, `maple`, `beeswax`). Each entry is a `MappingColor`, a `{ light, dark }`
wrapper around two `MappingColorVariant`s. The **variant** is what holds the roles —
`source`/`target` (token text colours used by the interactive panels) plus a dozen
card colours (backdrop, badge, bottom bar, etc.) used by `Mapping.svelte`. The light/
dark split lives in the data because card colours are applied as inline `style`
attributes that a CSS `.dark` class can't reach (see [Themes](themes.md)).

A mapping's `colorIndex` indexes this array modulo its length, so the palette cycles
if more than 9 mappings exist. A parallel `colors` lookup (keyed by name) is exported
for code that wants a _specific_ palette entry rather than the Nth — e.g.
`colors.azure.light.base`, used by the [export panel recolor](export.md). `colors.ts`
also exports `HIGHLIGHT_COLOR` (the flat [view-tool highlight](view-tool.md) red) and
`divisorColor(ordinal, field, themeName)` (the [line-tool divisor](line-tool.md) palette
sweep).
