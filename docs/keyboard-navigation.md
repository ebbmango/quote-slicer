# Keyboard & Navigation

The app is fully operable from the keyboard. Three pieces cooperate: the **token grid
navigator** (moving focus between tokens / line controls), the **interaction-mode
sensor** (keeping mouse and keyboard affordances from clashing), and a couple of
**document-level shortcuts**.

## Why a custom navigator

The token workspace is a flex-wrapped grid of spans whose visual rows don't match DOM
order, and the same container has to serve two very different modes (selectable tokens
in link mode, split/merge controls in line mode). Native Tab order can't express
"move to the token visually below this one", and we don't want tokens in the Tab order
at all. So tokens are removed from Tab, and a custom Alt+Arrow scheme drives focus.

## `createTokenGridNav()`

`src/lib/navigation/tokenGridNav.ts`. `QuoteWorkbench` creates **one** instance and
wires its `handleKeydown` / `handleFocusIn` to the `role="grid"` container. A single
instance serves both modes because its config fields are getters/callbacks,
re-evaluated on every keystroke:

| Config field | Link mode | Line mode |
|--------------|-----------|-----------|
| `itemSelector()` | `[role="option"]` | `.split-zone, .merge-zone, .ws-split, .ws-boundary` |
| `crossZoneJump()` | `true` (Alt+Enter and edge jump enabled) | `false` |
| `getDefaultIndex(zone)` | `alignment.findDefaultTokenIndex(zone)` | unused (`-1`) |
| `onActivate(el, e)` | resolve zone + `data-token-index`, call `toggleSource`/`toggleTarget` | `el.click()` (fires the button's own handler) |
| `onEscape()` | `alignment.deselect()` | no-op |

The key bindings (identical machinery, mode-specific meaning):

| Shortcut | Effect |
|----------|--------|
| Alt+↑ / Alt+↓ | Move focus to the element on the visual row above/below; at a zone's far edge (link mode only) jump to the other zone |
| Alt+← / Alt+→ | Move focus to the prev/next navigable element in DOM order |
| Alt+Enter | (link mode) toggle focus between source and target |
| Alt+Space | activate the focused element |
| Alt+Shift+Space | activate "with force" (force-add a source token in link mode) |
| Escape | blur the focused element, then run `onEscape()` |

`handleFocusIn` remembers the last focused element per zone, so jumping away and back
returns you where you were. `getZone(el)` (exported alongside) resolves which panel an
element is in by walking up to the nearest `[data-zone="source"|"target"]` wrapper —
those wrappers are rendered by `QuoteWorkbench` and present in both modes.

### Visual-neighbour math

The "which element is on the row above/below, closest horizontally" calculation is
extracted into a **pure function**, `pickVisualNeighbor()` in
`src/lib/navigation/visualNeighbor.ts`. It operates on plain
`{ top, bottom, left, width }` rects (no DOM), so it is unit-tested directly in
`visualNeighbor.spec.ts`. `tokenGridNav` just feeds it `getBoundingClientRect()`
values.

## The interaction-mode sensor

`src/lib/context/interactionMode.svelte.ts`.

### Why

The line-mode split/merge zones reveal themselves on `:hover` **and** on
`:focus-visible`. With both selectors unconditionally live, a mouse hovering one zone
and a Tab-focused other zone could both light up at once — confusing when the user
mixes input devices.

### How

A global `$state` singleton tracks the current input device:

```ts
interactionMode.current: 'mouse' | 'keyboard'  // plus isMouse / isKeyboard getters, set()
```

`initModeTracking()` (called once from `+layout.svelte`) attaches two document
listeners: any `mousemove` → `'mouse'`, a `Tab` keydown → `'keyboard'`. **Last input
wins, and only `Tab` flips to keyboard** (other keys are ignored, to avoid flicker from
e.g. arrow-key nav while the mouse sits idle).

On each change, `set()` also writes `document.documentElement.dataset.interaction`, so
plain CSS can gate the affordances without any component importing the singleton:

```css
:global(html[data-interaction='mouse'])    .split-zone.line-active:hover        { … }
:global(html[data-interaction='keyboard']) .split-zone.line-active:focus-visible { … }
```

> `initModeTracking()` is called from a **synchronous** `onMount` in `+layout.svelte`,
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
  (`[data-mapping-id]`) or one of the token panels (`[aria-label="Source tokens"]` /
  `"Target tokens"`). This is the click-outside-to-deselect gesture; its keyboard
  counterpart is Escape (via `tokenGridNav.onEscape`).
