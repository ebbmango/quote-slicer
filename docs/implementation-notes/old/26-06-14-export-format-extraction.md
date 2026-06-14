# Export formatter extraction: formatExport() in exportFormat.ts

> Commits: `1cec1e0`
> Date: 2026-06-14

## Overview

The JSON pretty-printer used by the export panel — previously an ~80-line closure inline in
`+page.svelte` with no test coverage — is extracted to `src/lib/exportFormat.ts` as
`formatExport(data: QuoteExport): string`, with a new `exportFormat.spec.ts` covering its
column-alignment and edge-case behavior.

## Motivation

The formatter has non-trivial, easy-to-regress behavior (see Implementation Details) but lived
as a closure with no unit-test surface. Extracting it as a standalone function with no
component dependencies makes it directly testable.

## Implementation Details

`formatExport` is `formatJson(data)`, a recursive pretty-printer that differs from
`JSON.stringify(v, null, 2)` in two ways:

- **Arrays of primitives stay on one line** — e.g. `"sourceTokenIds": [0, 1]` instead of one
  element per line, so id-list arrays don't dominate the output.
- **Arrays of token objects render as a column-aligned table** — `isTokenObject()` recognizes an
  object as a token if it has `id`, `text`, `line`, `type` keys (all primitive-valued).
  `formatTokenBody()` then pads each field (`id`, `text`, `pinyin`, `line`, `type` — minus
  `pinyin` if no token in the array has it) to the widest value across the array, so the same
  field starts at the same column on every row.

`formatValue()` renders `undefined` as the literal string `undefined` (not valid JSON, but used
deliberately so unannotated `pinyin` is visible in the export rather than silently dropped).

## Design Decisions

- The four new spec cases lock in: primitive-array one-lining, literal `undefined` for missing
  pinyin, column alignment across token rows, and omitting the `pinyin` column entirely when no
  token in an array carries it (e.g. `targetTokens`, which never have pinyin).
- No behavioral change from the inline version — this is a pure extraction, gaining a test
  surface without altering output.
