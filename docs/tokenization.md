# Tokenization

## Why tokenization matters here

Everything the user clicks is a **token**. The alignment is a relationship between
*source tokens* and *target tokens*, so how the raw text is sliced determines exactly
what can be mapped to what. The two sides have different needs — Chinese is mapped one
character at a time, English one word at a time — so there are two tokenizers, both in
`src/lib/tokenize.ts`.

Both tokenizers assign each token a stable integer `id` (its position in the flat
output array) as the very last step. See [Data Model](data-model.md#stable-token-ids)
for why that ID matters.

## Source tokenizer

`tokenizeSource(text: string): SourceToken[]`

One Chinese character per token. Newlines delimit lines and are **consumed** (not
emitted as tokens); each token's `.line` is the index of the newline-separated segment
it came from.

Token types are assigned by Unicode class:

| Type | Matches |
|------|---------|
| `'character'` | Han script (`\p{Script=Han}`) — these are the mappable units; `pinyin` starts `undefined` |
| `'number'` | `\p{N}` — `pinyin: null` |
| `'punctuation'` | `\p{P}` or `\p{S}` — `pinyin: null` |
| `'symbol'` | anything else — `pinyin: null` |

In practice the source rarely contains anything but Han characters, because the source
input field filters input in real time against `SOURCE_INPUT_RE` (`tokenize.ts`),
which only allows Han characters, CJK punctuation blocks, and newlines. (The filter is
IME-aware — see [UI Architecture](ui-architecture.md).)

## Target tokenizer

`tokenizeTarget(text: string): TargetToken[]`

The hard part is punctuation. The guiding rule: **punctuation that touches a word is
absorbed into that word, but punctuation wedged *between* two word-characters splits
out** so each piece stays individually mappable.

A single regex, `TARGET_RE`, matches in priority order:

1. a single Han character;
2. a word (Latin letters / digits) with any *flanking* punctuation absorbed;
3. a whitespace run (excluding newlines);
4. a standalone punctuation run not adjacent to any word.

```
There's nothing "simple" in programming.
→ [There's][ ][nothing][ ]["simple"][ ][in][ ][programming.]
```

### The merge rules

- **Flanking punct absorbed** — leading/trailing punctuation merges into the word:
  `"simple"`, `programming.`, `(hello)`, `$5`, `5%`.
- **Interior punct splits out** — punctuation flanked by word-chars on *both* sides is
  not absorbed: `well-known` → `[well][-][known]`; `3.14` → `[3][.][14]`;
  `$5,000.00` → `[$5][,][000][.][00]`. This is what makes hyphenated compounds and
  numbers mappable piece by piece.
- **Contractions excepted** — a straight `'` or curly `’` apostrophe between word-chars
  stays merged: `don't`, `it’s`, `dogs'`. This is the one interior-punct case that does
  *not* split (regex group `(?:['’][A-Za-z0-9]+)*`).
- **Standalone punct** — a punctuation run with no adjacent word is its own token:
  `...`, or an em-dash between words (`word—word` → `[word][—][word]`).
- **Target hanzi untouched** — Han characters in target text stay single-char tokens;
  adjacent punctuation stays standalone (`你好!` → `[你][好][!]`).

The lookbehind/lookahead `(?<![A-Za-z0-9])` / `(?![A-Za-z0-9])` are what enforce the
interior-vs-flanking distinction. This behaviour is locked down by ~137 lines of cases
in `src/lib/vitest-examples/tokenize.spec.ts`.

> **History:** there used to be two target tokenizers (`tokenizeTargetSeparate` and
> `tokenizeTargetCombined`). They were consolidated into this single `tokenizeTarget`
> so the rest of the app only ever reasons about one shape of `TargetToken[]`.

### Token type

| Type | When |
|------|------|
| `'whitespace'` | whitespace runs |
| `'hanzi'` | a single Han character |
| `'text'` | any token containing a letter or digit (`[\p{L}\p{N}]`) — so `$5` and `simple.` are `'text'` and therefore mappable |
| `'punctuation'` | pure-symbol runs |

## Line stamping and the boundary whitespace token

The target tokenizer splits on `\n` and stamps each token with its segment's `line`
index. Newlines are consumed, not emitted.

After the tokens of each line segment — but **not** after the last line — a synthetic
**boundary whitespace** token is appended:

```ts
if (line < lines.length - 1) tokens.push({ text: ' ', line, type: 'whitespace' });
```

This token is the **merge affordance** in line mode: clicking it merges the two lines
it sits between. See [Line Mode](line-mode.md#the-line-tool-affordances).

## Whitespace strategy

Whitespace tokens (type `'whitespace'`) exist in the target stream but are treated
specially:

- **Not interactive in link mode** — `Alignment.toggleTarget` early-returns for
  whitespace (and punctuation), so they can't be added to a mapping.
- **Never stored in a mapping** — no `Mapping` will ever hold a whitespace token ID.
- **Bridged visually** — a whitespace token flanked on both sides by tokens from the
  *same* mapping inherits that mapping's color, so a multi-word phrase reads as one
  continuous highlight. The rule is `findBridgeMappingId()` in `tokenState.ts`; see
  [Link Mode](link-mode.md#whitespace-bridging).
- **Bridged in text output** — `buildTargetText()` treats short gaps (≤ 5 tokens, all
  whitespace/punctuation) as contiguous, so a mapping's `targetText` renders as a
  single phrase rather than comma-joined fragments.
- **Copyable** — in line mode the whitespace tokens are rendered as
  `<span role="button">` with `user-select: text`, not `<button>`, so selecting and
  copying the target text preserves the spaces.

Source tokens have no whitespace type — the source input filter strips spaces entirely.
