# quote-slicer

quote-slicer aligns a Chinese source passage with its English translation, character by character.

## Language

**Alignment**:
The model owning the mapping list, the source/target token arrays, the click-to-toggle state machine, and per-token display state (`stateOfSource`/`stateOfTarget`). Implemented as the `Alignment` Svelte context (`src/lib/context/alignment.svelte.ts`).
_Avoid_: LinkContext, link state

**Mapping** / **active mapping** / **token** / **source token** / **target token** / **whitespace bridging** / **boundary whitespace** / **token ID**:
See `CLAUDE.md`'s domain vocabulary table — these terms are shared across the whole codebase, not specific to the Alignment module.

**token store**:
The single owner of the source/target token arrays. Tokenizes, holds the text-keyed split/merge cache, owns per-character pinyin as an id-keyed overlay applied on read, and runs the [line-edit animation](#line-edit-animation) around each split/merge. `src/lib/animation/tokenStore.svelte.ts` (`createTokenStore` / `setTokenStoreContext`). The Alignment module derives its token view from this store keyed by the current text, rather than holding its own copy — so there is no second token owner to keep in sync, and split/merge can no longer be fed the "wrong" (pinyin-less) array.
_Avoid_: lineEdit (former name), line manager, split service, token cache (the cache is only part of it)

**line edit**:
The operation — splitting or merging a line break, with its single animation — that the token store performs. The user-facing mode that triggers it is the **line tool** (mode key `'line'`).
_Avoid_: naming a module "line edit"; the implementing module is the **token store**

**line divisor**:
The split/merge affordance shown between tokens in the line tool — the source panel's zero-width `.split-zone` button, the target panel's copyable `.ws-split` whitespace span, and the full-width `.merge-zone` band. The single module owning all three surfaces, the touch first-tap/second-tap state machine, the hover-spread wiring, and the divisor CSS is `LineDivisor.svelte`; the panels render their tokens and delegate each divisor through it. Before, both `InteractiveSourceText` and `InteractiveTargetText` carried near-identical copies of this markup, interaction, and ~200 lines of CSS.
_Avoid_: split zone (only the source surface), separator, gap button

**edit scope**:
The bundle of DOM refs a single line edit animates over — each panel's wrapper, its inner scroll box, and the authorship field. Passed into `split`/`merge`: `Flip.getState` captures the edited panel's tokens for reflow, and the edited wrapper is the element whose height is tweened (when the panel can grow). The authorship ref is carried here (not found by the store walking the DOM) because the workbench owns the layout — the store reads its scope and nothing outside it.
_Avoid_: animation context, refs, targets

**ViewHighlight**:
The view-mode hover-highlight timer state machine, extracted from `Alignment`. Owns `hoveredMappingId` (`$state`), the cold/warm/grace delay logic, and the mouse/touch input methods (`hoverSource`, `hoverTarget`, `hoverOut`, `tapSource`, `tapTarget`, `isSourceHighlighted`, `isTargetHighlighted`, `clearHighlight`). `Alignment` constructs one internally and passes a resolver closure over its live `sourceMappingIndex`/`targetMappingIndex` maps, then exposes it as a `readonly highlight` field; callers reach it directly (`alignment.highlight.hoverSource(i)`) rather than through pass-through forwarders. Located at `src/lib/context/viewHighlight.svelte.ts`.
_Avoid_: "hover state", "highlight machine"

**token-grid DOM contract**:
The single source of truth for every selector and attribute name coupling the rendered token grid — panel zones (`data-zone`), tokens (`data-token-index`, `role="option"`, `.tok`, `data-flip-id`), line divisors (`data-divisor-index`, `.split-zone`/`.merge-zone`/`.ws-split`), scroll boxes (`data-scrollbox`), the authorship field (`#authorship`) — to its readers: the keyboard navigator, the hover-spread (`redistribute`), the line-edit animation, the global shortcuts. Components write these in their markup; readers import from `src/lib/navigation/gridDom.ts` (selector constants, the `zoneSelector`/`tokenSelector`/`divisorSelector` builders, and `getZone`). Absorbs the former `constants/lineDivisor.ts`.
_Avoid_: scattering `querySelector('[data-…]')` in readers; "selectors file" (it owns the `Zone` type and `getZone`, not just strings)

**line-edit animation**:
What animates a line edit. The edited panel's tokens reflow via one GSAP Flip; when the new content still fits the panel its wrapper's height tweens (sliding the panels below it in flow); once the panel overflows (capped stack, internal scroll) the height is owned by flex, so the layout settles instantly and only the tokens reflow. The panels below are **not** flipped — they ride the flow — and each panel wrapper is `overflow-clip` so a reflowing token can never paint into the other panel. See [token store](docs/token-store.md).
_Avoid_: unified Flip (the slide is flow-driven, not a second Flip); shift animation; double Flip
