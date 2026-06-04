# Implementation Notes

A chronological record of significant engineering decisions and features.
Newest first.

| Date | Note | Commits | Summary |
|------|------|---------|---------|
| 2026-06-04 | [Mode Toolbar and Join/Part Sub-Modes](./26-06-04-mode-toolbar.md) | `e52a1be`, `47b13d1` | Flat join/part mode split, toolbar wired to ModeContext, sub-row layout reservation, dynamic tab order, panels-open fix |
| 2026-06-03 | [Tokenization Pipeline and Interactive Token Views](./26-06-03-interactive-token-views.md) | `934af68`, `48143e8`, `5e2c182`, `fc034a8` | Tokenizer module, span-based interactive views replacing textareas on mode advance, and Wenkai font glyph overflow scroll fix |
| 2026-06-03 | [Mode Context and Workbench State Wiring](./26-06-03-mode-context-and-state-wiring.md) | `57c681f`, `67ce723`, `1d0cdac` | Mode moved to Svelte context, bindable props fix for two-way text sync, example fallback content on mode advance |
| 2026-06-03 | [Han-Only Input Filtering with IME Support](./26-06-03-han-input-filter.md) | `ef2d0e5`, `0c1c6d9`, `b59284f` | Real-time Han character filtering on the source field, with IME composition handling and font switching during pinyin input |
| 2026-06-02 | [Mode-Driven Side Panel Animation](./26-06-02-side-panel-animation.md) | `da50015` | CSS grid track animation for collapsible side panels, QuoteWorkbench component extraction, Playwright coverage |
| 2026-05-20 | [Project Foundation: Layout, Fonts, and Quote Input Prototype](./26-05-20-project-foundation.md) | `d521ad9`, `e26b7b0`, `f2a84fb`, `0932483`, `6338972`, `785fcaa`, `2724c1e` | SvelteKit scaffold, responsive three-column grid, Wenkai + Source Serif 4 typography, textarea input prototype, provisional token/alignment data model |
