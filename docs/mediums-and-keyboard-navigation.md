# Keyboard & Navigation

The app is fully operable from the keyboard. Three pieces cooperate: the **token grid
navigator** (moving focus between tokens / line controls), the **interaction-medium
sensor** (keeping mouse and keyboard affordances from clashing), and a couple of
**document-level shortcuts**.

## Why a custom navigator

The token workspace is a flex-wrapped grid of spans whose visual rows don't match DOM
order, and the same container has to serve two very different tools (selectable tokens
in link tool, split/merge controls in line tool). Native Tab order can't express
"move to the token visually below this one", and we don't want tokens in the Tab order
at all. So tokens are removed from Tab, and a custom Alt+Arrow scheme drives focus.

## `createTokenGridNav()`

`src/lib/navigation/tokenGridNav.ts`. `QuoteWorkbench` creates **one** instance and
wires its `handleKeydown` / `handleFocusIn` to the `role="grid"` container. A single
instance serves both tools because its config fields are getters/callbacks,
re-evaluated on every keystroke:

| Config field                | Link tool                                                             | Line tool                                                    |
| --------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| `itemSelector()`            | `TOKEN_ITEM_SELECTOR` (`[role="option"]`)                             | `LINE_ITEM_SELECTOR` (`.split-zone, .merge-zone, .ws-split`) |
| `getDefaultIndex(zone)`     | `alignment.findDefaultTokenIndex(zone)`                               | unused (`-1`)                                                |
| `onActivate(el, e)`         | resolve zone + `data-token-index`, call `toggleSource`/`toggleTarget` | `el.click()` (fires the divisor's own handler)               |
| `restoresFocusOnActivate()` | `false`                                                               | `true` (a split/merge re-renders the focused divisor away)   |
| `onEscape()`                | `alignment.deselect()`                                                | no-op                                                        |

Cross-zone jumping (Alt+Enter and edge Alt+↑/↓) is now **unconditional** — it is no
longer a config flag. An earlier `crossZoneJump()` getter gated it to link tool; it was
removed so line-tool users can move between source and target with the keyboard too.

The key bindings (identical machinery, tool-specific meaning):

| Shortcut        | Effect                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| Alt+↑ / Alt+↓   | Move focus to the element on the visual row above/below; at a zone's far edge, jump to the other zone (both tools) |
| Alt+← / Alt+→   | Move focus to the prev/next navigable element in DOM order                                                         |
| Alt+Enter       | Toggle focus between source and target (both tools)                                                                |
| Alt+Space       | activate the focused element                                                                                       |
| Alt+Shift+Space | activate "with force" (force-add a source token in link tool)                                                      |
| Escape          | blur the focused element, then run `onEscape()`                                                                    |

`handleFocusIn` remembers the last focused element per zone, so jumping away and back
returns you where you were. `getZone(el)` (exported alongside) resolves which panel an
element is in by walking up to the nearest `[data-zone="source"|"target"]` wrapper —
those wrappers are rendered by `QuoteWorkbench` and present in both tools.

### Visual-neighbour math

The "which element is on the row above/below, closest horizontally" calculation is
extracted into a **pure function**, `pickVisualNeighbor()` in
`src/lib/navigation/visualNeighbor.ts`. It operates on plain
`{ top, bottom, left, width }` rects (no DOM), so it is unit-tested directly in
`visualNeighbor.spec.ts`. `tokenGridNav` just feeds it `getBoundingClientRect()`
values.

### Restoring focus after a line edit

A keyboard split/merge in line tool **re-renders the activated divisor away** — the edit
replaces it — so naive focus would drop to `<body>`. When `restoresFocusOnActivate()` is
true, after the activation the navigator reads the divisor's `data-divisor-index`, waits
a `tick()`, then re-acquires focus by that index via `restoreFocusByIndex(zone, index)`.

That has a fallback for one case: merging a line break between a character and a
**newline-orphaned** punctuation mark recombines them into one
[group](tokenization.md#source-punctuation-grouping), and the merged divisor's index is
now _intra-group_ and unrendered — so the by-index lookup finds nothing. The fallback
focuses the nearest remaining divisor at or before the original index instead, keeping
keyboard focus in the panel.

### The grid DOM contract (`gridDom.ts`)

The navigator does not hand-write selector strings like `[data-zone="source"]` or
`[data-token-index="3"]`. Those — together with the line-divisor and scrollbox selectors
— were duplicated across five readers (this navigator, the hover-spread `redistribute`,
the token store's line-edit animation, the global shortcuts, and `QuoteWorkbench`), so a
single attribute rename meant hunting every reader. They are now centralized in
`src/lib/navigation/gridDom.ts`, the **single source of truth** for the token grid's DOM
contract:

- selector constants (`TOKEN_ITEM_SELECTOR`, `LINE_ITEM_SELECTOR`, `PANEL_SELECTOR`,
  `SCROLLBOX_SELECTOR`, `FLIP_TOKEN_SELECTOR`, …);
- builders (`zoneSelector(zone)`, `tokenSelector(i)`, `divisorSelector(i)`);
- dataset accessors paired with the builders (`tokenIndexOf(el)`, `divisorIndexOf(el)`)
  and the zone resolver `getZone(el)`;
- the `Zone` type (`'source' | 'target'`).

Readers import from `gridDom`; the **writers** (components that stamp these attributes in
their markup) still reference the names in their own templates, so there is no
compile-time check that a writer and reader agree — a rename must touch the component
templates _and_ `gridDom.ts`. The module deliberately exports no `querySelector`
wrappers: single-use lookups read fine inline. (`gridDom` absorbed the former
`constants/lineDivisor.ts`.) See [`CONTEXT.md`](../CONTEXT.md) ("token-grid DOM
contract").

## The interaction-medium sensor

`src/lib/context/interactionMedium.svelte.ts`.

### Why

The line-tool split/merge zones reveal themselves on `:hover` **and** on
`:focus-visible`. With both selectors unconditionally live, a mouse hovering one zone
and a Tab-focused other zone could both light up at once — confusing when the user
mixes input devices.

### How

A global `$state` singleton tracks the current input device:

```ts
interactionMedium.current: 'mouse' | 'keyboard'  // plus isMouse / isKeyboard getters, set()
```

`initInteractionMediumTracking()` (called once from `+layout.svelte`) attaches two document
listeners: any `mousemove` → `'mouse'`, a `Tab` keydown → `'keyboard'`. **Last input
wins, and only `Tab` flips to keyboard** (other keys are ignored, to avoid flicker from
e.g. arrow-key nav while the mouse sits idle).

On each change, `set()` also writes `document.documentElement.dataset.interaction`, so
plain CSS can gate the affordances without any component importing the singleton:

```css
:global(html[data-interaction-medium='mouse'])    .split-zone.line-tool-active:hover        { … }
:global(html[data-interaction-medium='keyboard']) .split-zone.line-tool-active:focus-visible { … }
```

> `initInteractionMediumTracking()` is called from a **synchronous** `onMount` in `+layout.svelte`,
> separate from the async `onMount` that lazy-loads GSAP — an async `onMount` returns a
> Promise, and Svelte ignores the cleanup function in that case.

## Document-level shortcuts

`src/lib/actions/globalShortcuts.ts` — `initAlignmentShortcuts(alignment)`, called
once from `+page.svelte`'s `onMount`. It attaches two document listeners:

- **Delete / Backspace** → delete a mapping. It targets the mapping whose card is
  focused (`li[data-mapping-id]`), falling back to the **active** mapping — so
  Backspace works right after creating a mapping, before you've tabbed to its card.
  It bails if focus is in an `<input>`/`<textarea>`.
- **click** → `alignment.deselect()`, unless the click landed inside a mapping card
  (`[data-mapping-id]`) or one of the token panels — identified by `PANEL_SELECTOR`
  (`[data-zone]`, imported from [`gridDom`](#the-grid-dom-contract-griddomts)), like
  every other grid reader. (This replaced two `aria-label` matches; the panel wrapper
  carries its `data-zone` in all tools, whereas the `aria-label` is dropped in line
  tool.) This is the click-outside-to-deselect gesture; its keyboard counterpart is
  Escape (via `tokenGridNav.onEscape`).
