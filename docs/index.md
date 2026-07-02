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

| Page                                            | What it covers                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [Overview](overview.md)                         | Product description, the four modes, responsive layout                                                                 |
| [Data Model](data-model.md)                     | `SourceToken`, `TargetToken`, `Mapping`, `TokenState`, `MappingView`, export types; stable token IDs                   |
| [Tokenization](tokenization.md)                 | Source/target tokenizers, source punctuation grouping, line stamping, whitespace strategy                              |
| [Token Store](token-store.md)                   | The single token owner: text-keyed cache, pinyin overlay, the line-edit animation                                      |
| [Link Mode](link-mode.md)                       | `Alignment`, the click state machine, mapping lifecycle, canonical pinyin, whitespace bridging                         |
| [Line Mode](line-mode.md)                       | Split/merge functions, the line-tool affordances, two-tap touch, the split/merge animation                             |
| [View Mode](view-mode.md)                       | The read-only layer and the `ViewHighlight` hover/tap mapping highlight                                                |
| [Mode Transitions](mode-transitions.md)         | How the workbench animates between text/link/line/view (arrow launch, seamless handoff, persistent DOM, sidebar slide) |
| [Keyboard & Navigation](keyboard-navigation.md) | `tokenGridNav`, the grid DOM contract, visual-neighbour math, the interaction sensor                                   |
| [Export](export.md)                             | The export data shape, the JSON pretty-printer, the theme-aware syntax-highlighted panel                               |
| [Mappings List](mappings-list.md)               | The sidebar card GSAP Flip animations, swipe-to-delete, the `$state` re-entrancy rule                                  |
| [Dark Mode](dark-mode.md)                       | No-flash prepaint, cross-tab theme controller, per-scheme palette, synchronized transitions                            |
| [UI Architecture](ui-architecture.md)           | Component tree, responsibilities, context wiring, the responsive data panels/modal                                     |
| [Build & Deploy](build-and-deploy.md)           | Static prerender, base path, the GitHub Pages pipeline, the proprietary icons secret                                   |
| [File Map](file-map.md)                         | Every source file and its responsibility                                                                               |
| [Future Features](future-features.md)           | Designed-but-unbuilt affordances: punctuation exclusion toggle, paired-mark pairing, per-breakpoint line breaks        |

## Architecture Decision Records

| ADR                                                  | Decision                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [ADR-0001](adr/0001-line-edit-dual-scroll-regime.md) | Line-edit animation handles two scroll regimes differently (constrained vs unconstrained) |
| [ADR-0002](adr/0002-interactive-panel-asymmetry.md)  | Source/target panel DOM and ordinal asymmetries are intentional — do not unify further    |

## Companion documents (repo root)

- **[`CLAUDE.md`](../CLAUDE.md)** — dev commands, the modes table, and the canonical
  **domain vocabulary** (token, mapping, active mapping, whitespace bridging,
  interaction mode, …).
- **[`CONTEXT.md`](../CONTEXT.md)** — the project's naming guide: the preferred term
  for each concept and the names to _avoid_ (e.g. "token store", not "lineEdit").
