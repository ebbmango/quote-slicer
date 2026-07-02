# Export

The right side of the app shows a **live JSON export** of the alignment — the same data
structure the app is built to produce, rendered as syntax-highlighted, column-aligned
JSON. It updates as the user works. Three pieces make it: the export _data_, the
_formatter_, and the _panel_.

## The export data

`Alignment.exportData` is a `$derived` [`QuoteExport`](data-model.md#export-types):

```ts
{
  meta:        { sourceText, targetText, authorship },  // sanitised
  sourceTokens, targetTokens,                            // the live token arrays
  mappings,                                              // colorIndex stripped (ExportMapping)
}
```

Two deliberate transforms:

- **`meta` whitespace is sanitised.** The textareas can contain newlines, which would
  leak into the export. `sourceText` has newlines removed entirely (Han text has no
  inter-word spaces); `targetText` and `authorship` collapse newline runs to a single
  space and `.trim()`. Without this, raw newlines would dump into the `meta` block.
- **`colorIndex` is dropped** from each mapping — color is a UI concern, not alignment
  data.

## The formatter — `formatExport()`

`src/lib/exportFormat.ts`. A recursive pretty-printer (`formatJson`) that is _almost_
`JSON.stringify(v, null, 2)`, with two purpose-built differences that make the output
readable:

1. **Arrays of primitives stay on one line.** `"sourceTokenIds": [0, 1]` instead of one
   element per line — so the ID lists don't dominate the output vertically.
2. **Arrays of token objects render as a column-aligned table.** `isTokenObject()`
   recognises a token by its keys (`id`, `text`, `line`, `type`, all primitive-valued).
   `formatTokenBody()` then pads each field to the widest value across the array, so the
   same field starts at the same column on every row:

   ```
   { "id": 0, "text": "知", "pinyin": "zhī",  "line": 0, "type": "character" }
   { "id": 1, "text": "命", "pinyin": "mìng", "line": 0, "type": "character" }
   ```

   The `pinyin` column is **omitted entirely** when no token in the array carries it
   (e.g. `targetTokens` never have pinyin).

`formatValue()` renders `undefined` as the literal string `undefined` — not valid JSON,
but intentional: an un-annotated source `pinyin` shows up visibly in the export rather
than being silently dropped. (See the
[`pinyin` semantics](data-model.md#why-pinyin-is-string--null--undefined).)

This formatter has no component dependencies, so it's unit-tested directly in
`exportFormat.spec.ts` (primitive one-lining, literal `undefined`, column alignment,
and column omission).

## The panel — `JsonExportPanel` + `HighlightedCode`

`JsonExportPanel.svelte` derives `formatExport(alignment.exportData)` and feeds it to
`HighlightedCode.svelte`, the generic Shiki-based highlighter.

### Recoloring Shiki to the app palette

By default the export would look like a generic code preview. To make it feel native,
`HighlightedCode` takes an optional `colorMap` prop — a flat `raw hex → app hex` lookup
applied **at render**, `style="color: {colorMap[token.color] ?? token.color}"`. The base
theme is **dracula** (chosen because its token colors are well-known hex values, easy to
target), and `JsonExportPanel` passes a map that swaps dracula's hexes for the app's
mapping palette. The map is **theme-aware** — `mode = appTheme.current` selects the
light or dark variant — so the export tracks the app's [dark mode](dark-mode.md):

| Role                           | dracula hex(es)                            | replaced with                   |
| ------------------------------ | ------------------------------------------ | ------------------------------- |
| strings                        | `#f1fa8c`, `#e9f284`                       | `colors.compostella[mode].base` |
| properties / colons / brackets | `#8be9fe`, `#8be9fd`, `#ff79c6`, `#f8f8f2` | a dimmer neutral grey           |
| numbers                        | `#bd93f9`                                  | `colors.azure[mode].base`       |
| `undefined` literal            | `#ff5555`                                  | `colors.sugar[mode].base`       |

This is why `colors.ts` exports the name-keyed [`colors` lookup](data-model.md#colors)
alongside the index-keyed array — the recolor wants _specific_ palette entries.

**Why a render-time map, not Shiki's `colorReplacements`.** The earlier design passed
`colorReplacements` into `codeToTokens()`, so a theme flip re-ran the (async) tokenizer
to bake new inline colours in. That made the JSON panel recolour a frame _late_ — it
snapped after the rest of the page had already started easing. Now tokenization depends
only on `code`/`lang`/`theme` (all theme-independent), so it runs **once**; the light↔dark
swap is just `colorMap` changing, which updates the inline `style` colours synchronously
in the same frame as everything else and rides the `theme-anim` colour transition (see
[dark mode → the `theme-anim` window](dark-mode.md#the-htmltheme-anim-window)).
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
