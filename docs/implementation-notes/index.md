# Implementation Notes

A chronological record of significant engineering decisions and features, newest
first.

## How this folder works

Implementation notes are a **running log of changes**, written as the work lands.
Periodically they are *parsed* into the main [documentation](../index.md), which
describes the app as it is **now** rather than how it got there.

- **[`old/`](./old/)** — notes that have **already been folded into the docs**.
  Kept for history; you should not need them to understand the current app.
- **This folder (top level)** — notes written **since the last parse**. These are
  the ones the next documentation pass will consume.

After parsing the top-level notes into the docs, move them into `old/` so the top
level always shows only "not yet documented" work.

## New notes (awaiting next parse)

| Date | Note | Commits |
|------|------|---------|
| 2026-07-02 | [Text-field chase, card-opacity snap, and body-level color-scheme](./26-07-02-text-fields-card-opacity-and-body-color-scheme.md) | _(uncommitted)_ |
| 2026-07-02 | [Theme lockstep: easing mismatch and Svelte batching](./26-07-02-theme-lockstep-easing-and-flushsync.md) | `fb0265f` |

## Archived notes (already parsed into the docs)

### Folded in on 2026-06-27

This pass consumed the 2026-06-15 → 2026-06-27 run. It added three new docs pages —
[Dark Mode](../dark-mode.md), [View Mode](../view-mode.md), and
[Mappings List](../mappings-list.md) — and revised the data model, tokenization, token
store, link/line modes, mode transitions, keyboard navigation, export, UI architecture,
and build/deploy pages to match the current code (canonical pinyin, the `gridDom`
contract, `buildMappingIndex`, the line-edit animation's dual regime, the removal of
`crossZoneJump`, and more).

| Date | Note | Commits |
|------|------|---------|
| 2026-06-15 | [Canonical pinyin storage](./old/26-06-15-canonical-pinyin-storage.md) (+ [review](./old/canonical-pinyin-storage-review.md)) | `96ada2f`, `2c98dae` |
| 2026-06-15 | [Cross-zone nav scoping fix](./old/26-06-15-cross-zone-nav-scoping.md) | `5271beb` |
| 2026-06-15 | [Line-mode divisor hover redistribution](./old/26-06-15-line-mode-divisor-redistribution.md) | `df21f7a` … `dba9d7f` |
| 2026-06-16 | [Viewport-height layout overhaul](./old/26-06-16-viewport-height-layout-overhaul.md) | `e501cb5`, `6841fe1`, `38386ff` |
| 2026-06-16 | [View-mode mapping highlight](./old/26-06-16-view-mode-mapping-highlight.md) | `793e0d6` |
| 2026-06-16 | [Line-mode two-tap touch](./old/26-06-16-line-mode-two-tap-touch.md) | `a35bf6e` |
| 2026-06-16 | [Line-mode divisor visual affordances](./old/26-06-16-line-mode-divisor-styling.md) | `87d3622` … `55425cc` |
| 2026-06-17 | [Source token punctuation grouping](./old/26-06-17-source-punctuation-grouping.md) | `1523814` |
| 2026-06-17 | [Seamless text→token handoff](./old/26-06-17-text-token-seamless-handoff.md) | `4921932`, `62c5de3` |
| 2026-06-17 | [Authorship browser restoration fix](./old/26-06-17-authorship-browser-restoration.md) | `4670950` |
| 2026-06-17 | [Toolbar touch sticky hover/focus fix](./old/26-06-17-toolbar-touch-sticky-hover.md) | `3c5412f` |
| 2026-06-17 | [CI guard for ICONS_JSON_B64 secret](./old/26-06-17-ci-icons-secret-guard.md) | `7b37ba2` |
| 2026-06-17 | [Line-mode redistribution CSS @property fix](./old/26-06-17-line-mode-redistribution-css-property.md) | `a83a715`, `34b50d8` |
| 2026-06-19 | [MappingsList GSAP Flip animations](./old/26-06-19-mappings-list-gsap-flip-animations.md) | `4d7a123` … `3315995` |
| 2026-06-20 | [MappingsList animation polish](./old/26-06-20-mappings-list-animation-polish.md) | `a59c47d`, `c70f089` |
| 2026-06-20 | [Swipe-to-delete on touch](./old/26-06-20-swipe-to-delete.md) | `31e080c` |
| 2026-06-20 | [Punctuation atomic for line splitting](./old/26-06-20-punctuation-atomic-line-splitting.md) | `1898c48` |
| 2026-06-21 | [Dark mode infrastructure](./old/26-06-21-dark-mode-infrastructure.md) | `0a90f89`, `247b60c` |
| 2026-06-21 | [Mapping palette dark variants](./old/26-06-21-mapping-palette-dark-variants.md) | `57ec2e9` … `ccebbb8` |
| 2026-06-23 | [Delete button color flash fix](./old/26-06-23-delete-button-flash-fix.md) | `296de30` |
| 2026-06-25 | [Theme transition synchronization](./old/26-06-25-theme-transition-synchronization.md) | `eb941ed` |
| 2026-06-26 | [Alignment concern split: ViewHighlight and colouring index](./old/26-06-26-alignment-concern-split.md) | `d998e63` |
| 2026-06-26 | [Line-edit animation overhaul](./old/26-06-26-line-edit-animation-overhaul.md) | `a2e434e` |
| 2026-06-26 | [MappingsList scroll-before-animate and concurrent delete guard](./old/26-06-27-mappingslist-scroll-perf.md) | `4a13b11` |
| 2026-06-27 | [Grid DOM contract module and layout knowledge consolidation](./old/26-06-27-dom-contract-module.md) | `a24fa85`, `af17a04`, `3e2681d` |
| 2026-06-27 | [Pure module and action extraction wave](./old/26-06-27-pure-module-extraction.md) | `7af4805`, `bedc35a`, `d6c5181` |

### Folded in on 2026-06-14

These cover the token store, the target tokenizer, link/line mode, the responsive data
panels and modal, the JSON export pipeline, the page-component decomposition, the
interaction-mode sensor, and the GitHub Pages deploy.

| Date | Note | Commits |
|------|------|---------|
| 2026-06-14 | [+page.svelte decomposition](./old/26-06-14-page-component-decomposition.md) | `8d9053d` … `2682473` |
| 2026-06-14 | [Token store consolidation](./old/26-06-14-token-store-consolidation.md) | `59cf15c` |
| 2026-06-14 | [Export formatter extraction](./old/26-06-14-export-format-extraction.md) | `1cec1e0` |
| 2026-06-14 | [lineEdit animation module](./old/26-06-14-lineedit-animation-module.md) | `ca27ef4` |
| 2026-06-14 | [Misc link/line-mode fixes](./old/26-06-14-misc-link-and-linemode-fixes.md) | `90d6f2e` … `98c0356` |
| 2026-06-14 | [Interaction mode sensor](./old/26-06-14-interaction-mode-sensor.md) | `02ecee4`, `539973f` |
| 2026-06-14 | [Target tokenizer consolidation](./old/26-06-14-target-tokenizer-consolidation.md) | `34b7992` |
| 2026-06-13 | [Workbench mode transitions](./old/26-06-13-workbench-mode-transition-overhaul.md) | `5db309e`, `2c95c87` |
| 2026-06-13 | [Export & aside panel polish](./old/26-06-13-export-panel-polish.md) | `fd43e3d`, `3773995` |
| 2026-06-13 | [Minimal-viewport modal refinements](./old/26-06-13-minimal-viewport-modal-refinements.md) | `fd59b99`, `4fe54bc`, `81c0fd6` |
| 2026-06-13 | [Minimal-viewport data modal](./old/26-06-13-minimal-viewport-data-modal.md) | `f2ec4ad` |
| 2026-06-13 | [Toolbar maps/json toggle](./old/26-06-13-aside-maps-json-toggle.md) | `8febec5`, `194dc09` |
| 2026-06-13 | [Line-mode indicator fixes](./old/26-06-13-line-mode-indicator-fixes.md) | `d0bf212`, `dd63b53`, `b63ecbb` |
| 2026-06-13 | [Export palette recolor](./old/26-06-13-export-palette-recolor.md) | `e679881` |
| 2026-06-13 | [GitHub Pages deploy pipeline](./old/26-06-13-deploy-pipeline.md) | `c1c84eb`, `3120bca` |
| 2026-06-11 | [Line-mode merge collapse](./old/26-06-11-line-mode-merge-collapse.md) | `c67b8f0` |
| — | [Click-outside-to-deselect](./old/click-outside-deselect.md) | — |
