# Grid DOM Contract Module and Layout Knowledge Consolidation

> Commits: `a24fa85`, `af17a04`, `3e2681d`
> Date: 2026-06-27

## Overview

Five separate readers of the token grid — the keyboard navigator, the hover-spread `redistribute` action, the line-edit animation in the token store, the global shortcuts handler, and `QuoteWorkbench` itself — were each maintaining their own hand-copied selector strings (`[data-zone="source"]`, `[data-token-index="${n}"]`, etc.). Any attribute rename would have required tracking down every reader. This wave of changes consolidates that DOM contract into one file and removes two related cases where business logic reached into the DOM to find elements it should have been handed directly.

## Architecture

`src/lib/navigation/gridDom.ts` is now the single source of truth for:

- **Selector constants** (`TOKEN_ITEM_SELECTOR`, `PANEL_SELECTOR`, `SCROLLBOX_SELECTOR`, `FLIP_TOKEN_SELECTOR`, etc.)
- **Builder functions** (`zoneSelector(zone)`, `tokenSelector(index)`, `divisorSelector(index)`) that construct attribute-value selectors
- **Dataset accessors** (`tokenIndexOf(el)`, `divisorIndexOf(el)`) paired with their corresponding builders so a rename touches one place, not two
- The `Zone` type (`'source' | 'target'`), moved here from `tokenGridNav`

The file also absorbed `constants/lineDivisor.ts`, which held a subset of these constants.

## Implementation Details

Two related cleanups landed alongside the new module.

**Divisor refocus in the navigator** (`af17a04`): After a keyboard split/merge in line tool, the activated divisor is re-rendered away (the edit replaces it). The logic that re-acquired focus by divisor index was previously inlined in `QuoteWorkbench`. It was moved into `tokenGridNav` as `restoreFocusByIndex()`, gated by a `restoresFocusOnActivate` predicate the caller supplies. Focus management now lives entirely in the navigator, and the workbench only configures it.

**Provenance ref via `EditScope`** (`3e2681d`): The token store's line-edit animation flips the provenance textarea alongside the token panels. Previously the store found the element by walking `sourceWrapperEl.parentElement.parentElement` and then querying `#provenance` — coupling the store to the `QuoteWorkbench` layout shape. The ref is now passed in via `EditScope` (the bundle of DOM elements a line edit operates on). The store reads only what it's given; the workbench owns layout knowledge.

## Design Decisions

The `gridDom` module exports constants and builders but deliberately avoids `querySelector` wrappers. Single-use lookups like `container.querySelector(SCROLLBOX_SELECTOR)` read fine inline. A query helper would only be worth adding if a `querySelector` pattern started repeating across multiple readers — as of this write, none did.

`globalShortcuts` was also updated to identify panels by `data-zone` (was `aria-label`). The `data-zone` attribute is now the canonical panel identity; `aria-label` carries only its accessibility meaning.

## Areas to Be Careful

Writers (components that stamp these attributes into the DOM) are not imported through `gridDom` — they reference the attribute names in their own markup. There's no compile-time check that a writer and a reader agree on the string. If you rename an attribute, search the component templates as well as `gridDom.ts`.
