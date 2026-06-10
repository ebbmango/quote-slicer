# Plan: Strip `colorIndex` from QuoteExport JSON

## What

Remove `colorIndex` from each `Mapping` in the exported JSON
(`exportData` / `exportJson` in [link.svelte.ts](../../src/lib/context/link.svelte.ts)).
`colorIndex` stays internal to quote-slicer's `Mapping` type — only the
*export* shape drops it.

## Why

`colorIndex` is a quote-slicer display detail (which color from
[colors.ts](../../src/lib/constants/colors.ts) to render a mapping in).
The external consumer of `QuoteExport` JSON has no use for it. On future
import, quote-slicer can re-derive colors itself by cycling through the
color wheel (applesour → ... → beeswax) in mapping order.

## Where

- [tokenState.ts:6-25](../../src/lib/tokenState.ts) — `Mapping` type (internal,
  keeps `colorIndex`) and `QuoteExport` type (export shape, needs new
  mapping type without `colorIndex`).
- [link.svelte.ts:40-47](../../src/lib/context/link.svelte.ts) — `exportData`
  derived, currently spreads `this.mappings` (incl. `colorIndex`) directly
  into `mappings`.

## How

1. In `tokenState.ts`, add an export-only type, e.g.:

   ```ts
   export type ExportMapping = Omit<Mapping, 'colorIndex'>;
   ```

   Update `QuoteExport.mappings` to `ExportMapping[]`.

2. In `link.svelte.ts`, change `exportData.mappings` from
   `this.mappings` to a mapped array stripping `colorIndex`:

   ```ts
   mappings: this.mappings.map(({ colorIndex, ...rest }) => rest),
   ```

3. No changes to `Mapping`, `nextColorIndex`, `MAPPING_COLORS`, or any
   color-derivation logic (`deriveSourceTokenState`,
   `deriveTargetTokenState`) — those stay as-is, internal only.

## Out of scope (future work)

- Import/restore of `QuoteExport` JSON — when built, assign `colorIndex`
  by cycling `MAPPING_COLORS` (applesour → beeswax → wraps) over
  `mappings` in array order, same pattern as `nextColorIndex++` in
  `link.svelte.ts:98`.

## Verification

- `npx tsc --noEmit`
- Manually check sidebar JSON in dev (`npm run dev`) — mappings should
  show `id`, `sourceTokenIds`, `targetTokenIds`, `pinyin`, no `colorIndex`.
