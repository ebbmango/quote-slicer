# Mode Transitions

This page is about *motion* — how the workbench animates as it moves between the four
modes. There are three separate transitions: the **arrow launch** (text → link), the
**persistent-DOM crossfade** (link ↔ line ↔ view), and the **sidebar slide** (panels
opening when you leave text mode).

## The arrow launch (text → link)

The first transition is a deliberate animation beat, owned by `+page.svelte`.

In text mode the only control is a downward arrow. Clicking it doesn't switch modes
immediately — `advanceToLinkMode()` instead:

1. sets `arrowExiting = true`, which triggers the `arrow-launch` CSS keyframes — the
   arrow *anticipates* upward with a slight `scaleY` stretch, holds a beat, then
   accelerates hard downward and fades, like a loosed arrow;
2. after `450ms` (`setTimeout`), seeds demo/placeholder text if the fields are empty,
   then flips `modeCtx.current = 'link'` — so the shot finishes *before* the tools
   panel fades in (`in:fade` with a `250ms` delay).

A re-entrancy guard (`if (arrowExiting) return`) prevents a double-fire. The hover
nudge (`translateY(3px)`) and the launch keyframes share the same `.arrow-svg` element
on purpose: while the keyframe animation runs it overrides the hover transition
outright, so a half-finished hover slide can never bleed into the shot.

### Seamless text→token handoff

At 450 ms Svelte swaps the textarea block for the token grid. To keep that swap from
being a visible cut, each textarea **pre-matches** its token-mode appearance *during* the
launch, so the DOM change lands on a screen that already looks like the destination. A
crossfade overlay was rejected — it needs two live DOM trees, timing coordination, and
risks flicker; pre-matching costs nothing at mount.

- **Geometry.** The source textarea carries `tracking-[2px]` and `translate-x-[1px]`. The
  token row's effective per-pair gap is 2 px (a `gap-px` plus a zero-width divisor button
  between each pair, counted twice); the 1 px translate cancels the trailing
  letter-spacing that would otherwise centre the glyph block 1 px left. Font size is
  unified to `1.75rem` across textareas, token spans, and sidebar cards.
- **Colour.** When `arrowExiting` flips true, each field gets an `.exiting` modifier and
  animates over 400 ms (just under the 450 ms swap, so it settles flat first). The three
  fields use different strategies — source/authorship stay at their resting opacity and
  only raise the *placeholder* to `currentColor`; the target field keeps element opacity
  at 1 and dims via *text colour* to `currentColor @ 30%`, with a fixed placeholder path
  rather than `currentColor` to avoid compounding two opacity multipliers.

`prefers-reduced-motion` keeps the pre-match (the swap stays seamless) but applies the
`.exiting` state instantly instead of animating it.

> The geometry match is exact only because the divisor buttons are zero-width — if
> divisor sizing changes, `tracking-[2px]` / `translate-x-[1px]` must be recomputed (a
> comment in `QuoteWorkbench.svelte` flags this).

## The persistent-DOM crossfade (link ↔ line ↔ view)

### Why it's built this way

A brand-new DOM element can't transition *from* a previous element's state — the
browser just paints the final value. As long as the panels swapped their whole subtree
between a "line-mode branch" and a "link/view branch", **no** CSS transition could make
token color or line-break height animate across a mode change; everything snapped.

The fix is structural: `InteractiveSourceText` and `InteractiveTargetText` render **one
DOM tree for every mode**. A single `{#each tokens}` loop, wrapped in one container.
What changes between modes is *attributes*, not *which elements are mounted*:

- the container's ARIA role (`listbox` in link/view, none in line mode);
- whether token spans are interactive (`role="option"`, click handlers);
- whether the line-tool buttons take clicks (a `.line-active` class; outside line mode
  they keep their layout slot but get `pointer-events: none`).

### The two transitions that carry the motion

- **`.tok`** — a class on every token span: `transition: color/opacity/font-weight
  280ms`. Both panels compute a token's target colour, opacity class, and weight with
  one shared pure function, `tokenPresentation(o)` (`src/lib/tokenPresentation.ts`,
  returning `{ style, opacityClass }`); the timing lives in the CSS rule. Leaving link
  mode unsets colour/weight, so the span crossfades back to the default text colour on
  its own. Source opacity also encodes the mode (`opacity-70` in line, `opacity-30` in
  view), so the three modes read distinctly without ever remounting. During a *theme*
  toggle this 280 ms widens to 500 ms under `html.theme-anim` so tokens settle in step
  with the page background — see [Dark Mode](dark-mode.md#synchronized-transitions-htmltheme-anim).
- **`.merge-zone`** — the full-width line break. It is a real element at `height: 0` in
  link/view (still forcing a flex wrap, so it doubles as the plain line break) and
  transitions to `height: 1.5rem` when `.line-active`. That height transition is what
  makes lines visibly "come apart" entering line mode.

### How this coexists with the split/merge tween

Two parties want to own the scroll box's height:

1. the [token store](token-store.md#the-line-edit-animation-splitmerge), which pins
   an explicit pixel height *during* a split/merge tween (`animating === true`);
2. everything else, which wants `height: auto` so the box follows content in flow —
   including the `.merge-zone` height transitions above.

The panel's `$effect` resolves this simply: whenever `animating` is `false`, it clears
the inline height (`container.style.height = ''`), handing the box back to `auto`. The
store's tween, on completion, *also* releases to `''` rather than pinning a measured
pixel value — so the box is free to follow later separator transitions.

> Both panel components must stay in lockstep: the `.tok`, `.merge-zone`,
> `.line-active` rules and the height hand-off are duplicated across
> `InteractiveSourceText.svelte` and `InteractiveTargetText.svelte`. Divergence
> desyncs the source/target animations. `prefers-reduced-motion: reduce` disables the
> `.tok`/`.merge-zone` transitions in both.

> **Known gotcha:** in one headless/automated probe, forcing `height` on the
> `.merge-zone.line-active` flex item computed to `0px` while `min-height` worked,
> though it rendered fine in a real browser. If the line gap ever fails to open in a
> real browser, swap `height` → `min-height` in *both* components and re-verify the
> close transition. The note lives in the code at both sites.

## The sidebar slide (leaving text mode)

The outer grid in `+page.svelte` animates the side panels in. In `text` mode the
sidebars are translated fully off-screen and the grid columns are collapsed to `0fr`;
adding the `.panels-open` class (whenever `mode !== 'text'`) animates
`grid-template-columns`, the gaps, opacity, and the panels' `translate` back to rest
over `--slide` (500ms). Which columns exist at all is a function of the breakpoint —
see [UI Architecture](ui-architecture.md#responsive-layout). This too is disabled under
`prefers-reduced-motion`.
