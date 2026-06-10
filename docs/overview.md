# Overview

quote-slicer is a tool for scholars and translators working with Chinese texts. You paste a Chinese source passage and its English translation, then draw connections between individual source characters and their corresponding target words. The output is a structured alignment — a set of mappings that records exactly which characters correspond to which words, with pinyin romanisation for each source token.

## The four modes

The app moves through four sequential modes. The current mode is held in `ModeContext` (`src/lib/context/mode.svelte.ts`).

| Mode | User-facing name | What the user does |
|------|-----------------|-------------------|
| `'text'` | Text entry | Paste or type the source (Chinese) and target (English) texts, plus an optional attribution line |
| `'link'` | Link mode | Click tokens in both panels to create word-to-word mappings; edit pinyin; delete or reorder mappings |
| `'line'` | Line tool | Adjust where line breaks fall in source and target independently — split a line into two or merge two lines into one |
| `'view'` | View | Read-only display of the completed alignment (not yet built) |

Clicking the advance arrow in `text` mode commits both texts and moves to `link` mode. The toolbar below the workbench switches freely between `link`, `line`, and `view`.

## What a mapping is

Each mapping links a set of source characters to a set of target words and carries:

- a color, assigned from a fixed 9-color palette and stable for the lifetime of the mapping
- a pinyin array (one entry per source character), auto-filled from `pinyin-pro` and editable in the sidebar card
- a display label (sequential number shown on the card)

Mappings are displayed in the left sidebar, sorted by the first source character's position in the text.

## Layout

The app uses a responsive three-column grid: left sidebar (mapping panel), centre (workbench with source + target), right sidebar (unused). Sidebars collapse to zero width in `text` mode and animate open when the user advances.
