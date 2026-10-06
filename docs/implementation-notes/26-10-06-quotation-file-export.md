# Quotation file export

**Date:** 2026-10-06 · **Issue:** [#19](https://github.com/ebbmango/quote-slicer/issues/19)

Verbarium now commits each quotation as a strict JSON **quotation file**
(`docs/quotation-contract.md` there, format version 1). The export panel shows
that file instead of the TypeScript-flavoured preview, and copies or downloads
it.

- `src/lib/quotationFile.ts`: `buildQuotationFile()` adds `formatVersion: 1`,
  the trimmed provenance and an optional `sourceLink`, and drops `pinyin` keys
  whose value is `undefined` (JSON has no `undefined`; `null` stays for not
  applicable). `formatQuotationFile()` writes Verbarium's committed layout byte
  for byte; the spec pins it to the contract's own example.
- `JsonExportPanel.svelte`: Copy and Download buttons, a note while the
  provenance is empty (Verbarium rejects a file without one), no separate
  provenance line.
- `exportFormat.ts` and its spec are gone; the `undefined` recolour entry with
  them.
- `quotation-contract.e2e.ts` parses the panel as JSON and checks
  `formatVersion` and `provenance` in the file.

Why: Verbarium's build validates every committed file, so what the panel
shows must be exactly what gets committed, and a file with a literal
`undefined` is not JSON.
