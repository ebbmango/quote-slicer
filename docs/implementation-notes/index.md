# Implementation Notes

A chronological record of significant engineering decisions and features.
Newest first.

| Date | Note | Commits | Summary |
|------|------|---------|---------|
| 2026-06-14 | [Export formatter extraction: formatExport() in exportFormat.ts](./26-06-14-export-format-extraction.md) | `1cec1e0` | JSON export pretty-printer moved out of `+page.svelte` into `exportFormat.ts` with unit tests for column alignment and edge cases |
| 2026-06-14 | [lineEdit module: unifying split/merge animation across panels](./26-06-14-lineedit-animation-module.md) | `ca27ef4` | One `lineEdit.svelte.ts` module replaces per-component Flip + cross-panel Y-shift, owning the text-keyed token cache and a single unified Flip per edit |
| 2026-06-14 | [Misc fixes: export whitespace, punctuation mappings, copyable spaces, indicator style, view-mode authorship](./26-06-14-misc-link-and-linemode-fixes.md) | `90d6f2e`, `45b1ba8`, `f3f14f8`, `a190a26`, `98c0356` | Five small fixes: sanitize export meta whitespace, block punctuation/whitespace mapping creation, copyable target whitespace, solid skewed split/merge indicators, disable authorship in view mode |
| 2026-06-14 | [Interaction mode sensor: gating hover vs focus styles by input device](./26-06-14-interaction-mode-sensor.md) | `02ecee4`, `539973f` | New mouse/keyboard input-mode singleton wired to `data-interaction` on `<html>` so line-mode hover and focus highlights don't both apply at once |
| 2026-06-14 | [Target tokenizer consolidation: one regex, interior-vs-flanking punctuation](./26-06-14-target-tokenizer-consolidation.md) | `34b7992` | Single `tokenizeTarget` replaces two variants; absorbs flanking punctuation into words but splits hyphens/decimals so each piece stays mappable |
| 2026-06-13 | [Workbench mode transitions: unified token DOM and the arrow launch](./26-06-13-workbench-mode-transition-overhaul.md) | `5db309e`, `2c95c87` | One persistent DOM tree per panel so token color and line-break height animate across mode switches instead of snapping; draw-and-shoot arrow gates the text→link transition |
| 2026-06-13 | [Export & aside panel polish: edge fades, empty state, overflow sizing](./26-06-13-export-panel-polish.md) | `fd43e3d`, `3773995` | JSON export sizes to content width so padding clears long lines, smoothstep edge-fade masks replace hard clipping on scroll panels, "No mappings." empty state |
| 2026-06-13 | [Minimal-viewport modal: ref-race fix, two-column grid, forceClose reactivity](./26-06-13-minimal-viewport-modal-refinements.md) | `fd59b99`, `4fe54bc`, `81c0fd6` | Fix `listEl` teardown race via `use:listRef` action + test IDs, add modal-wide two-column mapping grid, make `forceClose` reactive `$state` |
| 2026-06-13 | [Minimal-viewport data modal for maps/json toggle](./26-06-13-minimal-viewport-data-modal.md) | `f2ec4ad` | Below 900px the maps/json buttons open a sliding modal over the workbench instead of an aside, closing on re-click or browser back |
| 2026-06-13 | [Toolbar maps/json toggle for single-aside viewports](./26-06-13-aside-maps-json-toggle.md) | `8febec5`, `194dc09` | New toolbar buttons swap the single visible aside between mapping list and JSON export below the 1200px breakpoint |
| 2026-06-13 | [Line mode: indicator cleanup and pinyin-preserving split/merge](./26-06-13-line-mode-indicator-fixes.md) | `d0bf212`, `dd63b53`, `b63ecbb` | Evenly-dashed split/merge indicators via CSS vars, drop duplicate target merge button, fix pinyin loss on first source split/merge |
| 2026-06-13 | [Export panel: recolor Shiki JSON with mapping palette](./26-06-13-export-palette-recolor.md) | `e679881` | JSON export panel recolored via Shiki colorReplacements to match the app's mapping palette |
| 2026-06-13 | [GitHub Pages deploy pipeline](./26-06-13-deploy-pipeline.md) | `c1c84eb`, `3120bca` | New GH Actions workflow builds and deploys to Pages under `/quote-slicer`, restoring gitignored `icons.json` from a secret |
| 2026-06-11 | [Line mode: animating container height through merge](./26-06-11-line-mode-merge-collapse.md) | `c67b8f0` | Tween scroll-container height in lockstep with Flip so merge no longer clips still-animating tokens |
