# Implementation Notes

A chronological record of significant engineering decisions and features.
Newest first.

| Date | Note | Commits | Summary |
|------|------|---------|---------|
| 2026-06-07 | [Token Keyboard Navigation: Alt+Arrow and Cross-Zone Jumping](./26-06-07-token-keyboard-navigation.md) | `a17f988`, `8b4a0bb` | Tokens removed from Tab order; geometry-based visual neighbor finding for Alt+Arrow; Alt+Enter cross-zone toggle with remembered position per zone |
| 2026-06-07 | [Mapping Card: Keyboard Access, Focus States, and Scoped Delete](./26-06-07-mapping-card-keyboard-access.md) | `e3717c3`, `91e87e8`, `09688ad`, `b8b025d` | Per-card isFocused tracking, color-mix focus outline, pinyin gated to active card, Tab scroll-anchoring in sidebar, deleteById decoupled from selection, focus-scoped Backspace/Delete |
| 2026-06-05 | [Mapping Card: Named Semantic Color Palette](./26-06-05-mapping-card-color-palette.md) | `df3e1f9` | Nine named fields on MappingColor replace inline color-mix() calls in Mapping.svelte; single source of truth for all card shades |
| 2026-06-05 | [Mapping Panel: Sidebar List and Card Component](./26-06-05-mapping-panel.md) | `dca306b`, `f36868a`, `addb47d` | Context hoist to share LinkContext with sidebar, token sync via $effect, text-order color model, pinyin slots, Mapping card with three-column grid and absolute-positioned separator trick |
| 2026-06-05 | [Link Mode: Interaction Polish — Colors, Multi-Input, and Focus](./26-06-05-link-mode-interaction-polish.md) | `b53d0d0`, `e2c5402`, `fbf12b4` | Per-role color shades, one-source-default selection model with cmd/long-press/alt multi-add, punctuation exclusion, keyboard focus styles via :focus-visible, 280ms target token transitions |
| 2026-06-05 | [Link Mode: Token Mapping State Machine](./26-06-05-link-mode-token-mapping.md) | `037243b`, `fcf271b` | LinkContext state machine with ARIA listbox/option wiring, many-to-many mapping data model, 9-color cycle, auto-delete on empty |
| 2026-06-04 | [Mode Toolbar and Join/Part Sub-Modes](./26-06-04-mode-toolbar.md) | `e52a1be`, `47b13d1` | Flat join/part mode split, toolbar wired to ModeContext, sub-row layout reservation, dynamic tab order, panels-open fix |
| 2026-06-03 | [Tokenization Pipeline and Interactive Token Views](./26-06-03-interactive-token-views.md) | `934af68`, `48143e8`, `5e2c182`, `fc034a8` | Tokenizer module, span-based interactive views replacing textareas on mode advance, and Wenkai font glyph overflow scroll fix |
| 2026-06-03 | [Mode Context and Workbench State Wiring](./26-06-03-mode-context-and-state-wiring.md) | `57c681f`, `67ce723`, `1d0cdac` | Mode moved to Svelte context, bindable props fix for two-way text sync, example fallback content on mode advance |
| 2026-06-03 | [Han-Only Input Filtering with IME Support](./26-06-03-han-input-filter.md) | `ef2d0e5`, `0c1c6d9`, `b59284f` | Real-time Han character filtering on the source field, with IME composition handling and font switching during pinyin input |
| 2026-06-02 | [Mode-Driven Side Panel Animation](./26-06-02-side-panel-animation.md) | `da50015` | CSS grid track animation for collapsible side panels, QuoteWorkbench component extraction, Playwright coverage |
| 2026-05-20 | [Project Foundation: Layout, Fonts, and Quote Input Prototype](./26-05-20-project-foundation.md) | `d521ad9`, `e26b7b0`, `f2a84fb`, `0932483`, `6338972`, `785fcaa`, `2724c1e` | SvelteKit scaffold, responsive three-column grid, Wenkai + Source Serif 4 typography, textarea input prototype, provisional token/alignment data model |
