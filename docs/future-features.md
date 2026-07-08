# Future Features

Affordances and features that have been **designed or discussed but not built**.
Each entry records the intended behavior and the constraints that shaped it, so a
future implementation starts from the decisions already made rather than
re-deriving them. Nothing here is in the codebase today.

> These are deliberately deferred — most are out of scope while the app targets a
> single book. They become relevant only if the tool generalizes.

---

## Punctuation: click-to-exclude toggle

**Status:** designed in full, then dropped as too much work for the size of the
affordance. Superseded for now by the simpler "punctuation is atomic with its
base" rule (see [Line Tool](line-tool.md)).

The original idea: in line tool, a punctuation mark would be **clickable to toggle
its own inclusion** in the final output, independent of line-breaking.

- Clicking the punctuation does **not** split a line. It marks the punctuation as
  excluded.
- An excluded mark stays in place but renders **faint** (low opacity, no
  strikethrough) so the toggle state is visible and layout stays stable (GSAP Flip
  can still reference the element).
- The split zone that breaks lines stays **after** the punctuation — e.g. for
  `A ， B`, the only divisor sits between `，` and `B`. Clicking the divisor breaks
  the line; clicking `，` toggles its appearance.
- Use case: let a reader flip between a traditional unpunctuated rendering and a
  modern punctuated one **without editing the source text**.

Data-model impact (deferred with the feature): an `excluded?: boolean` on
`SourceToken`, meaningful only when `type === 'punctuation'`. Export would simply
omit excluded punctuation from the serialized text; nothing else changes.

Why dropped: the user affordance is small relative to the data-model and
export-path work it requires. Replaced by making a base token and its glued
punctuation an atomic unit for line purposes (no intra-group divisor), which
prevents orphaning with none of the toggle machinery.

---

## Paired punctuation: shared state + cross-group pairing

**Status:** discussed, deferred. Today paired marks just stick to their adjacent
hanzi like any other punctuation (the grouping in `groupSourceTokens` already
binds a leading bracket to the next base and a trailing bracket to the previous
base), and the click-to-exclude toggle above does not exist, so there is nothing
to pair yet.

When/if the click-to-exclude toggle (or any per-mark visibility/hover affordance)
lands, **paired marks must behave as a unit**:

- **Paired marks** — `「」`, `『』`, `《》`, `（）`, `【】`, and the like — are
  incomplete without each other. They should **share visibility and hover state**:
  hovering the opening mark also lights the closing mark; toggling one toggles
  both.
- **Single marks** — `，` `。` `？` `！` etc. — are independent; each is its own
  affordance.

The hard part is **cross-group** pairing. In `「大家好」`, the opening `「` is glued
to `大` and the closing `」` is glued to `好` — they live in **different groups**,
possibly far apart in the token array. True matched-bracket semantics therefore
need:

1. a lookup table of Unicode open/close bracket pairs,
2. a matching pass over the full token array (stack-based, to handle nesting), and
3. cross-component state sync so hovering one mark lights its partner in another
   group.

This is a self-contained feature, not a tweak to the current grouping.

---

## Per-breakpoint line breaks (and exclusion)

**Status:** planned; blocks the shelved line-tool scroll fix. See the project
memory notes on responsive line-breaks and the line-tool scroll design.

Line breaks (and, if the exclusion toggle above ships, exclusion status) are
currently **global** — one set of breaks for all viewport widths. The future
feature lets the user define **different line splits per responsive breakpoint**,
so a quote can wrap one way on a phone and another on a wide screen.

Data-model direction discussed: a token's `line` (and a future `excluded`) would
become **per-breakpoint records** rather than single values — the token carries a
line-pertaining and exclusion-status for each breakpoint.

This also suggests **splitting the per-breakpoint workflow into its own line/view
sub-tools**: a "line" sub-tool for authoring the breaks at each breakpoint and a
"view" sub-tool for previewing the result without the editing affordances getting
in the way of reading.
