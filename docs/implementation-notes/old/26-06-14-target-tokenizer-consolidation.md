# Target tokenizer consolidation: one regex, interior-vs-flanking punctuation

> Commits: `34b7992`
> Date: 2026-06-14

## Overview

The target tokenizer had two parallel implementations — `tokenizeTargetSeparate` (every
punctuation run its own token) and `tokenizeTargetCombined` (flanking punctuation absorbed into
words). This commit drops both in favor of a single `tokenizeTarget`, which absorbs _flanking_
punctuation into word tokens but splits out punctuation that sits _between_ two word characters
(hyphens, decimal points, thousands separators) so each piece remains individually mappable.

## Motivation

`QuoteWorkbench.svelte` only ever used the "separate" variant; the "combined" variant existed but
was unused, and neither handled the case of `well-known` or `3.14` sensibly — a combined-style
absorb would swallow the whole compound into one token, making it impossible to map `well` and
`known` to separate source tokens.

## Implementation Details

The old `SEPARATE_RE` and `COMBINED_RE` regexes (`tokenize.ts`) are replaced by a single
`TARGET_RE`:

```
\p{Script=Han}
| (?<![A-Za-z0-9])[^\p{L}\p{N}\s]*[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*[^\p{L}\p{N}\s]*(?![A-Za-z0-9])
| [^\S\n]+
| [^\p{L}\p{N}\s]+
```

The second alternative is the core change: a word (letters/digits) with optional leading and
trailing punctuation, guarded by `(?<![A-Za-z0-9])` / `(?![A-Za-z0-9])` lookaround. Those
lookarounds are what stop punctuation flanked by word-chars on _both sides_ from being absorbed —
that punctuation falls through to the standalone-punctuation alternative instead, splitting
`well-known` into `[well][-][known]` and `3.14` into `[3][.][14]`.

Contractions are the one interior-punct exception: `(?:['’][A-Za-z0-9]+)*` keeps a straight or
curly apostrophe between word-chars merged (`don't`, `it's`, `James'`).

Token typing also changed slightly: a token is `'text'` if it contains `[\p{L}\p{N}]` (was just
`\p{L}` before), so a merged token like `$5` or `5%` correctly becomes `'text'` (mappable) rather
than `'punctuation'`.

## Examples

| Input                                      | Output                                                               |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `There's nothing "simple" in programming.` | `[There's][ ][nothing][ ]["simple"][ ][in][ ][programming.]`         |
| `well-known`                               | `[well][-][known]`                                                   |
| `$5,000.00`                                | `[$5][,][000][.][00]`                                                |
| `你好!`                                    | `[你][好][!]` (hanzi tokens untouched; punctuation stays standalone) |

## Design Decisions

- Single tokenizer reduces the surface area for the export/link-tool/line-tool code to reason
  about — there is now exactly one shape of `TargetToken[]` for any given text.
- The interior/flanking distinction is a deliberate tradeoff: it makes hyphenated compounds and
  numbers mappable piece-by-piece, at the cost of a denser regex with lookaround. 137 lines of
  new test cases in `src/lib/vitest-examples/tokenize.spec.ts` cover the boundary behavior.
