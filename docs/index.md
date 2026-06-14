# quote-slicer — Documentation

quote-slicer is a SvelteKit 5 app for drawing word-to-word alignments between a
Chinese source text and its English translation. The user pastes both texts, then
clicks tokens to link them into colored mappings — each with auto-filled pinyin —
adjusts where the line breaks fall, and exports the result as structured JSON.

These docs describe the app **as it currently stands**. They are kept in sync with
the codebase by periodically parsing the
[implementation notes](implementation-notes/index.md) (a running change log) into
the pages below.

## Where to start

If you're new to the codebase, read in this order:

1. **[Overview](overview.md)** — what the app does, the four modes, the layout.
2. **[Data Model](data-model.md)** — the types everything else passes around.
3. **[Tokenization](tokenization.md)** — how raw text becomes tokens.
4. **[Token Store](token-store.md)** — the single owner of the token arrays.

Then the feature-specific pages as you need them.

## All pages

| Page | What it covers |
|------|----------------|
| [Overview](overview.md) | Product description, the four modes, responsive layout |
| [Data Model](data-model.md) | `SourceToken`, `TargetToken`, `Mapping`, `TokenState`, `MappingView`, export types; stable token IDs |
| [Tokenization](tokenization.md) | Source/target tokenizers, line stamping, whitespace strategy |
| [Token Store](token-store.md) | The single token owner: text-keyed cache, pinyin overlay, the unified Flip |
| [Link Mode](link-mode.md) | `Alignment`, the click state machine, mapping lifecycle, pinyin, whitespace bridging |
| [Line Mode](line-mode.md) | Split/merge functions, the line-tool affordances, the split/merge animation |
| [Mode Transitions](mode-transitions.md) | How the workbench animates between text/link/line/view (persistent DOM, the arrow launch, sidebar slide) |
| [Keyboard & Navigation](keyboard-navigation.md) | `tokenGridNav`, visual-neighbour math, the mouse/keyboard interaction sensor |
| [Export](export.md) | The export data shape, the JSON pretty-printer, the syntax-highlighted panel |
| [UI Architecture](ui-architecture.md) | Component tree, responsibilities, context wiring, the responsive data panels/modal |
| [Build & Deploy](build-and-deploy.md) | Static prerender, base path, the GitHub Pages pipeline, the proprietary icons secret |
| [File Map](file-map.md) | Every source file and its responsibility |

## Companion documents (repo root)

- **[`CLAUDE.md`](../CLAUDE.md)** — dev commands, the modes table, and the canonical
  **domain vocabulary** (token, mapping, active mapping, whitespace bridging,
  interaction mode, …).
- **[`CONTEXT.md`](../CONTEXT.md)** — the project's naming guide: the preferred term
  for each concept and the names to *avoid* (e.g. "token store", not "lineEdit").
