# Mapping Selection UX: Escape, Outside Click, and Scroll-into-View

> Commits: `569aadc`, `6a90823`, `6f09748`
> Date: 2026-06-07

## Overview

Three small UX completions for mapping card selection: deselect on Escape, deselect when clicking outside any card or token area, and scroll the active card into view when selection changes via token click.

## Implementation Details

**Escape (`569aadc`).** A `keydown` handler on the `<li>` catches Escape, calls `link.deselect()`, and blurs the card. Guarded against input events so typing in the pinyin field doesn't dismiss the card.

**Outside click (`6a90823`).** A document-level `click` listener in `+page.svelte` calls `link.deselect()` for any click that doesn't land on a `[data-mapping-id]` element, a source token list, or a target token list. The three exclusion zones prevent accidental deselection during normal interaction.

**Scroll into view (`6f09748`).** Token clicks set `activeMappingId` in `LinkContext` without moving DOM focus — so a card selected via a token click could be off-screen in the sidebar with no scroll triggered. An `$effect` on `activeMappingId` queries the sidebar list for the matching `<li>` and scrolls it into view using the same padded smooth-scroll helper already used for Tab navigation.
