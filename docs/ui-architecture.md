# UI Architecture

This page maps the component tree, who owns what, how the four contexts are wired, and
how the responsive layout routes the same two side-views (mappings / JSON) into asides
or a modal. Feature-specific behaviour is covered elsewhere and linked from here.

## Component tree

```
+page.svelte                       root: sets all 4 contexts, owns layout grid + text→link arrow
├── DataPanel.svelte               sidebar-left   (one of two side surfaces)
│   ├── MappingsList.svelte        └ view='maps'  → the mapping cards (GSAP Flip anims)
│   │   └── Mapping.svelte (×N)
│   │       └── PinyinInput.svelte (×N)  buffered canonical-pinyin editor
│   └── JsonExportPanel.svelte     └ view='json'  → live JSON export
│       └── HighlightedCode.svelte
├── main
│   ├── ThemeToggle.svelte         orbiting moon/sun light–dark switch
│   ├── QuoteWorkbench.svelte      the centre workbench
│   │   ├── <textarea> source      text mode only (IME-filtered)
│   │   ├── <textarea> target      text mode only
│   │   ├── <div role="grid">      link/line/view: the token workspace
│   │   │   ├── InteractiveSourceText.svelte   ┐ render tokens + a
│   │   │   │   └── LineDivisor.svelte (×N)     │ LineDivisor between
│   │   │   └── InteractiveTargetText.svelte   ┘ them (line mode)
│   │   │       └── LineDivisor.svelte (×N)
│   │   └── <textarea> authorship  always present (disabled in view mode)
│   ├── DataModal.svelte           minimal viewport: slide-in over the workbench
│   │   └── DataPanel.svelte
│   └── tools: arrow (text) | ModeToolbar.svelte (otherwise)
│       └── IconToggleButton.svelte (×N)
└── DataPanel.svelte               sidebar-right  (always view='json', desktop only)
```

`DataPanel` is the **shared rendering surface** for "maps or json" — the two asides and
the modal all render through it, so the choice between `MappingsList` / `JsonExportPanel`
and the edge-fade mask live in exactly one place and the copies can't drift.

## Component responsibilities

### `+page.svelte`

The root shell — historically a 447-line file, now thin after extracting each
self-contained piece into its own component/context. It:

- sets up the four contexts (in order: `mode`, `breakpoints`, `tokenStore`,
  `alignment` — `alignment` takes the store);
- owns `sourceText` / `targetText` / `authorship`, and the `asideView` / `modalOpen`
  state threaded into `DataModal` and `ModeToolbar`;
- owns the responsive grid layout and the sidebar open/close animation
  (see [Responsive layout](#responsive-layout) and
  [Mode Transitions](mode-transitions.md#the-sidebar-slide-leaving-text-mode));
- owns the text→link **arrow launch**
  (see [Mode Transitions](mode-transitions.md#the-arrow-launch-text--link)) — the one
  piece of bespoke per-page interaction left in the file;
- calls `initAlignmentShortcuts(alignment)` once in `onMount`
  (see [Keyboard & Navigation](keyboard-navigation.md#document-level-shortcuts)).

### `QuoteWorkbench.svelte`

- Consumes the [token store](token-store.md) and derives `sourceTokens` / `targetTokens`
  for rendering. It does **not** push tokens into `Alignment` — `Alignment` reads the
  same store itself. The _only_ thing it pushes is the raw text, via
  `alignment.setMeta({ sourceText, targetText, authorship })` in an `$effect`.
- **Text mode:** renders the source/target textareas, with real-time Han-character
  filtering on the source field via a single `filterSourceInput()` helper shared by
  `oninput` and `oncompositionend` (both paths are required — IME input only settles on
  `compositionend`; filtering is skipped while `isComposing`). The helper also owns the
  caret preservation: it shifts the selection left by the number of stripped characters.
  All textareas keep their height matched to content with the `autosize` action
  (`src/lib/actions/autosize.ts`), imported directly like its siblings
  `longpress`/`swipeToDelete`.
- **Link/line/view:** renders the `role="grid"` token workspace.
- Builds `editScope()` (the DOM refs for the [line-edit
  animation](token-store.md#the-line-edit-animation-splitmerge), including the
  authorship ref) and forwards split/merge into the store; passes `store.animating` down
  to the panels.
- Creates the single `createTokenGridNav()` instance and wires it to the grid container
  with a mode-dependent config (see [Keyboard & Navigation](keyboard-navigation.md)).
- Tags each panel wrapper `data-zone` + `data-flip-id` so the navigator can resolve
  panels and the store can reposition them as units.
- The authorship textarea carries `autocomplete="off"`. Unlike the source/target fields
  (which live inside `{#if editing}` and remount fresh each load), authorship is always
  in the DOM, so the browser would restore its previous value on reload and briefly race
  Svelte's binding. `autocomplete="off"` declares the field's value app-owned and
  suppresses that form restoration.

### `InteractiveSourceText.svelte` / `InteractiveTargetText.svelte`

Render the source/target tokens as a flat flex-wrap layout, using **one DOM tree for
all modes** (see [Mode Transitions](mode-transitions.md#the-persistent-dom-crossfade-link--line--view)).

- Per-token colour/opacity/weight comes from the shared `tokenPresentation()` pure
  function (see [Mode Transitions](mode-transitions.md#the-two-transitions-that-carry-the-motion)),
  selected for the current `appTheme.current` mode.
- **Link mode:** interactive `role="option"` spans (source: non-punctuation only); click
  → `toggleSource`/`toggleTarget`; the source panel also wires the `longpress` action for
  mobile force-add.
- **Line mode:** the split/merge affordances become active, each rendered via a shared
  [`LineDivisor`](line-mode.md#the-line-tool-affordances) between tokens.
- **View mode:** token hover/tap is wired to the [view-mode highlight](view-mode.md).
- Both mark their scroll box `data-scrollbox` and gate a height `$effect` on the
  `animating` prop. Neither owns Alt+Space or Escape — those route through the navigator.
- Both scroll boxes carry the shared **`.fade-y`** soft top/bottom scroll fade — a single
  global rule in `routes/layout.css`, parameterized by `--fade-pad` (default `0.75rem`;
  the workbench textareas override it to `0.5rem` for their smaller text). It used to be
  byte-identical scoped CSS in each component; panel-shared token styles live in
  `layout.css` so the copies can't drift.
- A bare click on empty container space calls `alignment.deselect()` (the mouse half of
  click-outside-to-deselect; Escape is the keyboard half).
- Their structural differences (source's separate scrollbox vs row container; source's
  sequential vs target's dense-map divisor ordinals) are intentional — see
  [ADR-0002](adr/0002-interactive-panel-asymmetry.md).

### `Mapping.svelte`

One card per mapping. Reads **only** a [`MappingView`](data-model.md#mappingview--the-display-snapshot)
— never raw `Mapping` state or token arrays.

- Three columns: hanzi · pinyin input · number badge + delete button.
- Card height spans `r = floor(rowCount / 2) + 1` grid rows (`rowCount` = number of
  source entries, min 1) — a quantized size that tiles cleanly in the CSS grid.
- Colours: it first selects `colorVariant = isDark ? color.dark : color.light` (from
  `appTheme.current`), then flows everything through a single `theme` derived object
  keyed by `isActive`, so the markup reads `theme.cardBg` instead of repeating
  `isActive ? a : b`. The delete button's colours come from `colorVariant` directly
  (not `isActive`) and the icon `<svg>` is `{#key isDark}`'d — both
  [dark-mode flash fixes](dark-mode.md#the-delete-button-colour-flash).
- Pinyin editing uses [`PinyinInput.svelte`](link-mode.md#pinyin-auto-fill-and-canonical-storage),
  editable only when the card is active and non-empty; commits via
  `alignment.setPinyin(id, tokenId, value)` — keyed by the entry's stable token ID,
  not its position in the mapping.
- The delete button shows on hover/focus; calls `alignment.deleteById(id)`.
- An empty mapping (no sources yet) renders a placeholder (`未定`, `- - - -`).

### `MappingsList.svelte`

The `<ol>` of cards, plus the list-level behaviour: a responsive grid (single column,
two columns at the `tablet:` and `modal-wide:` breakpoints), an `$effect` that scrolls
the active card into view, Tab handling within the list (`handleListTab`), and a
**"No mappings." empty state**. It also owns the **GSAP Flip card-animation system**
(add/delete sequencing, the `swipeToDelete` touch gesture, the `listAnimating` throttle,
and the re-entrancy rule that drives all of it) — covered in its own page,
[Mappings List & Card Animations](mappings-list.md).

> The list ref uses a `use:listRef` action rather than `bind:this`. Because a hidden
> aside copy and the modal copy can briefly coexist during a breakpoint force-close, a
> plain `bind:this` would let the _unmounting_ copy null the ref the _surviving_ copy
> just claimed. The action only nulls `listEl` when it still owns the node, so the
> survivor wins.

### `DataPanel` / `JsonExportPanel` / `HighlightedCode`

`DataPanel` picks `MappingsList` vs `JsonExportPanel` by a `view` prop and wraps both in
the `.fade-edges` mask — a CSS mask gradient on all four edges (a hand-tuned smoothstep
ramp, single `--fade` knob) that fades content near the container edges instead of
hard-clipping it. Because the fade signals scrollability, the native scrollbars are
hidden (`no-scrollbar`). `JsonExportPanel` / `HighlightedCode` are covered in
[Export](export.md).

### `ModeToolbar` / `IconToggleButton`

`ModeToolbar` is the bottom toolbar shown in every non-text mode. It renders:

- the **link / line / view** mode switcher;
- two visually identical **maps / json** toggle pairs — `.subtools-aside` and
  `.subtools-modal` — exactly one of which is shown per breakpoint, purely via CSS
  `@media` (see below).

`IconToggleButton` collapses what were six near-duplicate buttons into one component: a
single `<button>` wrapping an SVG path from `icons.json`, with props
`icon` / `label` / `active` / `onclick` / `testid` / `tabindex`. On touch it calls
`e.currentTarget.blur()` on `pointerup` so a tapped toolbar button doesn't keep a sticky
`:focus-visible` ring after the modal closes; the `:hover` style is gated behind
`@media (hover: hover)` so iOS never applies a sticky synthetic hover.

### `ThemeToggle`

The light/dark switch — an orbiting moon/sun pair. Reads/writes `theme.current` and
carries the Firefox-specific repaint and hydration workarounds. Covered in
[Dark Mode → The toggle button](dark-mode.md#the-toggle-button-themetogglesvelte).

### `LineDivisor`

The single owner of the line-tool split/merge affordance (`.split-zone` · `.ws-split` ·
`.merge-zone`), its touch two-tap state machine, the hover-spread wiring, and the divisor
CSS — shared by both interactive panels so a behaviour change lands in one place. See
[Line Mode](line-mode.md#the-line-tool-affordances).

### `DataModal`

The slide-in panel for the smallest viewports — see
[Responsive layout](#responsive-layout).

## Context wiring

Four contexts, all set once at the root and read via `getContext` anywhere:

| Context             | Set / get                                            | File                            |
| ------------------- | ---------------------------------------------------- | ------------------------------- |
| `ModeContext`       | `setModeContext` / `getModeContext`                  | `context/mode.svelte.ts`        |
| `BreakpointContext` | `setBreakpointContext` / `getBreakpointContext`      | `context/breakpoints.svelte.ts` |
| token store         | `setTokenStoreContext` / `getTokenStoreContext`      | `context/tokenStore.svelte.ts`  |
| `Alignment`         | `setAlignmentContext(store)` / `getAlignmentContext` | `context/alignment.svelte.ts`   |

The order matters: `Alignment`'s constructor takes the store, so the store is set first.
The **token store is the single owner** of the token arrays — `QuoteWorkbench` does not
push tokens into `Alignment`; `Alignment` derives its own view from the store keyed by
`meta`. So there is exactly one token owner, no two-way `$effect` sync, and split/merge
can never be handed a pinyin-less array. See [Token Store](token-store.md).

> The interaction-mode sensor (`interactionMode.svelte.ts`) is **not** a context — it's a
> global module singleton, because it works through a `data-` attribute on `<html>` that
> CSS reads directly. See
> [Keyboard & Navigation](keyboard-navigation.md#the-interaction-mode-sensor).

## Responsive layout

The layout is a CSS grid in `+page.svelte`, with breakpoints mirrored in JS by
`BreakpointContext` (so component logic — not just CSS — can branch on viewport).

| Viewport                                              | Columns shown             | maps/json lives in              |
| ----------------------------------------------------- | ------------------------- | ------------------------------- |
| **Cellphone** (default)                               | main only                 | a slide-in **modal**            |
| **Tablet** (tall portrait, `≤899px` & `≥1000px` tall) | main + one bottom sidebar | that **aside** (toggled)        |
| **Medium** (`≥900px`)                                 | one sidebar + main        | that **aside** (toggled)        |
| **Desktop** (`≥1200px`)                               | sidebar + main + sidebar  | both asides at once (no toggle) |

`BreakpointContext` exposes `wide` (`≥1200px`), `belowMedium` (`≤899px`),
`tabletPortrait`, and the derived **`minimal = belowMedium && !tabletPortrait`** — the
one case with no aside to host the side content, where the modal is used instead.

### How the toggle routes content

- The **left aside** renders `maps` when `wide || asideView === 'maps'`, else `json`.
- The **right aside** always renders `json` (only visible when `wide`).
- At `minimal`, the left aside renders **nothing** (`{#if !breakpoints.minimal}`) so its
  `MappingsList` copy can't coexist with the modal's copy; the modal owns the content.
- `ModeToolbar`'s two button pairs are gated purely by `@media`: the **aside** pair
  (always one active) shows at tablet/medium; the **modal** pair (idle until the modal
  opens) shows at minimal; desktop shows neither.

> These thresholds are encoded in **three** places that must stay in sync:
> `breakpoints.svelte.ts`'s `matchMedia` queries, `+page.svelte`'s `@media` blocks, and
> `ModeToolbar`'s `@media` blocks (plus the `tablet:` / `modal-wide:` custom variants in
> `layout.css`).

### The data modal

`DataModal.svelte` is the minimal-viewport home for the same two views. It is
`position: absolute` over the workbench, filling the band between the theme toggle and
the tools row.

- **Open/close + history.** `openModal(view)` sets `asideView`, opens, and `pushState`s a
  history entry (via `$app/navigation`) so the Android/browser **back** button closes it.
  `closeModal()` clears `modalOpen` and, if our entry is still on top, calls
  `history.back()` to unwind it. A `popstate` listener closes the modal on back-nav
  (flipping `modalOpen` only, never calling `history.back()` itself, so a back-close
  can't double-pop). Because `history.back()` resolves asynchronously, `closeModal`
  sets a `suppressPop` flag so the listener ignores the matching `popstate` — without
  it, a close followed by a quick reopen re-pushes an entry the pending back then
  pops, and the listener would kill the just-opened modal. SvelteKit's router APIs
  are used deliberately over raw `history.*` (which the router intercepts/nests).
- **Content swap without re-animating.** Calling `openModal` while already open just
  reassigns `asideView` and returns early. Slide direction lives in `flyX` (`$derived`):
  maps from the left, json from the right. Svelte reads transition params only at
  transition _start_, so swapping views while open never replays the animation.
- **One bidirectional `transition:fly`, not `in:`/`out:`.** Separate `in:`/`out:`
  directives are not bidirectional: a tap landing inside the 450ms window started an
  intro on top of the still-running outro and the two transforms _composed_ — the
  panel jumped to ±2× the slide distance, teleported across the screen, or parked
  off-screen while "open" (constant on slow mobile frames, invisible on fast
  desktops). The single `transition:fly` reverses in-flight animation instead;
  `data-modal.e2e.ts` hammers the toggles and asserts the panel never leaves the
  ±viewport-width range and settles at `translateX(0)`.
- **Breakpoint-exit force-close.** An `$effect` watches `minimal` + `modalOpen`; leaving
  minimal while open force-closes. A `forceClose` flag (`$state`) drives the fly
  duration to `0` so that exit is instant; `openModal` resets it to re-arm the slide.

## GSAP & lazy-loading

The app is statically prerendered (`prerender = true`), so import-time browser API calls
must be avoided. **GSAP and its plugins are lazy-loaded in `onMount`:** `+layout.svelte`
registers `Draggable` + `Flip`; the token store separately lazy-loads `Flip` + `gsap`
for the split/merge tween. The data modal's slide uses Svelte's built-in `fly` (not
GSAP) — it needs only a fade+slide and stays self-contained. If GSAP hasn't loaded when
a split/merge fires, the edit still happens, just without animation (see
[Token Store](token-store.md#the-line-edit-animation-splitmerge)).
