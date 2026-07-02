# Overview

## What the app is for

quote-slicer is a tool for scholars and translators working with Chinese texts. You
paste a Chinese source passage and its English translation, then draw connections
between individual source characters and their corresponding target words. The
output is a structured **alignment** — a set of mappings recording exactly which
characters correspond to which words, each with pinyin romanisation for the source
side and a stable color.

The underlying data structure (a many-to-many mapping between two token streams) is
fiddly to build by hand. The whole point of the app is to make building it feel
direct: you click characters and words, and the structure assembles itself behind
the scenes.

## The four modes

The app is organised around four modes. Only one is active at a time; the current
mode lives in `ModeContext` (`src/lib/context/mode.svelte.ts`).

| Mode key | User-facing name | What the user does                                                                                                                                                                        |
| -------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'text'` | Text entry       | Paste/type the source (Chinese) and target (English) texts, plus an optional attribution line                                                                                             |
| `'link'` | Link mode        | Click tokens in both panels to create word-to-word mappings; edit pinyin; delete mappings                                                                                                 |
| `'line'` | Line tool        | Adjust where line breaks fall in source and target _independently_ — split one line into two, or merge two into one                                                                       |
| `'view'` | View             | Read-only display of the alignment (tokens dimmed, authorship locked); hovering or tapping a mapped token highlights its whole mapping across both panels — see [View Mode](view-mode.md) |

The app **starts** in `text` mode. Clicking the advance arrow commits both texts and
animates into `link` mode (see [Mode Transitions](mode-transitions.md)). From then
on, the bottom toolbar switches freely between `link`, `line`, and `view`.

> **Mode** (text/link/line/view) is distinct from **interaction mode**
> (mouse vs keyboard input tracking). See
> [Keyboard & Navigation](keyboard-navigation.md) and the domain table in
> [`CLAUDE.md`](../CLAUDE.md).

## What a mapping is

A **mapping** links a set of source characters to a set of target words. It carries:

- a **color**, assigned at creation from a fixed 9-color palette and stable for the
  mapping's lifetime (it never shifts when other mappings are added or removed);
- **pinyin** for each source character, auto-filled from `pinyin-pro` and editable
  in the mapping's sidebar card;
- a **display label** — a sequential number shown on the card.

Mappings appear in the sidebar as cards, sorted by the position of their first source
character in the text. See [Link Mode](link-mode.md) for how they're built and
[Data Model](data-model.md) for the exact shape.

## Layout

The app is a responsive grid with a centre **workbench** (source + target + authorship)
flanked by up to two side panels:

- the **mappings list** (the cards), and
- the **JSON export** (a live, syntax-highlighted dump of the alignment).

How many side panels are visible depends on viewport width, and on the narrowest
screens the side content moves into a slide-in modal instead. The full breakpoint
behaviour — and how the same two views are routed into asides vs. a modal — is
documented in [UI Architecture](ui-architecture.md#responsive-layout). The side
panels collapse to zero width in `text` mode and animate open when the user advances.
