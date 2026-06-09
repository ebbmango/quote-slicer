# Line-Break Tokenization and Rendering

> Commits: `9bd2677`, `845027a`, `35ba33c`  
> Date: 2026-06-09

## Overview

Both source and target tokenizers now understand newlines as line boundaries. Each token carries a `line` index, and the interactive text components use that index to render visible line breaks during the mapping phase — without touching token indices or alignments.

## Motivation

Classical Chinese poetry and prose is naturally organized into lines, but automatic sentence detection is unreliable: the genre often lacks punctuation entirely, and line breaks carry poetic or rhetorical significance that no regex can recover. The decision was made to let the user define lines explicitly via newlines in the input textarea, keeping the data model flat (a `line` number on each token) rather than nesting tokens inside paragraph objects.

The immediate goal was to make line structure survive into the linking phase, where users map source characters to translation words. Without this, multi-line quotes collapsed into an undifferentiated token stream.

## Architecture

The feature spans three layers:

- **Input filter** (`QuoteWorkbench.svelte`, `tokenize.ts`): `SOURCE_INPUT_RE` — the allowlist regex that strips non-Han characters from the source textarea — was extracted as a named export and extended to permit `\n`. Previously the regex was duplicated across `oninput` and `oncompositionend` handlers; it is now a single constant imported from `tokenize.ts`.

- **Tokenizers** (`tokenize.ts`): `tokenizeSource`, `tokenizeTargetSeparate`, and `tokenizeTargetCombined` all split the input string on `\n` first, then tokenize each segment. The `line` index (the split position) is stamped onto every token. Newlines are never emitted as tokens — they exist only as boundaries.

- **Rendering** (`InteractiveSourceText.svelte`, `InteractiveTargetText.svelte`): Both components iterate the flat token list and insert a `w-full` flex-break `<div>` whenever `token.line` changes between consecutive tokens. This forces a line wrap in the flexbox layout without any structural reorganization.

## Design Decisions

**Flat attribute over nested structure.** An alternative was to group tokens into `Sentence[]` or `Paragraph[]` arrays in the `Quote` type. The flat `line` number was preferred because it keeps the token arrays homogeneous, requires no structural traversal when rendering, and leaves alignments (which reference tokens by index) completely unaffected by line reorganization.

**Newlines as the user-facing primitive.** Rather than a bespoke "add line break" button, users simply press Enter in the textarea. This is familiar, reversible, and works with all input methods including IME composition. A more interactive line-splitting UI (splitting/merging lines post-mapping) is planned as a follow-on feature; the `line` attribute on tokens already supports it.

**Whitespace regex tightened.** `SEPARATE_RE` and `COMBINED_RE` used `\s+` to match whitespace runs. After the split-on-newline change this was technically redundant (segments never contain `\n`), but both patterns were updated to `[^\S\n]+` as a defensive measure.

## Future Considerations

The `line` attribute currently comes only from newlines in the input textarea. A planned interactive editor will let users split and merge lines post-hoc by clicking gaps between tokens, updating `token.line` values in place. Alignments are keyed by token index, not line, so they will be unaffected.
