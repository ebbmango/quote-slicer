# quote-slicer

quote-slicer aligns a Chinese source passage with its English translation, character by character.

## Language

**Alignment**:
The model owning the mapping list, the source/target token arrays, the click-to-toggle state machine, and per-token display state (`stateOfSource`/`stateOfTarget`). Implemented as the `Alignment` Svelte context (`src/lib/context/alignment.svelte.ts`).
_Avoid_: LinkContext, link state

**Mapping** / **active mapping** / **token** / **source token** / **target token** / **whitespace bridging** / **boundary whitespace** / **token ID**:
See `CLAUDE.md`'s domain vocabulary table — these terms are shared across the whole codebase, not specific to the Alignment module.
