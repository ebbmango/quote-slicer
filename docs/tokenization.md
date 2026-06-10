# Tokenization

All tokenization lives in `src/lib/tokenize.ts`.

## Source tokenizer

`tokenizeSource(text: string): SourceToken[]`

Splits Chinese source text one character per token. Newlines delimit lines and are consumed — not emitted as tokens. Each token's `.line` is the index of the newline-separated segment it belongs to.

Token types: `'character'` (Han script), `'number'` (Unicode `\p{N}`), `'punctuation'` (`\p{P}` or `\p{S}`), `'symbol'` (everything else).

The source input field filters out non-Han characters in real time using `SOURCE_INPUT_RE` (`tokenize.ts:2`), so in practice the tokenizer only sees Han characters, CJK punctuation, and numbers.

## Target tokenizers

Two variants exist. `QuoteWorkbench.svelte` uses `tokenizeTargetSeparate`.

### `tokenizeTargetSeparate(text: string): TargetToken[]`

Every punctuation run is its own token. The regex `SEPARATE_RE` (`tokenize.ts:42`) matches in priority order: single Han character, Latin word (with optional internal apostrophe for contractions), whitespace run, remaining punctuation/symbol run.

Example: `There's nothing "simple" in programming.`
→ `[There's][ ][nothing][ ]["][simple]["][ ][in][ ][programming][.]`

### `tokenizeTargetCombined(text: string): TargetToken[]`

Flanking punctuation is absorbed into the adjacent word token. The regex `COMBINED_RE` (`tokenize.ts:80`) adds an optional leading and trailing punctuation group around the Latin word pattern.

Example: `There's nothing "simple" in programming.`
→ `[There's][ ][nothing][ ]["simple"][ ][in][ ][programming.]`

## Line stamping

Both target tokenizers split on `\n` and stamp each token with a `line` index matching its segment. Newlines are consumed, not emitted.

After the tokens for each line segment, a synthetic boundary whitespace token is appended — except after the last line (`tokenize.ts:67`, `tokenize.ts:105`):

```ts
if (line < lines.length - 1) tokens.push({ text: ' ', line, type: 'whitespace' });
```

This boundary token serves as the merge affordance in line mode: clicking it merges the two surrounding lines. See [Line Mode](line-mode.md).

## Whitespace strategy

Whitespace tokens (type `'whitespace'`) exist in the target token stream but are:

- **Not interactive in link mode** — `clickTarget` returns early for whitespace (`link.svelte.ts:196`)
- **Not directly mappable** — no mapping will ever store a whitespace token ID
- **Bridged visually** — if a whitespace token is flanked on both sides by tokens from the same mapping, it inherits that mapping's color (`findBridgeMappingId()` in `tokenState.ts:35`)
- **Bridged in text output** — `buildTargetText()` treats gaps of ≤ 5 tokens where all gap tokens are whitespace or punctuation as contiguous, so `"simple"` renders as a single phrase rather than split fragments

Source tokens do not have a whitespace type — the source input field filters out spaces entirely.
