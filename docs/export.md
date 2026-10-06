# Export

The export panel shows the **quotation file** Verbarium commits for a quotation,
and copies or downloads it. The format is defined in Verbarium's
`docs/quotation-contract.md` (format version 1): one JSON object with
`formatVersion`, `provenance`, `sourceLink` (optional), `attestation`,
`translation` and `alignment`, where the last three are `Alignment.exportData`
unchanged: attestation tokens, translation tokens, ID-based mappings, and
independent break arrays. Token text is canonical; reconstruct by joining it in
sequence order. No textual normalization occurs during export. Mapping UI colors
are omitted.

`src/lib/quotationFile.ts` does the work:

- `buildQuotationFile(exportData, { provenance, sourceLink })` adds the format
  version, trims the provenance and the source link, leaves a blank source link
  out, and drops every `pinyin` key whose value is `undefined`. JSON has no `undefined`: an
  unannotated character simply has no `pinyin` key, and `null` stays for a token
  where pinyin does not apply (punctuation). The two states that used to be
  told apart by a literal `undefined` in a TypeScript preview are now told apart
  by the key's absence.
- `formatQuotationFile(file)` writes the layout Verbarium commits, byte for
  byte: two-space indentation, one token and one mapping per line, number
  arrays on one line, `id`, `text`, `pinyin`, `type` inside a token, a final
  newline. `quotationFile.spec.ts` pins it to the example in Verbarium's
  contract, so a downloaded file can be committed unchanged.

Provenance and the source link (the URL of the quotation's online witness,
typed into the field under the provenance) live inside the file; a blank source
link is simply left out. The panel's Copy and Download buttons wait, and the
panel says why, while Verbarium's build would reject the file: an empty
provenance, a source link that is not an `http`/`https` address, or a source or
translation text that starts or ends with whitespace (`quotationFileProblems`).

## Copy, download, check

The panel's **Copy** button puts the file text on the clipboard; **Download**
saves it as `quotation.json`. The author renames it to its Quote asset name
(`<Quote ID>-<slug>.json`, for example `L001I-Q01-blocked-breath.json`) when
committing it under `apps/web/app/content/quotes/` in Verbarium, where the
build validates every file. To check a file before committing, from the
Verbarium repository root:

```bash
pnpm --filter @verbarium/web validate-quotations /path/to/quotation.json
```

## Offline migration

Run `node tools/migrate-quotation.ts <quotation.json|quotation.ts> [...]` with Node 24.
The command parses literal data without executing source files, validates it, and
prints deterministic JavaScript data-literal quotation/metadata/report records
(not JSON, so explicit undefined and omitted properties remain distinct). Original files are never
overwritten. Review the report and canonical text comparison before accepting any
conversion. Content discrepancies and unrepresentable line assignments are reported,
not repaired. Runtime code does not import this converter.

## The panel — `JsonExportPanel` + `HighlightedCode`

`JsonExportPanel.svelte` derives `formatQuotationFile(buildQuotationFile(alignment.exportData, …))`
and feeds it to `HighlightedCode.svelte`, the generic Shiki-based highlighter.

### Recoloring Shiki to the app palette

By default the export would look like a generic code preview. To make it feel native,
`HighlightedCode` takes an optional `colorMap` prop — a flat `raw hex → app hex` lookup
applied **at render**, `style="color: {colorMap[token.color] ?? token.color}"`. The base
theme is **dracula** (chosen because its token colors are well-known hex values, easy to
target), and `JsonExportPanel` passes a map that swaps dracula's hexes for the app's
mapping palette. The map is **theme-aware** — `themeName = appTheme.current` selects the
light or dark variant — so the export tracks the app's [dark theme](themes.md):

| Role                           | dracula hex(es)                            | replaced with         |
| ------------------------------ | ------------------------------------------ | --------------------- |
| strings                        | `#f1fa8c`, `#e9f284`                       | `colors..base`        |
| properties / colons / brackets | `#8be9fe`, `#8be9fd`, `#ff79c6`, `#f8f8f2` | a dimmer neutral grey |
| numbers and `null`             | `#bd93f9`                                  | `colors..base`        |

This is why `colors.ts` exports the name-keyed [`colors` lookup](data-model.md#colors)
alongside the index-keyed array — the recolor wants _specific_ palette entries.

**Why a render-time map, not Shiki's `colorReplacements`.** The earlier design passed
`colorReplacements` into `codeToTokens()`, so a theme flip re-ran the (async) tokenizer
to bake new inline colours in. That made the JSON panel recolour a frame _late_ — it
snapped after the rest of the page had already started easing. Now tokenization depends
only on `code`/`lang`/`theme` (all theme-independent), so it runs **once**; the light↔dark
swap is just `colorMap` changing, which updates the inline `style` colours synchronously
in the same frame as everything else and rides the `theme-anim` colour transition (see
[dark theme → the `theme-anim` window](themes.md#the-htmltheme-anim-window)).
The lookup lower-cases `token.color` first — Shiki emits some theme hexes upper-cased, and
a case-sensitive miss would fall through to the raw dracula colour.

`JsonExportPanel` builds `colorMap` as a module-level `$derived` rather than an inline
object literal: Svelte 5 wraps an inline `ObjectExpression` in `$.derived()` and produces
a **new reference every render**, so passing an identifier keeps the prop stable across
unrelated alignment updates.

> **Fragility:** the replacement is literal hex-string matching against a fixed theme.
> If Shiki updates the dracula palette, or the base theme changes, these swaps silently
> stop matching and the export reverts to dracula's raw colors. Some roles list two hex
> variants because Shiki uses slightly different shades for different token types that
> read as the same color.

### Rendering details

`HighlightedCode` lazy-imports `shiki` inside an `$effect` and tokenizes on every
`code` change. The output is a `<pre>` with `width: max-content` so the box grows to the
longest line — important because the panel's horizontal padding must sit _past_ the
longest line, not behind it, when content overflows. The markup is kept on as few
source lines as possible (inside `<pre>`, every literal whitespace char would render).

For where the panel appears at each breakpoint (aside vs. modal), see
[UI Architecture](ui-architecture.md#responsive-layout).
