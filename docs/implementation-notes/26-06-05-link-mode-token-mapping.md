# Link Mode: Token Mapping State Machine

> Commits: `037243b`, `fcf271b`
> Date: 2026-06-05

## Overview

Link mode is the phase where the user draws connections between Chinese source tokens and their translation equivalents. This work introduced the complete infrastructure for that: a reactive state machine (`LinkContext`) that tracks which tokens belong to which mappings, and the wiring of that state into the two interactive token views.

## Motivation

Once tokenization was in place, the token views were static — spans rendered from arrays, no interactivity. The next step toward producing a usable alignment was letting the user draw many-to-many correspondences between source characters and target words. This required both a data model for those correspondences and a clear interaction grammar.

## Architecture

The data model lives in `link.svelte.ts`. A `Mapping` is a plain object holding a `sourceIndices` array, a `targetIndices` array, and a `colorIndex` for visual identification. `LinkContext` holds the full list of mappings as `$state`, plus `activeMappingId` — the currently selected mapping (or `null` when idle). Two `$derived` maps (`sourceMappingIndex`, `targetMappingIndex`) invert the arrays into fast token-to-mapping lookups, rebuilt reactively whenever the mappings change.

`QuoteWorkbench` calls `setLinkContext()` once, making the context available to its descendants. The two interactive components consume it via `getLinkContext()` and read token state through `getSourceTokenState(i)` / `getTargetTokenState(i)`, each returning a discriminated union: `unmapped`, `idle`, or `active`.

## Implementation Details

The state machine is expressed as two public methods — `clickSource(i)` and `clickTarget(i)` — that encode the full interaction grammar:

- Clicking a **claimed** token selects its mapping (or, if it already belongs to the active mapping, removes it and auto-deletes the mapping if empty).
- Clicking an **unclaimed** token while a mapping is active adds it to that mapping.
- Clicking an **unclaimed** token while idle creates a new mapping containing that token and immediately selects it.

Mappings are auto-deleted (`pruneActive`) when both `sourceIndices` and `targetIndices` are empty — a partially-filled mapping (sources but no targets, or vice versa) is a valid in-progress state.

Colors cycle through a 9-color palette (`MAPPING_COLORS` in `colors.ts`), assigned at creation time via `mappings.length % 9`. This keeps assignment deterministic and stable across the session.

## Design Decisions

**Index-based references, not object references.** Mappings store integer indices into the `RawSourceToken[]` / `RawTargetToken[]` arrays rather than holding references to the token objects. This keeps `Mapping` serializable and avoids identity issues when tokens are re-derived from text changes.

**ARIA `listbox` + `option` pattern.** Each token container is `role="listbox" aria-multiselectable="true"`, and each interactive span is `role="option"` with `aria-selected` reflecting the active state. This is the semantically correct pattern for "select items from a set" — closer to a multi-select list than a button group.

**Whitespace tokens are inert.** They carry no role, tabindex, or handlers. Only meaningful tokens (characters, words) participate in the interaction.
