# Line Mode

Line mode (`mode.current === 'line'`) lets users adjust where line breaks fall in the source and target texts independently. Line edits do not change the raw text strings — they mutate the token array's `.line` fields and are preserved by the text-keyed cache.

## Core functions

All three live in `src/lib/line.ts` as pure generics over `T extends { line: number }`.

### `splitAfterToken(tokens, afterIndex)`

Inserts a line break after `tokens[afterIndex]`. Returns a new array — does not mutate. Logic:

- Tokens on lines **above** `splitLine` → unchanged
- Tokens at index `afterIndex` and before on `splitLine` → unchanged
- Tokens **after** `afterIndex` on `splitLine` → `line = splitLine + 1` (moved to new line)
- Tokens on lines **below** `splitLine` → `line + 1` (shift down to make room)

No tokens are added or removed. Token IDs are invariant.

### `mergeLines(tokens, lineN)`

Merges line `lineN + 1` into line `lineN`. Returns a new array. Logic:

- Tokens on `lineN + 1` → `line = lineN`
- Tokens on lines above `lineN + 1` → `line - 1` (close the gap)
- All other tokens → unchanged

### `groupByLine(tokens)`

Groups a flat token array into line buckets. Returns:

```ts
{ lineNum: number; group: { token: T; globalIndex: number }[] }[]
```

Each entry carries `globalIndex` — the token's position in the original flat array. Used as a `$derived` in `InteractiveSourceText` for rendering line rows.

## Text-keyed cache pattern

Fresh tokenization discards any manual line splits because the tokenizer re-reads the raw text string. The **line edit** module (`src/lib/animation/lineEdit.svelte.ts`, see [CONTEXT.md](../CONTEXT.md)) prevents this with a text-keyed cache, owned internally:

```ts
// inside createLineEdit()
let sourceCache: { text: string; tokens: SourceToken[] } | null = $state(null);

function sourceTokens(text: string): SourceToken[] {
  return sourceCache !== null && sourceCache.text === text
    ? sourceCache.tokens   // cache hit: text unchanged, use split/merged tokens
    : tokenizeSource(text); // cache miss: text changed, re-tokenize fresh
}
```

`QuoteWorkbench` derives its token arrays from this:

```ts
const lineEdit = createLineEdit();
let sourceTokens = $derived(lineEdit.sourceTokens(sourceText));
```

`split`/`merge` write the cache after running the animation (see [Animation](#animation) below):

```ts
function splitSource(afterIndex: number) {
  lineEdit.split('source', sourceText, alignment.sourceTokenList, afterIndex, editScope());
}
```

When the user edits the raw text, `sourceText` changes → cache key mismatch → fresh tokenize → cache cleared implicitly. When the user only adjusts line breaks, `sourceText` stays the same → cache hit → line structure preserved across re-renders.

The same pattern applies to target tokens via the module's `targetCache`.

## Interaction model

### Source panel (InteractiveSourceText)

In line mode the source panel renders a flat `{#each tokens}` loop with `data-flip-id="src-{i}"` on every token span. Between tokens, zero-width buttons appear:

- **Between tokens on the same line** → split button (vertical hairline indicator on hover)
- **At a line boundary** → merge button (horizontal hairline indicator on hover)

Clicking a split button calls `onSplit(globalIndex)` which bubbles up to `QuoteWorkbench.splitSource`. Clicking a merge button calls `onMerge(lineN)` which bubbles to `QuoteWorkbench.mergeSource`.

### Target panel (InteractiveTargetText)

The target panel uses whitespace tokens as the interaction surface rather than zero-width buttons:

- **Interior whitespace tokens** (not at a line boundary) → rendered as `<button class="ws-split">`, clicking triggers `handleSplit(i)`
- **Boundary whitespace tokens** (the synthetic token appended between lines during tokenization) → rendered as `<button class="ws-boundary">` plus a merge-zone button below it, clicking either triggers `handleMerge(token.line)`

Non-whitespace tokens and non-boundary whitespace tokens are plain spans.

## Keyboard scheme (line mode)

Provided by the same `createTokenGridNav()` instance as link mode (`src/lib/navigation/tokenGridNav.ts`), wired up in `QuoteWorkbench.svelte`. See [TokenGridNav](ui-architecture.md#tokengridnav) for the shared mechanism.

The navigable elements are the split/merge buttons (`.split-zone`, `.merge-zone`, `.ws-split`, `.ws-boundary`) — all real `<button>`s, so they're focusable without `data-token-index`.

| Shortcut | Action |
|---|---|
| Alt+↑ / Alt+↓ | Move focus to the split/merge button on the visual row above/below |
| Alt+← / Alt+→ | Move focus to prev/next split/merge button in DOM order |
| Alt+Space / Alt+Shift+Space | Activate the focused button — triggers its `click` handler (`handleSplit`/`handleMerge`) |
| Escape | Blur the focused button |

Alt+Enter and the source↔target row-boundary jump are link-mode only (`crossZoneJump`); in line mode, reaching the top/bottom edge of a panel's buttons with Alt+↑/↓ does nothing.

## Animation

A split or merge calls into the **line edit** module (`lineEdit.split`/`lineEdit.merge`), which lazy-loads GSAP's `Flip` plugin and runs one **unified Flip** over an **edit scope** — the edited panel's tokens plus the other panel's wrapper and the authorship textarea, all carrying `data-flip-id`:

1. `Flip.getState(...)` over the edit scope's flip targets — captures positions before the mutation
2. Lock the edited panel's scroll box (`[data-scrollbox]`) to its current pixel height
3. The mutation fires (writes the text-keyed cache → `sourceTokens` / `targetTokens` update reactively)
4. `await tick()` lets Svelte apply the DOM changes
5. Tween the scroll box from its locked height to its settled `scrollHeight`, then release to `auto`
6. `Flip.from(state, { duration: 0.35, ease: 'power2.inOut', absolute: false })` animates every flip target from its old position to its new one — per-token reflow inside the edited panel, whole-wrapper repositioning for the other panel and authorship

The flat `{#each tokens (i)}` loop in `InteractiveSourceText` (keyed by index, not token identity) keeps every span alive across mutations so Flip can track all elements. `InteractiveTargetText` is keyed by index in line mode for the same reason.

Both `Interactive*Text` components receive `animating` as a prop from `lineEdit.animating` and use it to gate their own height-reset `$effect` — they leave the scroll box's height alone while the module's tween is in flight.

`justify-center` on the workbench parent means all three panels shift together when total height changes — this is why the *other* panel and authorship are included as whole-wrapper flip targets even when only one panel's tokens change.
