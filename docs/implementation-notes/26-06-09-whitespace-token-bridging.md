# Whitespace Token Bridging in Link Mode

> Commits: `4b2d852`  
> Date: 2026-06-09

## Overview

Whitespace tokens in the target text are excluded from the mapping system entirely — they can never be added to a mapping — but they receive a derived visual state that makes them appear to belong to the mapping that surrounds them when appropriate.

## Motivation

The target tokenizer emits explicit `whitespace` tokens so that the rendered text preserves the spacing users typed. This is necessary both for readable display and for accurate copy-paste output. However, whitespace sitting between two mapped words of the same mapping rendered as uncolored gaps, visually breaking up what should appear as a continuous colored span.

Two problems had to be solved:
1. Clicks on whitespace should not create mappings or toggle inclusion — whitespace is structural, not semantic.
2. Whitespace between two tokens of the same mapping should inherit that mapping's color, closing the visual gap.

## Implementation Details

Both fixes live in `link.svelte.ts`.

The first is a one-line guard at the top of `clickTarget()` that returns early if the token at the clicked index is `whitespace`. This prevents whitespace indices from ever entering a mapping's `targetTokenIds`.

The second is a neighbor scan in `getTargetTokenState()`. When a whitespace token has no entry in the mapping index (it never does), the method walks left and right through the token list, skipping any adjacent whitespace, until it finds the nearest non-whitespace token on each side. If both neighbors are claimed by the same mapping, the whitespace token inherits that mapping's color and active/idle state. If the neighbors differ or either is unmapped, the token falls through to `unmapped`.

## Design Decisions

Whitespace state is always derived, never stored. This keeps the mapping data model clean — only meaningful tokens are tracked — and ensures whitespace display updates automatically whenever the surrounding mappings change.

The neighbor scan crosses whitespace runs of any length, so multiple consecutive spaces between two mapped words all bridge correctly.
