# quote-slicer

quote-slicer aligns a Chinese source passage with its English translation, character by character.

## Language

**Alignment**:
The model owning the mapping list, the source/target token arrays, the click-to-toggle state machine, and per-token display state (`stateOfSource`/`stateOfTarget`). Implemented as the `Alignment` Svelte context (`src/lib/context/alignment.svelte.ts`).
_Avoid_: LinkContext, link state

**Mapping** / **active mapping** / **token** / **source token** / **target token** / **whitespace bridging** / **boundary whitespace** / **token ID**:
See `CLAUDE.md`'s domain vocabulary table — these terms are shared across the whole codebase, not specific to the Alignment module.

**token store**:
The single owner of the source/target token arrays. Tokenizes, holds the text-keyed split/merge cache, owns per-character pinyin as an id-keyed overlay applied on read, and runs the single unified Flip around each split/merge. `src/lib/animation/tokenStore.svelte.ts` (`createTokenStore` / `setTokenStoreContext`). The Alignment module derives its token view from this store keyed by the current text, rather than holding its own copy — so there is no second token owner to keep in sync, and split/merge can no longer be fed the "wrong" (pinyin-less) array.
_Avoid_: lineEdit (former name), line manager, split service, token cache (the cache is only part of it)

**line edit**:
The operation — splitting or merging a line break, with its single animation — that the token store performs. The user-facing mode that triggers it is the **line tool** (mode key `'line'`).
_Avoid_: naming a module "line edit"; the implementing module is the **token store**

**edit scope**:
The bundle of DOM refs a single line edit animates over — the token-grid root plus source wrapper, target wrapper, and authorship element, each carrying a `data-flip-id`. Passed into `split`/`merge` so one `Flip.getState` captures token reflow and panel shift together.
_Avoid_: animation context, refs, targets

**unified Flip**:
The single GSAP Flip that animates a whole line edit at once — per-token reflow inside the edited panel and the downward slide of the panels below it — replacing the former split arrangement of an intra-panel Flip plus a separate cross-panel Y-shift.
_Avoid_: shift animation, double Flip
