# Tokenization

## Why tokenization matters here

Everything the user clicks is a **token**. The alignment is a relationship between
_source tokens_ and _target tokens_, so how the raw text is sliced determines exactly
what can be mapped to what. The two sides have different needs — Chinese is mapped one
character at a time, English one word at a time — so there are two tokenizers, both in
`src/lib/tokenize.ts`.

The array-only tokenizers assign local IDs for standalone use. The store allocates
monotonic IDs when accepting draft text. `parseSource` and `parseTarget` return
`{ tokens, breaks, errors }`; incomplete/unrepresentable authored lines are
reported before the user can advance to mapping.

## Source tokenizer

`tokenizeSource(text: string): SourceToken[]`

One Chinese character per token. Newlines delimit lines and are **consumed** (not
emitted as tokens); each interior newline becomes a boundary position in the separate break array.

Token types are assigned by Unicode class:

| Type            | Matches                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `'character'`   | Han script (`\p{Script=Han}`) — these are the mappable units; `pinyin` starts `undefined` |
| `'number'`      | `\p{N}` — `pinyin: null`                                                                  |
| `'punctuation'` | `\p{P}` or `\p{S}` — `pinyin: null`                                                       |
| `'symbol'`      | anything else — `pinyin: null`                                                            |

In practice the source rarely contains anything but Han characters, because the source
input field filters input in real time against `SOURCE_INPUT_RE` (`tokenize.ts`),
which allows Han characters, CJK punctuation blocks, and textual whitespace. (The filter is
IME-aware — see [UI Architecture](ui-architecture.md).)

### Source punctuation grouping

`groupSourceTokens(tokens, breaks)` (also in `tokenize.ts`) is a **display grouping** over the
already-tokenized source array — it returns `number[][]`, arrays of token _indices_,
one per group. It does **not** create new tokens or touch IDs, mapping, or pinyin; it
only tells the renderer which tokens to keep on the same visual unit.

Why: classical Chinese punctuation is semantically attached to an adjacent character —
terminal marks (`。，！？`) and closing brackets trail the preceding character; opening
brackets (`「『《【（`) lead the following one. When the source panel wraps, a mark that
follows the last character on a line can orphan onto the next line. Each group is a base
character plus its glued punctuation, so the renderer can wrap each group as one
non-breaking unit (`.tok-group`).

The side a mark binds to is derived from the character itself via Unicode property
escapes — `\p{Ps}` (opening brackets) and `\p{Pi}` (initial quotes) bind to the token
that _follows_; everything else binds to the token that _precedes_ — rather than a
hand-maintained list. **Grouping never crosses an explicit break**, so a line split
that lands between a character and its punctuation simply puts them in different groups,
and this invariant is what makes the [line-tool no-split rule](line-tool.md#source-panel-interactivesourcetext)
safe.

## Target tokenizer

`tokenizeTarget(text: string): TargetToken[]`

`parseTarget` is the raw target authoring boundary: it removes non-newline
whitespace only at the beginning and end of the whole input, before tokenization
and ID allocation. Internal spaces/tabs and spaces beside internal line boundaries
remain lossless. Authored newlines are never trimmed: their separator tokens,
breaks, and empty-line validation keep their existing semantics. The raw textarea
and store cache key remain unchanged; mapped text still requires an explicit
identity-aware edit. Existing token arrays and exports are never trimmed.

The hard part is punctuation. The guiding rule: **punctuation that touches a word is
absorbed into that word, but punctuation wedged _between_ two word-characters splits
out** so each piece stays individually mappable.

A single regex, `TARGET_RE`, matches in priority order:

1. a single Han character;
2. a word (Latin letters / digits) with any _flanking_ punctuation absorbed;
3. a whitespace run (excluding newlines);
4. a standalone punctuation run not adjacent to any word.

Any unmatched text is retained as text tokens, including non-Latin letters and
combining marks; the matcher must never drop canonical content.

```
There's nothing "simple" in programming.
→ [There's][ ][nothing][ ]["simple"][ ][in][ ][programming.]
```

### The merge rules

- **Flanking punct absorbed** — leading/trailing punctuation merges into the word:
  `"simple"`, `programming.`, `(hello)`, `$5`, `5%`.
- **Interior punct splits out** — punctuation flanked by word-chars on _both_ sides is
  not absorbed: `well-known` → `[well][-][known]`; `3.14` → `[3][.][14]`;
  `$5,000.00` → `[$5][,][000][.][00]`. This is what makes hyphenated compounds and
  numbers mappable piece by piece.
- **Contractions excepted** — a straight `'` or curly `’` apostrophe between word-chars
  stays merged: `don't`, `it’s`, `dogs'`. This is the one interior-punct case that does
  _not_ split (regex group `(?:['’][A-Za-z0-9]+)*`).
- **Standalone punct** — a punctuation run with no adjacent word is its own token:
  `...`, or an em-dash between words (`word—word` → `[word][—][word]`).
- **Target hanzi untouched** — Han characters in target text stay single-char tokens;
  adjacent punctuation stays standalone (`你好!` → `[你][好][!]`).

The lookbehind/lookahead `(?<![A-Za-z0-9])` / `(?![A-Za-z0-9])` are what enforce the
interior-vs-flanking distinction. This behaviour is locked down by ~137 lines of cases
in `src/lib/tokenize.spec.ts`.

> **History:** there used to be two target tokenizers (`tokenizeTargetSeparate` and
> `tokenizeTargetCombined`). They were consolidated into this single `tokenizeTarget`
> so the rest of the app only ever reasons about one shape of `TargetToken[]`.

### Token type

| Type            | When                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `'whitespace'`  | whitespace runs                                                                                                     |
| `'hanzi'`       | a single Han character                                                                                              |
| `'text'`        | any token containing a letter or digit (`[\p{L}\p{N}]`) — so `$5` and `simple.` are `'text'` and therefore mappable |
| `'punctuation'` | pure-symbol runs                                                                                                    |

## Initial authored breaks

Source newlines produce boundary positions without text tokens. Translation
newlines produce a canonical space token followed by a boundary. That space is
retained if the break is later removed. Initial empty source lines and a trailing
empty translation line are reported as unrepresentable. Consecutive translation
newlines can produce whitespace-only lines and adjacent boundaries.

## Whitespace strategy

Whitespace tokens (type `'whitespace'`) exist in the target stream but are treated
specially:

- **Not interactive in link tool** — `Alignment.toggleTarget` early-returns for
  whitespace (and punctuation), so they can't be added to a mapping.
- **Never stored in a mapping** — no `Mapping` will ever hold a whitespace token ID.
- **Bridged visually** — a whitespace token flanked on both sides by tokens from the
  _same_ mapping inherits that mapping's color, so a multi-word phrase reads as one
  continuous highlight. The rule is `findBridgeMapping()`, an internal helper in
  `tokenState.ts` used by `deriveTargetTokenState`; see
  [Link Tool](link-tool.md#whitespace-bridging).
- **Bridged in text output** — `buildTargetText()` treats short gaps (indices at most
  `MAX_BRIDGE_GAP = 5` apart, all whitespace/punctuation between) as contiguous, so a
  mapping's `targetText` renders as a single phrase rather than comma-joined fragments.
- **Copyable** — in line tool the whitespace tokens are rendered as
  `<span role="button">` with `user-select: text`, not `<button>`, so selecting and
  copying the target text preserves the spaces.

Source textual whitespace is preserved as symbol tokens; it is never inferred from editorial breaks.
