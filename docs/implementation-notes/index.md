# Implementation Notes

A chronological record of significant engineering decisions and features.
Newest first.

| Date | Note | Commits | Summary |
|------|------|---------|---------|
| 2026-06-13 | [Minimal-viewport modal: ref-race fix, two-column grid, forceClose reactivity](./26-06-13-minimal-viewport-modal-refinements.md) | `fd59b99`, `4fe54bc`, `81c0fd6` | Fix `listEl` teardown race via `use:listRef` action + test IDs, add modal-wide two-column mapping grid, make `forceClose` reactive `$state` |
| 2026-06-13 | [Minimal-viewport data modal for maps/json toggle](./26-06-13-minimal-viewport-data-modal.md) | `f2ec4ad` | Below 900px the maps/json buttons open a sliding modal over the workbench instead of an aside, closing on re-click or browser back |
| 2026-06-13 | [Toolbar maps/json toggle for single-aside viewports](./26-06-13-aside-maps-json-toggle.md) | `8febec5`, `194dc09` | New toolbar buttons swap the single visible aside between mapping list and JSON export below the 1200px breakpoint |
| 2026-06-13 | [Line mode: indicator cleanup and pinyin-preserving split/merge](./26-06-13-line-mode-indicator-fixes.md) | `d0bf212`, `dd63b53`, `b63ecbb` | Evenly-dashed split/merge indicators via CSS vars, drop duplicate target merge button, fix pinyin loss on first source split/merge |
| 2026-06-13 | [Export panel: recolor Shiki JSON with mapping palette](./26-06-13-export-palette-recolor.md) | `e679881` | JSON export panel recolored via Shiki colorReplacements to match the app's mapping palette |
| 2026-06-13 | [GitHub Pages deploy pipeline](./26-06-13-deploy-pipeline.md) | `c1c84eb`, `3120bca` | New GH Actions workflow builds and deploys to Pages under `/quote-slicer`, restoring gitignored `icons.json` from a secret |
| 2026-06-11 | [Line mode: animating container height through merge](./26-06-11-line-mode-merge-collapse.md) | `c67b8f0` | Tween scroll-container height in lockstep with Flip so merge no longer clips still-animating tokens |
