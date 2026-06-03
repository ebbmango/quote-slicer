# Han-Only Input Filtering with IME Support

> Commits: `ef2d0e5`, `0c1c6d9`, `b59284f`
> Date: 2026-06-03

## Overview

The source text field accepts only Han characters (Chinese) in real time. Non-Han characters are stripped as the user types or pastes. Input via phonetic IME (e.g., pinyin on macOS/iOS) works correctly — the Latin keystrokes used during composition are not filtered until the user confirms a character selection.

## Motivation

The source field is semantically a Chinese text field. Allowing arbitrary characters would produce garbage data and complicate any downstream tokenization. Filtering at input time — rather than at submission — gives immediate feedback and prevents invalid state from accumulating.

The non-obvious problem is IME input. Chinese input methods work by having the user type phonetic keys (pinyin, e.g. `zh` + `ong` + `g` → 中), then select from candidate characters. During this composition phase, the textarea contains Latin characters. A naive `oninput` filter strips them immediately, making it impossible to complete the phonetic input.

## Implementation Details

The filter logic lives in `QuoteWorkbench.svelte` on the `source-text` textarea. Three events are handled:

**`oncompositionstart`** — sets `composing = true`, a local `$state` boolean.

**`oninput`** — checks `e.isComposing`. If the browser reports active IME composition, the handler returns early and does nothing. If not composing (direct keyboard input or post-composition), it runs the filter.

**`oncompositionend`** — sets `composing = false`, then runs the same filter. This fires after the user selects a candidate character from the IME. At this point the value contains the committed Han character and the filter is safe to apply.

The filter regex is `/[^\p{Script=Han}　-〿＀-￯]/gu` — it keeps Han script characters and CJK punctuation/fullwidth ranges (`U+3000–U+303F`, `U+FF00–U+FFEF`), stripping everything else.

**Cursor preservation:** Stripping characters changes string length, which would snap the caret to the end. The handler saves `selectionStart` and `selectionEnd` before filtering, then calls `setSelectionRange(start - removed, end - removed)` after, keeping the caret at the correct position relative to the filtered content.

**Font switching during composition:** The Wenkai font renders poorly for Latin characters. During IME composition, the textarea class switches from `font-wenkai` to `font-ss4` (Source Serif 4) via the `composing` boolean. Once composition ends and the Han character is committed, it reverts to `font-wenkai`.

## Design Decisions

**Filter on `compositionend`, not just `oninput`:** Some browsers fire `oninput` after `compositionend` with `isComposing = false`, but not all do so reliably in the correct order. Running the filter explicitly in `oncompositionend` ensures it always runs after character commitment regardless of browser event ordering.

**Character ranges as literal Unicode over `\u` escapes:** The regex uses literal characters for the CJK punctuation and fullwidth ranges rather than `\uXXXX` escapes. This is functionally identical but makes the range boundaries more readable when viewed as source.

**Filter defined in `QuoteWorkbench`, not `+page.svelte`:** Input validation belongs to the input component. The `hangex` regex visible in `+page.svelte` is a leftover scaffold from development and is unused — it can be removed.

## Areas to Be Careful

The cursor position correction assumes that all removed characters were within or before the selection range. If a paste operation inserts invalid characters both before and after the selection, the `start - removed` calculation may be imprecise. In practice this is unlikely (pastes typically move the caret to end), but it is a known approximation.

The `oncompositionend` filter fires before Svelte's `bind:value` has a chance to sync. The handler therefore writes directly to `el.value` and manually updates `sourceText` — bypassing the binding in the error case. The binding still handles the non-error path.

## Future Considerations

- The font-switching on composition is a display workaround. A more principled approach would be a separate overlay or `contenteditable` surface that keeps the composition visually separated from committed text.
- If the source field ever needs to accept CJK punctuation selectively (e.g., reject fullwidth Latin), the regex will need refinement.
