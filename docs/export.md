# Export

`Alignment.exportData` produces Verbarium's `AttestationTranslationAlignment`
directly: attestation tokens, translation tokens, ID-based mappings, and independent
break arrays. Token text is canonical; reconstruct by joining it in sequence order.
No textual normalization occurs during export. Mapping UI colors are omitted.

Provenance is displayed separately below the alignment object and can be passed
unchanged to Verbarium's provenance prop. Its lesson-owned source URL remains
separate. The object itself can be copied into a TypeScript declaration and passed
unchanged as the Quote component's quote prop.

## Formatter

`formatExport` keeps primitive arrays on one line and token fields column-aligned.
It recognizes tokens through id, text and type. Unannotated pinyin is shown as
literal undefined; null remains distinct. This is a TypeScript-object preview,
not a versioned strict-JSON interchange protocol.

## Offline migration

Run `node tools/migrate-quotation.ts <quotation.json|quotation.ts> [...]` with Node 24.
The command parses literal data without executing source files, validates it, and
prints deterministic quotation/metadata/report records. Original files are never
overwritten. Review the report and canonical text comparison before accepting any
conversion. Content discrepancies and unrepresentable line assignments are reported,
not repaired. Runtime code does not import this converter.

## The panel — `JsonExportPanel` + `HighlightedCode`

`JsonExportPanel.svelte` derives `formatExport(alignment.exportData)` and feeds it to
`HighlightedCode.svelte`, the generic Shiki-based highlighter.

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
| numbers                        | `#bd93f9`                                  | `colors..base`        |
| `undefined` literal            | `#ff5555`                                  | `colors..base`        |

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
