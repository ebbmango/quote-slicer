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

| Date | Note | Commits | Summary |
|------|------|---------|---------|
| 2026-06-26 | [Line-edit animation overhaul](./26-06-26-line-edit-animation-overhaul.md) | `a2e434e` | LineDivisor extraction (~505 lines deduped); single nested GSAP Flip over full vertical layout; clearProps fix for double-counting bug that caused auth and opposite panel to jump on first frame in unconstrained viewports |
| 2026-06-25 | [Theme transition synchronization](./26-06-25-theme-transition-synchronization.md) | `eb941ed` | html.theme-anim gating window syncs fast token transitions to 500ms page background; placeholder color fixed with currentColor; JsonExportPanel dark palette derived from appTheme.current; colorReplacements hoisted to $derived |
| 2026-06-23 | [Delete button color flash fix](./26-06-23-delete-button-flash-fix.md) | `296de30` | Three-layer bug: SVG fill transition, focus-before-click color mismatch, stale GPU texture on hidden element after theme switch; fixed by removing fill transition, decoupling delete colors from isActive, and {#key isDark} for fresh raster |
| 2026-06-21 | [Mapping palette dark variants](./26-06-21-mapping-palette-dark-variants.md) | `57ec2e9`, `e343e9b`, `8f4befd`, `f1665d9`, `ccebbb8` | MappingColor wraps light/dark MappingColorVariant; Mapping.svelte selects variant from appTheme.current; iterative color tuning for inactive cards, tag text, and bot-bar in dark mode |
| 2026-06-21 | [Dark mode infrastructure](./26-06-21-dark-mode-infrastructure.md) | `0a90f89`, `247b60c` | No-flash prepaint script, cross-tab theme controller with OS-adaptive state semantics, animated orbit toggle button; Firefox clip-path repaint bug worked around with overflow:hidden |
| 2026-06-20 | [Punctuation atomic for line splitting](./26-06-20-punctuation-atomic-line-splitting.md) | `1898c48` | Removes intra-group split-zone divisors so a base token and its glued punctuation can never be split onto different lines; adds focus-restore fallback for the keyboard-merge edge case where the merged divisor vanishes |
| 2026-06-20 | [Swipe-to-delete on touch](./26-06-20-swipe-to-delete.md) | `31e080c` | Horizontal swipe replaces delete button on coarse-pointer devices; angle-check + deadzone gesture recognition; column-aware direction constraint; stamped `dataset.swipeFlyoff` marker fixes confirmed bug where button-deleted cards carried a GSAP transform and flew off in wrong direction |
| 2026-06-20 | [MappingsList animation polish](./26-06-20-mappings-list-animation-polish.md) | `a59c47d`, `c70f089` | `listAnimating` guard throttles mutations during card animations; empty-state overlay crossfades concurrently with the last card's slide-out instead of gating on `outroing` |
| 2026-06-19 | [MappingsList GSAP Flip animations](./26-06-19-mappings-list-gsap-flip-animations.md) | `4d7a123` … `3315995` | Two-phase add (make-way Flip + slide-in) and exit-slide + gap-close ripple for mapping cards; column-aware direction; interruption safety; fixes re-entrant `$state` write in GSAP `onComplete` that silently killed Svelte's reactive scheduler |
| 2026-06-17 | [Line-mode redistribution CSS @property fix](./26-06-17-line-mode-redistribution-css-property.md) | `a83a715`, `34b50d8` | `@property` registration for `--rd-x` gives it a concrete `0px` initial so cross-row spread/collapse transitions are always explicit→explicit and animate instead of snap |
| 2026-06-17 | [CI guard for ICONS_JSON_B64 secret](./26-06-17-ci-icons-secret-guard.md) | `7b37ba2` | Pre-build CI step enumerates required icon keys and fails fast when secret is stale; introduced after a prod outage where missing icon keys produced a broken deploy with no build error |
| 2026-06-17 | [Toolbar touch sticky hover/focus fix](./26-06-17-toolbar-touch-sticky-hover.md) | `3c5412f` | `blur()` on touch `pointerup` clears `:focus-visible`; `@media (hover: hover)` prevents iOS sticky hover on modal toolbar buttons |
| 2026-06-17 | [Authorship browser restoration fix](./26-06-17-authorship-browser-restoration.md) | `4670950` | `autocomplete="off"` on authorship textarea suppresses browser form restoration; intentional fix for DOM-lifecycle asymmetry between persistent and conditionally-mounted textareas |
| 2026-06-17 | [Seamless text→token handoff](./26-06-17-text-token-seamless-handoff.md) | `4921932`, `62c5de3` | Textareas pre-match token-mode geometry and colour during the 450ms arrow launch so the DOM swap lands with nothing left to snap; per-field morph strategies avoid compounding opacity multipliers |
| 2026-06-17 | [Source token punctuation grouping](./26-06-17-source-punctuation-grouping.md) | `1523814` | `groupSourceTokens()` glues punctuation to its base token using Unicode property classes; `.tok-group` inline-flex wrapper prevents orphan wraps without affecting token IDs, mapping, or divisor logic |
| 2026-06-16 | [Viewport-height layout overhaul](./26-06-16-viewport-height-layout-overhaul.md) | `e501cb5`, `6841fe1`, `38386ff` | Replaced vh-clamp caps with flex min-h-0 chain; safe-center scroll layer; DataModal as band sibling; CSS fade-y on panels; text-mode textareas aligned to view-mode metrics |
| 2026-06-16 | [View-mode mapping highlight](./26-06-16-view-mode-mapping-highlight.md) | `793e0d6` | Hover/tap highlights full mapping group across both panels; cold/warm delay kills flicker; touch tap-toggles; QuoteWorkbench owns reset + timer cleanup |
| 2026-06-16 | [Line-mode two-tap touch](./26-06-16-line-mode-two-tap-touch.md) | `a35bf6e` | Two-tap touch model for split/merge zones; first tap highlights + spreads, second activates; single shared state in QuoteWorkbench prevents cross-panel conflicts |
| 2026-06-16 | [Line-mode divisor visual affordances](./26-06-16-line-mode-divisor-styling.md) | `87d3622` … `55425cc` | Running-palette coloring across both panels, slanted source glyphs, ~1em hit zones, indicator-only slide animation, fade-out on mode exit |
| 2026-06-15 | [Line-mode divisor hover redistribution](./26-06-15-line-mode-divisor-redistribution.md) | `df21f7a` … `dba9d7f` | Hover feedback on split/merge divisors moved from width-grow to pure-transform gap redistribution; fixes wobble against GSAP Flip |
| 2026-06-15 | [Canonical pinyin storage](./26-06-15-canonical-pinyin-storage.md) | `96ada2f`, `2c98dae` | Pinyin stored as canonical numbered form, displayed as diacritic, via new `pinyinConvert.ts` and `PinyinInput.svelte` |
| 2026-06-15 | [Cross-zone nav scoping fix](./26-06-15-cross-zone-nav-scoping.md) | `5271beb` | Fixes `findDefaultEl` zone-scoping bug for comma-separated selectors; unifies cross-zone Alt+Enter/Arrow jumps across modes |

## Archived notes (already parsed into the docs)

Folded into the docs on **2026-06-14**. They cover the token store, the target
tokenizer, link/line mode, the responsive data panels and modal, the JSON export
pipeline, the page-component decomposition, the interaction-mode sensor, and the
GitHub Pages deploy.

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
