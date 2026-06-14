# quote-slicer

quote-slicer aligns a Chinese source passage with its English translation, character by character.

## Language

**Alignment**:
The model owning the mapping list, the source/target token arrays, the click-to-toggle state machine, and per-token display state (`stateOfSource`/`stateOfTarget`). Implemented as the `Alignment` Svelte context (`src/lib/context/alignment.svelte.ts`).
_Avoid_: LinkContext, link state

**Mapping** / **active mapping** / **token** / **source token** / **target token** / **whitespace bridging** / **boundary whitespace** / **token ID**:
See `CLAUDE.md`'s domain vocabulary table — these terms are shared across the whole codebase, not specific to the Alignment module.

**line edit**:
The module owning split/merge of line breaks, the single animation around the mutation, and the text-keyed token cache that keeps a split/merged array alive until the source text changes. `src/lib/animation/lineEdit.svelte.ts`.
_Avoid_: line tool (that is the user-facing mode name), line manager, split service

**edit scope**:
The bundle of DOM refs a single line edit animates over — the token-grid root plus source wrapper, target wrapper, and authorship element, each carrying a `data-flip-id`. Passed into `split`/`merge` so one `Flip.getState` captures token reflow and panel shift together.
_Avoid_: animation context, refs, targets

**unified Flip**:
The single GSAP Flip that animates a whole line edit at once — per-token reflow inside the edited panel and the downward slide of the panels below it — replacing the former split arrangement of an intra-panel Flip plus a separate cross-panel Y-shift.
_Avoid_: shift animation, double Flip
