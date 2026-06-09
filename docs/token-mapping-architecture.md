# Token & Mapping Architecture

Overview of how tokens are parsed, how mappings are created, and how state is derived.

---

## Token Parsing

**Source tokens** — `src/lib/tokenize.ts` `tokenizeSource()`

Splits Chinese text into one token per character. Types: `character` (Han), `punctuation`, `number`, `symbol`. Newlines delimit lines; not emitted as tokens.

**Target tokens** — two variants:

| Function | Behaviour | Default? |
|---|---|---|
| `tokenizeTargetSeparate()` | Every punctuation run is its own token | No |
| `tokenizeTargetCombined()` | Flanking punctuation absorbed into adjacent word token | **Yes** |

Default set in `QuoteWorkbench.svelte`. Both variants produce types: `text`, `hanzi`, `punctuation`, `whitespace`.

---

## Whitespace Strategy

Whitespace tokens are parsed (regex `\s+`, type `'whitespace'`) but:

- **Not interactive** — source excludes whitespace + punctuation; target excludes whitespace only
- **Not mapped** — `clickTarget` returns early for whitespace tokens
- **Bridged in display** — a whitespace token inherits the visual state of its nearest non-whitespace neighbors when both sides belong to the same mapping (`tokenState.ts` `findBridgeMappingId()`)
- **Bridged in text** — `buildTargetText()` spans gaps of ≤5 tokens when all gap tokens are whitespace or punctuation

Whitespace tokens exist for copy/paste and rendering (punctuation spacing).

---

## Data Model

Defined in `src/lib/tokenState.ts`:

```ts
type MappingId = string; // crypto.randomUUID()

type Mapping = {
  id: MappingId;
  colorIndex: number;
  sourceIndices: number[];  // indices into sourceTokens[]
  targetIndices: number[];  // indices into targetTokens[]
  pinyin: string[];         // parallel to sourceIndices
};

type TokenState =
  | { kind: 'unmapped' }
  | { kind: 'idle';   color: string }
  | { kind: 'active'; color: string };
```

---

## LinkContext Class

Lives in `src/lib/context/link.svelte.ts`. Svelte 5 class with `$state` / `$derived` runes; accessed via `getLinkContext()`.

**Reactive index maps** (derived, O(1) lookup):

```ts
sourceMappingIndex: Map<number, MappingId>  // token index → mapping ID
targetMappingIndex: Map<number, MappingId>
```

**`sortedMappingViews`** — derived array of `MappingView` (id, colorIndex, sourceEntries with pinyin, targetText), sorted by first source index. Used by the mapping panel.

---

## Click Interaction Logic

### `clickSource(i, shift)`

| Condition | Action |
|---|---|
| Token belongs to **active** mapping | Remove token from mapping; prune if empty |
| Token belongs to **another** mapping | Switch active mapping to that one |
| Active mapping exists, first source slot or `shift` held | Append to active mapping |
| Active mapping exists, already has a source, no `shift` | Create new mapping for this token |
| No active mapping | Create new mapping for this token |

### `clickTarget(i)`

| Condition | Action |
|---|---|
| Token is whitespace | No-op |
| Token belongs to **active** mapping | Remove token; prune if empty |
| Token belongs to **another** mapping | Switch active mapping |
| Active mapping exists | Append to active mapping |
| No active mapping | Create new mapping for this token |

---

## Mapping Lifecycle

- **Create** — `createMapping()` inits with empty indices; UUID + next color index
- **Prune** — `pruneActive()` deletes active mapping if `sourceIndices.length + targetIndices.length === 0`
- **Delete** — `deleteActive()` / `deleteById(id)` remove by ID; clear active if needed
- **Deselect** — `deselect()` sets `activeMappingId = null` without deleting

---

## Token State Derivation

Pure functions in `src/lib/tokenState.ts`:

- `deriveSourceTokenState(i, sourceMappingIndex, mappings, activeMappingId)` — returns `unmapped` / `idle` / `active`
- `deriveTargetTokenState(i, targetTokens, targetMappingIndex, mappings, activeMappingId)` — same, plus whitespace bridging via `findBridgeMappingId()`
