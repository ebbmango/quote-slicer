# Tokenization

All tokenization lives in `src/lib/tokenize.ts`.

## Source tokenizer

`tokenizeSource(text: string): SourceToken[]`

Splits Chinese source text one character per token. Newlines delimit lines and are consumed — not emitted as tokens. Each token's `.line` is the index of the newline-separated segment it belongs to.

Token types: `'character'` (Han script), `'number'` (Unicode `\p{N}`), `'punctuation'` (`\p{P}` or `\p{S}`), `'symbol'` (everything else).

The source input field filters out non-Han characters in real time using `SOURCE_INPUT_RE` (`tokenize.ts:2`), so in practice the tokenizer only sees Han characters, CJK punctuation, and numbers.

## Target tokenizer

`tokenizeTarget(text: string): TargetToken[]` — used by `QuoteWorkbench.svelte`.

Punctuation that **touches a word** (Latin letters or digits) is absorbed into that word's token. The regex `TARGET_RE` (`tokenize.ts`) matches in priority order: single Han character, word-with-flanking-punct, whitespace run, standalone punctuation run.

Example: `There's nothing "simple" in programming.`
→ `[There's][ ][nothing][ ]["simple"][ ][in][ ][programming.]`

### Merge rules

- **Flanking punct absorbed** — leading and trailing punctuation merge into the word: `"simple"`, `programming.`, `(hello)`, `$5`, `5%`, `5.`
- **Interior punct splits out** — punctuation flanked by word-chars on **both** sides is *not* absorbed, so the user can map each piece. Hyphens: `well-known` → `[well][-][known]`. Decimal/thousands separators: `3.14` → `[3][.][14]`, `$5,000.00` → `[$5][,][000][.][00]`.
- **Contractions excepted** — a straight `'` or curly `’` apostrophe between word-chars stays merged: `don't`, `it’s`, `dogs'`. This is the one interior-punct case that does not split (regex group `(?:['’][A-Za-z0-9]+)*`, plus trailing-possessive absorbed as trailing punct).
- **Standalone punct** — a punctuation run with no adjacent word stays its own `'punctuation'` token: `...`, em-dashes between words (`word—word` → `[word][—][word]`).
- **Target hanzi untouched** — Han characters in target text remain single-char tokens; adjacent punctuation stays standalone (`你好!` → `[你][好][!]`).

The lookbehind/lookahead `(?<![A-Za-z0-9])` / `(?![A-Za-z0-9])` enforce the interior-vs-flanking distinction.

### Token type

`'whitespace'` for whitespace runs, `'hanzi'` for single Han chars, `'text'` for any token containing a letter or digit (so merged tokens like `$5` and `simple.` are `'text'` — mappable and alignable), `'punctuation'` for pure-symbol runs.

## Line stamping

The target tokenizer splits on `\n` and stamps each token with a `line` index matching its segment. Newlines are consumed, not emitted.

After the tokens for each line segment, a synthetic boundary whitespace token is appended — except after the last line:

```ts
if (line < lines.length - 1) tokens.push({ text: ' ', line, type: 'whitespace' });
```

This boundary token serves as the merge affordance in line mode: clicking it merges the two surrounding lines. See [Line Mode](line-mode.md).

## Whitespace strategy

Whitespace tokens (type `'whitespace'`) exist in the target token stream but are:

- **Not interactive in link mode** — `toggleTarget` returns early for whitespace (`alignment.svelte.ts:209`)
- **Not directly mappable** — no mapping will ever store a whitespace token ID
- **Bridged visually** — if a whitespace token is flanked on both sides by tokens from the same mapping, it inherits that mapping's color (`findBridgeMappingId()` in `tokenState.ts:35`)
- **Bridged in text output** — `buildTargetText()` treats gaps of ≤ 5 tokens where all gap tokens are whitespace or punctuation as contiguous, so `"simple"` renders as a single phrase rather than split fragments

Source tokens do not have a whitespace type — the source input field filters out spaces entirely.
